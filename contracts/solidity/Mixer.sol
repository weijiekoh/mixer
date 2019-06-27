pragma experimental ABIEncoderV2;
pragma solidity >=0.4.21;
import "./Semaphore.sol";
import "node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Mixer {
    using SafeMath for uint256;

    address public operator;
    uint256 public operatorFee = 0.0005 ether;
    uint256 public mixAmt = 0.1 ether;
    uint256 public feesOwedToOperator;
    Semaphore public semaphore;
    uint256[] public identityCommitments;

    struct DepositProof {
        bytes signal;
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
        uint[3] input;
        address recipientAddress;
        address broadcasterAddress;
        uint256 fee;
    }

    /*
     * Constructor
     */
    constructor (address _semaphore) public {
        // Set the Semaphore contract
        semaphore = Semaphore(_semaphore);
    }

    /*
     * Returns the fee which each user has to pay to mix their funds.
     */
    function getTotalFee() public view returns (uint256) {
        return operatorFee * 2;
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
     */
    function deposit(uint256 _identityCommitment) public payable {
        require(msg.value == mixAmt);
        require(_identityCommitment != 0);
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
    }

    /*
     * Withdraw funds to a specified recipient using a zk-SNARK deposit proof
     * @param _proof A deposit proof. This function will send `mixAmt` to the
     *               recipient if the proof is valid.
     */
    function mix(DepositProof _proof) public {
        // Check whether the fee matches the one quoted by this contract
        require(_proof.fee == getTotalFee());

        // Hash the recipient's address, mixer contract address, and fee to get
        // the signal hash
        bytes32 computedSignalHash = keccak256(
            abi.encodePacked(
                _proof.recipientAddress,
                address(this),
                _proof.fee
            )
        );

        // Check whether the signal hash provided matches the one computed above
        require(computedSignalHash == _proof.input[2]);

        // Broadcast the signal
        semaphore.broadcastSignal(
            _proof.a,
            _proof.b,
            _proof.c,
            _proof.input
        );

        // Increase the operator's fee balance
        feesOwedToOperator = feesOwedToOperator.add(operatorFee);

        // Transfer the ETH owed to the recipient, minus the totalFee (to
        // prevent griefing)
        // Note that totalFee = operatorFee * 2.
        uint256 recipientMixAmt = mixAmt.sub(operatorFee.mul(2));
        _proof.recipientAddress.transfer(recipientMixAmt);
    }
}
