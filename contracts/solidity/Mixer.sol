pragma solidity >=0.4.21;
import "./Semaphore.sol";

contract Mixer {
    address public operator;
    uint256 public operatorFee;
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

    function deposit(uint256 _identityCommitment) public {
        semaphore.insertIdentity(_identityCommitment);
        identityCommitments.push(_identityCommitment);
    }
}
