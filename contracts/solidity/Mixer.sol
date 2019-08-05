pragma experimental ABIEncoderV2;
pragma solidity ^0.5.0;
import "./Semaphore.sol";
import "./SafeMath.sol";

contract Mixer {
    using SafeMath for uint256;

    uint256 public mixAmt;
    Semaphore public semaphore;
    uint256[] public identityCommitments;

    event Deposited(address indexed depositor, uint256 indexed mixAmt, uint256 identityCommitment);
    event Mixed(address indexed recipient, uint256 indexed mixAmt, uint256 indexed operatorFeeEarned);

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
    constructor (address _semaphore, uint256 _mixAmt) public {
        require(_semaphore != address(0), "Mixer: invalid Semaphore address");
        require(_mixAmt != 0, "Mixer: invalid mixAmt");

        // Set the fixed mixing amount
        mixAmt = _mixAmt;

        // Set the Semaphore contract
        semaphore = Semaphore(_semaphore);
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
     * Deposits `mixAmt` wei into the contract and register the user's identity
     * commitment into Semaphore.
     * @param The identity commitment (the hash of the public key and the
     *        identity nullifier)
     */
    function deposit(uint256 _identityCommitment) public payable {
        require(msg.value == mixAmt, "Mixer: wrong mixAmt deposited");
        require(_identityCommitment != 0, "Mixer: invalid identity commitment");
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
        emit Deposited(msg.sender, msg.value, _identityCommitment);
    }

    /*
     * Withdraw funds to a specified recipient using a zk-SNARK deposit proof
     * @param _proof A deposit proof. This function will send `mixAmt`, minus
     *               fees, to the recipient if the proof is valid.
     */
    function mix(DepositProof memory _proof, address payable _relayerAddress) public {
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

        // Transfer the fee to the relayer
        _relayerAddress.transfer(_proof.fee);

        // Transfer the ETH owed to the recipient, minus the fee 
        uint256 recipientMixAmt = mixAmt.sub(_proof.fee);
        _proof.recipientAddress.transfer(recipientMixAmt);

        emit Mixed(_proof.recipientAddress, recipientMixAmt, _proof.fee);
    }
}
