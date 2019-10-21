pragma experimental ABIEncoderV2;
pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./RelayerReputation.sol";

contract RelayerForwarder is Ownable {
    using SafeMath for uint256;

    address payable constant burnAddress = address(0);

    Fraction public burnFraction; // NOTE: represents the fraction of fee used as burn
    RelayerReputation public reputation;

    struct Fraction {
        uint256 numerator;
        uint256 denominator;
    }

    constructor(uint256 _burnNum, uint256 _burnDenom) public {
        require(_burnDenom >= _burnNum, "RelayerForwarder: burn fraction denominator must be >= numerator");
        burnFraction = Fraction(
            _burnNum,
            _burnDenom
        );
    }

    function _computeBurn(uint256 feePlusBurn) internal view returns (uint256) {
        return feePlusBurn.mul(burnFraction.numerator).div(burnFraction.denominator);
    }

    function _relayCall(
        address _applicationContract,
        bytes memory _encodedPayload
    ) internal returns (uint256 fee, uint256 burn) {
        // feePlusBurn calculated by the increase in balance of this contract
        uint256 prevBalance = address(this).balance;
        (bool success,) = _applicationContract.call(_encodedPayload);
        require(success, "RelayerForwarder: failure calling application contract");
        uint256 finalBalance = address(this).balance;

        if (finalBalance > prevBalance) {
            uint256 feePlusBurn = finalBalance.sub(prevBalance);
            burn = _computeBurn(feePlusBurn);
            fee = feePlusBurn.sub(burn);
        } else {
            // Set burn, fee to 0 explicitly if there was no fee. No need to send any fee to the relayer
            burn = 0;
            fee = 0;
        }

        return (fee, burn);
    }

    /**
     * Enables sending Ether to this contract
     */
    function () external payable {}

    /**
     * Sets the fraction of fee that's burned.
     *
     * @param _burnNum The new numerator for burnFraction
     * @param _burnDenom The new denominator for burnFraction
     */
    function setBurnFraction(uint256 _burnNum, uint256 _burnDenom) external onlyOwner {
        require(_burnDenom >= _burnNum, "RelayerForwarder: burn fraction denominator must be >= numerator");
        burnFraction = Fraction(
            _burnNum,
            _burnDenom
        );
    }

    /**
     * Sets the reputation contract.
     *
     * @param _reputationAddress The address of the reputation contract to set.
     */
    function setReputation(address _reputationAddress) external onlyOwner {
        reputation = RelayerReputation(_reputationAddress);
    }

    /**
     * Sends all balance accrued in this contract to the burn address (0x0).
     * Anyone can call this function.
     * It is good to periodically drain the burnable balance from the contract
     * so that we reduce harm in the event of a hack.
     */
    function burnBalance() external {
        burnAddress.transfer(address(this).balance);
    }

    /**
     * Calls an application contract and updates relayer reputation accordingly. It's assumed that the
     * application contract sends back any fees to this contract, from which burn is taken.
     *
     * @param _applicationContract The application contract to call
     * @param _encodedPayload Payload to call _applicationContract with. Must be encoded as with
     *                        abi.encodePacked to properly work with .call
     */
    function relayCall(
        address _applicationContract,
        bytes calldata _encodedPayload
    ) external {
        require(address(reputation) != address(0), "RelayerForwarder: reputation contract must be set to relay calls");

        require(tx.origin == msg.sender, "RelayerForwarder: cannot relay calls from another contract");

        (uint256 fee, uint256 burn) = _relayCall(_applicationContract, _encodedPayload);

        address payable relayer = msg.sender;
        if (fee > 0) {
            relayer.transfer(fee);
        }
        reputation.updateReputation(relayer, burn);
    }

    /**
     * Calls multiple application contracts and updates relayer reputation accordingly.
     *
     * @param _applicationContracts The application contracts to call.
     * @param _encodedPayloads Payloads to call each contract in _applicationContract with. Must be encoded as
     *                         with abi.encodePacked.
     */
    function batchRelayCall(
        address[] calldata _applicationContracts,
        bytes[] calldata _encodedPayloads
    ) external {
        require(address(reputation) != address(0), "RelayerForwarder: reputation contract must be set to relay calls");

        require(tx.origin == msg.sender, "RelayerForwarder: cannot relay calls from another contract");

        require(
            _applicationContracts.length == _encodedPayloads.length,
            "RelayerForwarder: must send an equal number of application contracts and encoded payloads"
        );

        address payable relayer = msg.sender;
        uint256 totalRelayerFee = 0;
        for (uint i = 0; i < _applicationContracts.length; i++) {
            (uint256 fee, uint256 burn) = _relayCall(_applicationContracts[i], _encodedPayloads[i]);

            totalRelayerFee += fee;
            reputation.updateReputation(relayer, burn);
        }

        relayer.transfer(totalRelayerFee);
    }
}
