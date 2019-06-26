pragma experimental ABIEncoderV2;
pragma solidity >=0.4.21;
import "./Semaphore.sol";

contract Mixer {
    address public operator;
    uint256 public operatorFee;
    uint256 public amt = 0.1 ether;
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

    constructor (address _semaphore) public {
        semaphore = Semaphore(_semaphore);
    }

    function getLeaves() public view returns (uint256[]) {
        return identityCommitments;
    }

    function deposit(uint256 _identityCommitment) public payable {
        require(msg.value == amt);
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
    }
}
