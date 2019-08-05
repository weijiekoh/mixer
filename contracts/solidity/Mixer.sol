pragma experimental ABIEncoderV2;
pragma solidity ^0.5.0;
import { Semaphore } from "./Semaphore.sol";
import { SafeMath } from "./SafeMath.sol";
import { IERC20 } from "./token/IERC20.sol";

contract Mixer {
    using SafeMath for uint256;

    uint256 public mixAmt;
    Semaphore public semaphore;
    uint256[] public identityCommitments;
    IERC20 public token;

    event Deposited(address indexed depositor, uint256 indexed mixAmt, uint256 identityCommitment);
    event DepositedERC20(address indexed depositor, uint256 indexed mixAmt, uint256 identityCommitment);
    event Mixed(address indexed recipient, uint256 indexed mixAmt, uint256 indexed operatorFeeEarned);
    event MixedERC20(address indexed recipient, uint256 indexed mixAmt, uint256 indexed operatorFeeEarned);

    // input = [root, nullifiers_hash, signal_hash, external_nullifier, broadcaster_address]
    struct DepositProof {
        bytes32 signal;
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[4] input;
        address payable recipientAddress;
        uint256 fee;
    }

    /*
     * Constructor
     * @param _semaphore The address of the Semaphore contract which should
     * have been deployed earlier
     * @param _mixAmt The amount of Ether a user can mix at a time, in wei
     */
    constructor (address _semaphore, uint256 _mixAmt, address _token) public {
        require(_semaphore != address(0), "Mixer: invalid Semaphore address");
        require(_mixAmt != 0, "Mixer: invalid mixAmt");

        // Set the fixed mixing amount
        mixAmt = _mixAmt;

        // Set the Semaphore contract
        semaphore = Semaphore(_semaphore);

        // Set the token address
        token = IERC20(_token);
    }

    function supportsEthOnly() public view returns (bool) {
        return 0x0000000000000000000000000000000000000000 == address(token);
    }

    modifier onlyEth() {
        require(supportsEthOnly() == true, "Mixer: only supports ETH");
        _;
    }

    modifier onlyERC20() {
        require(supportsEthOnly() == false, "Mixer: only supports tokens");
        _;
    }

    /*
     * Sets Semaphore's external nullifier to the mixer's address. Call this
     * function after transferring Semaphore's ownership to this contract's
    *  address.
     */
    function setSemaphoreExternalNulllifier () public {
        semaphore.setExternalNullifier(uint256(address(this)));
    }

    /*
     * Returns the list of all identity commitments, which are the leaves of
     * the Merkle tree
     */
    function getLeaves() public view returns (uint256[] memory) {
        return identityCommitments;
    }


    /*
     * Inserts an identity commitment into Semaphore.
     * @param The identity commitment (the hash of the public key and the
     *        identity nullifier)
     */
    function insertIdentityCommitment(uint256 _identityCommitment) private {
        require(_identityCommitment != 0, "Mixer: invalid identity commitment");
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
    }

    /*
     * Deposits `mixAmt` tokens into the contract and registers the user's
     * identity commitment into Semaphore.
     * @param The identity commitment (the hash of the public key and the
     *        identity nullifier)
     */

    function depositERC20(uint256 _identityCommitment) public onlyERC20 {
        require(_identityCommitment != 0, "Mixer: invalid identity commitment");

        // Transfer tokens from msg.sender to this contract
        bool transferSucceeded  = token.transferFrom(msg.sender, address(this), mixAmt);

        // Ensure that the token transfer succeeded
        require(transferSucceeded, "Mixer: transferFrom() failed");

        insertIdentityCommitment(_identityCommitment);

        emit DepositedERC20(msg.sender, mixAmt, _identityCommitment);
    }

    /*
     * Deposits `mixAmt` wei into the contract and registers the user's identity
     * commitment into Semaphore.
     * @param The identity commitment (the hash of the public key and the
     *        identity nullifier)
     */
    function deposit(uint256 _identityCommitment) public payable onlyEth {
        require(msg.value == mixAmt, "Mixer: wrong mixAmt deposited");

        insertIdentityCommitment(_identityCommitment);

        emit Deposited(msg.sender, msg.value, _identityCommitment);
    }

    function broadcastToSemaphore(DepositProof memory _proof, address payable _relayerAddress) private {
        // The fee must be high enough, but not larger than the mix
        // denomination; note that a self-interested relayer would exercise
        // their discretion as to whether to relay transactions depending on
        // the fee specified
        require(_proof.fee < mixAmt, "Mixer: quoted fee gte mixAmt");

        // Hash the recipient's address, the mixer contract's address, and fee
        bytes32 computedSignal = keccak256(
            abi.encodePacked(
                _proof.recipientAddress,
                _relayerAddress,
                _proof.fee
            )
        );

        // Check whether the signal hash provided matches the one computed above
        require(computedSignal == _proof.signal, "Mixer: invalid computed signal");

        // Broadcast the signal
        semaphore.broadcastSignal(
            abi.encode(_proof.signal),
            _proof.a,
            _proof.b,
            _proof.c,
            _proof.input
        );
    }

    /*
     * Withdraw tokens to a specified recipient using a zk-SNARK deposit proof
     * @param _proof A deposit proof. This function will send `mixAmt` tokens,
     *               minus fees, to the recipient if the proof is valid.
     */
    function mixERC20(DepositProof memory _proof, address payable _relayerAddress) public onlyERC20 {
        broadcastToSemaphore(_proof, _relayerAddress);

        // Transfer the fee to the relayer
        bool relayerTransferSucceeded = token.transfer(_relayerAddress, _proof.fee);
        require(relayerTransferSucceeded, "Mixer: failed to transfer the fee in tokens to the relayer");

        // Transfer the tokens owed to the recipient, minus the fee 
        uint256 recipientMixAmt = mixAmt.sub(_proof.fee);
        bool recipientTransferSucceeded = token.transfer(_proof.recipientAddress, recipientMixAmt);
        require(recipientTransferSucceeded, "Mixer: failed to transfer mixAmt tokens to the recipient");

        emit MixedERC20(_proof.recipientAddress, recipientMixAmt, _proof.fee);
    }

    /*
     * Withdraw funds to a specified recipient using a zk-SNARK deposit proof
     * @param _proof A deposit proof. This function will send `mixAmt`, minus
     *               fees, to the recipient if the proof is valid.
     */
    function mix(DepositProof memory _proof, address payable _relayerAddress) public onlyEth {
        broadcastToSemaphore(_proof, _relayerAddress);

        // Transfer the fee to the relayer
        _relayerAddress.transfer(_proof.fee);

        // Transfer the ETH owed to the recipient, minus the fee 
        uint256 recipientMixAmt = mixAmt.sub(_proof.fee);
        _proof.recipientAddress.transfer(recipientMixAmt);

        emit Mixed(_proof.recipientAddress, recipientMixAmt, _proof.fee);
    }
}
