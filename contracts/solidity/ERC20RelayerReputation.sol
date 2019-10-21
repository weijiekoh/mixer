pragma solidity ^0.5.10;

contract ERC20RelayerReputation {
    event RelayerAdded(address indexed _relayer);
    event RelayerTokenPairAdded(address indexed _relayer, address _erc20);

    event ReputationUpdated(address indexed _relayer, address _erc20, uint256 _burnValue);

    address public forwarderAddress;

    // 'Reputation' maps
    mapping(address => mapping(address => uint256)) public relayerToTokenToBurn;
    mapping(address => mapping(address => uint256)) public relayerToTokenToCount;

    // This enables enumeration of all tokens that a given relayer has serviced
    struct TokenList {
        uint256 nextToken;
        mapping(uint256 => address) tokenList;
    }
    mapping(address => TokenList) private relayerToTokenList;

    /**
     * Gets the next ERC20 token index to be used for the specified relayer
     * @param _relayer relayer whose next index to get
     */
    function getRelayerNextToken(address _relayer) external view returns (uint256) {
        return relayerToTokenList[_relayer].nextToken;
    }

    /**
     * Gets the ERC20 token stored at a specified index for a given relayer.
     * @param _relayer relayer whose tokens to search
     * @param _idx index in the relayer's token list to return
     */
    function getRelayerToken(address _relayer, uint256 _idx) external view returns (address) {
        return relayerToTokenList[_relayer].tokenList[_idx];
    }

    // Information that allows clients to find relayers on the web. i.e. via http or tor
    struct RelayerLocator {
        string locator;     // i.e. Tor or HTTP address
        string locatorType; // i.e. 'tor' or 'http'
    }
    mapping(address => RelayerLocator) public relayerToLocator;

    // Clients can enumerate relayerList using nextRelayer and then reference relayerToTokenToBurn and
    // relayerToRelayCount to determine wnich relayer(s) to use
    mapping(uint256 => address) public relayerList;
    uint256 public nextRelayer = 1;

    constructor(address _forwarderAddress) public {
        forwarderAddress = _forwarderAddress;
    }

    /**
     * Throws if called by any account other than the forwarder.
     */
    modifier onlyForwarder() {
        require(msg.sender == forwarderAddress, "ERC20RelayerReputation: caller is not the forwarder");
        _;
    }

    function _addRelayer(address _relayer) internal {
        relayerList[nextRelayer] = _relayer;
        nextRelayer += 1;

        relayerToTokenList[_relayer] = TokenList(1);

        emit RelayerAdded(_relayer);
    }

    function _addTokenToRelayer(address _relayer, address _erc20Address) internal {
        uint256 nextToken = relayerToTokenList[_relayer].nextToken;

        relayerToTokenList[_relayer].tokenList[nextToken] = _erc20Address;
        relayerToTokenList[_relayer].nextToken = nextToken + 1;

        emit RelayerTokenPairAdded(_relayer, _erc20Address);
    }

    /**
     * Updates the locator for the specified relayer address. Can only be called from that address (to prevent
     * anyone from griefing a relayer by changing its locator).
     * @param _relayer The relayer whose locator to update
     * @param _locator The new locator to set
     * @param _locatorType The locator type to use
     */
    function setRelayerLocator(address _relayer, string calldata _locator, string calldata _locatorType) external {
        require(_relayer == msg.sender, "ERC20RelayerReputation: can only set the locator for self");

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
     * @param _erc20Address The ERC20 token that's being burned for _burnValue
     * @param _burnValue The amount of wei burned by the specified relayer
     */
    function updateReputation(address _relayer, address _erc20Address, uint256 _burnValue) external onlyForwarder {
        if (relayerToTokenList[_relayer].nextToken == 0) {
            _addRelayer(_relayer);
        }

        if (relayerToTokenToCount[_relayer][_erc20Address] == 0) {
            _addTokenToRelayer(_relayer, _erc20Address);
        }

        relayerToTokenToBurn[_relayer][_erc20Address] += _burnValue;
        relayerToTokenToCount[_relayer][_erc20Address] += 1;
        emit ReputationUpdated(_relayer, _erc20Address, _burnValue);
    }
}
