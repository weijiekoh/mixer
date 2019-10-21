pragma experimental ABIEncoderV2;
pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./ERC20RelayerReputation.sol";

contract ERC20RelayerForwarder is Ownable {
    using SafeMath for uint256;

    address payable constant burnAddress = address(0);

    Fraction public burnFraction; // NOTE: represents the fraction of fee used as burn. Currently is the same
                                  // *for all* ERC20 tokens
    ERC20RelayerReputation public reputation;

    struct Fraction {
        uint256 numerator;
        uint256 denominator;
    }

    constructor(uint256 _burnNum, uint256 _burnDenom) public {
        require(_burnDenom >= _burnNum, "ERC20RelayerForwarder: burn fraction denominator must be >= numerator");
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
        bytes memory _encodedPayload,
        address _erc20Address
    ) internal returns (uint256 fee, uint256 burn) {
        IERC20 erc20Contract = IERC20(_erc20Address);

        // feePlusBurn calculated by the increase in balance of this contract
        uint256 prevBalance = erc20Contract.balanceOf(address(this));
        (bool success,) = _applicationContract.call(_encodedPayload);
        require(success, "ERC20RelayerForwarder: failure calling application contract");
        uint256 finalBalance = erc20Contract.balanceOf(address(this));

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
        require(_burnDenom >= _burnNum, "ERC20RelayerForwarder: burn fraction denominator must be >= numerator");
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
        reputation = ERC20RelayerReputation(_reputationAddress);
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
     * @param _erc20Address ERC20 contract address that's used for fee payment
     */
    function relayCall(
        address _applicationContract,
        bytes calldata _encodedPayload,
        address _erc20Address
    ) external {
        require(address(reputation) != address(0), "ERC20RelayerForwarder: reputation contract must be set to relay calls");

        require(tx.origin == msg.sender, "ERC20RelayerForwarder: cannot relay calls from another contract");

        (uint256 fee, uint256 burn) = _relayCall(_applicationContract, _encodedPayload, _erc20Address);

        address payable relayer = msg.sender;
        if (fee > 0) {
            IERC20 erc20Contract = IERC20(_erc20Address);
            erc20Contract.transfer(relayer, fee);
        }

        reputation.updateReputation(relayer, _erc20Address, burn);
    }

    /**
     * Calls multiple application contracts and updates relayer reputation accordingly.
     *
     * @param _applicationContracts The application contracts to call.
     * @param _encodedPayloads Payloads to call each contract in _applicationContract with. Must be encoded as
     *                         with abi.encodePacked.
     * @param _erc20Addresses ERC20 contract addresses that're used for fee payment
     */
    function batchRelayCall(
        address[] calldata _applicationContracts,
        bytes[] calldata _encodedPayloads,
        address[] calldata _erc20Addresses
    ) external {
        require(address(reputation) != address(0), "ERC20RelayerForwarder: reputation contract must be set to relay calls");

        require(tx.origin == msg.sender, "ERC20RelayerForwarder: cannot relay calls from another contract");

        require(
            _applicationContracts.length == _encodedPayloads.length,
            "ERC20RelayerForwarder: must send an equal number of application contracts and encoded payloads"
        );
        require(
            _applicationContracts.length == _erc20Addresses.length,
            "ERC20RelayerForwarder: must send an equal number of application contracts and erc20 payment addresses"
        );

        address payable relayer = msg.sender;
        for (uint i = 0; i < _applicationContracts.length; i++) {
            (uint256 fee, uint256 burn) = _relayCall(_applicationContracts[i], _encodedPayloads[i], _erc20Addresses[i]);

            if (fee > 0) {
                IERC20 erc20Contract = IERC20(_erc20Addresses[i]);
                erc20Contract.transfer(relayer, fee);
            }

            reputation.updateReputation(relayer, _erc20Addresses[i], burn);
        }
    }
}
