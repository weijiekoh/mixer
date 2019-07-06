pragma experimental ABIEncoderV2;
pragma solidity >=0.4.21;
import "./Semaphore.sol";
import "node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Mixer {
    using SafeMath for uint256;

    address public operator;
    uint256 public operatorFee;
    uint256 public mixAmt;
    uint256 public feesOwedToOperator;
    Semaphore public semaphore;
    uint256[] public identityCommitments;

    event Deposited(address indexed depositor, uint256 indexed mixAmt, uint256 identityCommitment);
    event Mixed(address indexed recipient, uint256 indexed mixAmt, uint256 indexed operatorFee);

    // input = [root, nullifiers_hash, signal_hash, external_nullifier, broadcaster_address]
    struct DepositProof {
        bytes32 signal;
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[5] input;
        address recipientAddress;
        uint256 fee;
    }

    /*
     * Constructor
     */
    constructor (address _semaphore, uint256 _mixAmt, uint256 _operatorFee) public {
        require(_semaphore != address(0));
        require(_operatorFee != 0);
        require(_mixAmt > _operatorFee);

        // Set the operator as the contract deployer
        operator = msg.sender;

        // Set the fixed mixing amount
        mixAmt = _mixAmt;

        // Set the fixed operator's fee
        operatorFee = _operatorFee;

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
     * @return The amount of fees owed to the operator in wei
     */
    function getFeesOwedToOperator() public view returns (uint256) {
        return feesOwedToOperator;
    }

    /*
     * @return The fee in wei which each user has to pay to mix their funds.
     */
    function getTotalFee() public view returns (uint256) {
        return operatorFee * 2;
    }

    /*
     * @return The total amount of fees burnt. This is equivalent to
     * `operatorFee` multipled by the number of deposits. To save gas, we do
     * not send the burnt fees to a burn address. As this contract provides no
     * way for anyone - not even the operator - to withdraw this amount of ETH,
     * we consider it burnt.
     */
    function calcBurntFees() public view returns (uint256) {
        return address(this).balance.sub(feesOwedToOperator);
    }

    /*
     * Returns the list of all identity commitments, which are the leaves of
     * the Merkle tree
     */
    function getLeaves() public view returns (uint256[]) {
        return identityCommitments;
    }

    /*
     * Transfers all fees owed to the operator and resets the balance of fees
     * owed to 0
     */
    function withdrawFees() public {
        require(msg.sender == operator);
        operator.transfer(feesOwedToOperator);
        feesOwedToOperator = 0;
    }

    /*
     * Deposits `mixAmt` wei into the contract and register the user's identity
     * commitment into Semaphore.
     * @param The identity commitment (the hash of the public key and the
     *        identity nullifier)
     */
    function deposit(uint256 _identityCommitment) public payable {
        require(msg.value == mixAmt);
        require(_identityCommitment != 0);
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
        emit Deposited(msg.sender, msg.value, _identityCommitment);
    }

    /*
     * Withdraw funds to a specified recipient using a zk-SNARK deposit proof
     * @param _proof A deposit proof. This function will send `mixAmt`, minus
     *               fees, to the recipient if the proof is valid.
     */
    function mix(DepositProof _proof) public {
        // Check whether the fee matches the one quoted by this contract
        require(_proof.fee == getTotalFee());

        // Hash the recipient's address, mixer contract address, and fee
        bytes32 computedSignal = keccak256(
            abi.encodePacked(
                _proof.recipientAddress,
                address(this),
                _proof.fee
            )
        );

        // Check whether the signal hash provided matches the one computed above
        require(computedSignal == _proof.signal);

        // Broadcast the signal
        semaphore.broadcastSignal(
            abi.encode(_proof.signal),
            _proof.a,
            _proof.b,
            _proof.c,
            _proof.input
        );

        // Increase the operator's fee balance
        feesOwedToOperator = feesOwedToOperator.add(operatorFee);

        // Transfer the ETH owed to the recipient, minus the totalFee (to
        // prevent griefing).
        // Note that totalFee = operatorFee * 2.
        // Since the remainder is stuck in this contract, it's as good as
        // burned. As such, we don't need to transfer the ETH to 0x0000..., and
        // we can save gas too.
        uint256 recipientMixAmt = mixAmt.sub(operatorFee.mul(2));
        _proof.recipientAddress.transfer(recipientMixAmt);

        emit Mixed(_proof.recipientAddress, recipientMixAmt, operatorFee);
    }
}
