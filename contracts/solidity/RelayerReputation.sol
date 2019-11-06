pragma solidity ^0.5.10;

contract RelayerReputation {
    event RelayerAdded(address indexed _relayer);
    event ReputationUpdated(address indexed _relayer, uint256 _burnValue);

    address public forwarderAddress;

    // 'Reputation' maps
    mapping(address => uint256) public relayerToBurn;
    mapping(address => uint256) public relayerToRelayCount;

    // Information that allows clients to find relayers on the web. i.e. via http or tor
    struct RelayerLocator {
        string locator;     // i.e. Tor or IP address
        string locatorType; // i.e. 'tor' or 'ip'
    }
    mapping(address => RelayerLocator) public relayerToLocator;

    // Clients can enumerate relayerList using nextRelayer and then reference relayerToBurn and
    // relayerToRelayCount to determine wnich relayer(s) to use
    mapping(uint256 => address) public relayerList;
    uint256 public nextRelayer = 1;

    mapping(address => bool) private _seenRelayers;

    constructor(address _forwarderAddress) public {
        forwarderAddress = _forwarderAddress;
    }

    /**
     * Throws if called by any account other than the forwarder.
     */
    modifier onlyForwarder() {
        require(msg.sender == forwarderAddress, "RelayerReputation: caller is not the forwarder");
        _;
    }

    function _addRelayer(address _relayer) internal {
        relayerList[nextRelayer] = _relayer;
        nextRelayer += 1;
        _seenRelayers[_relayer] = true;
        emit RelayerAdded(_relayer);
    }

    /**
     * Updates the locator for the specified relayer address. Can only be called from that address (to prevent
     * anyone from griefing a relayer by changing its locator).
     * @param _relayer The relayer whose locator to update
     * @param _locator The new locator to set
     * @param _locatorType The locator type to use
     */
    function setRelayerLocator(address _relayer, string calldata _locator, string calldata _locatorType) external {
        require(_relayer == msg.sender, "RelayerReputation: can only set the locator for self");

        if (!_seenRelayers[_relayer]) {
            _addRelayer(_relayer);
        }

        relayerToLocator[_relayer] = RelayerLocator(
            _locator,
            _locatorType
        );
    }

    /**
     * Updates reputation maps for the specified relayer and burn value. If this is the first time we're
     * seeing the specified relayer, also adds the relayer to relevant lists.
     *
     * @param _relayer The relayer whose reputation to update
     * @param _burnValue The amount of wei burned by the specified relayer
     */
    function updateReputation(address _relayer, uint256 _burnValue) external onlyForwarder {
        if (!_seenRelayers[_relayer]) {
            _addRelayer(_relayer);
        }

        relayerToBurn[_relayer] += _burnValue;
        relayerToRelayCount[_relayer] += 1;
        emit ReputationUpdated(_relayer, _burnValue);
    }
}
