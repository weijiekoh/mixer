pragma solidity 0.5.9;
import { Semaphore } from "../../semaphore/semaphorejs/contracts/Semaphore.sol";

contract Mixer {
    address public operator;
    uint256 public operatorFee;
    Semaphore public semaphore;
}
