pragma solidity ^0.5.0;

contract RelayerRegistry {
    function relayCall(
        address _applicationContract,
        bytes calldata _encodedPayload
    ) external payable {
        (bool success,) = _applicationContract.call(_encodedPayload);
        require(success, "RelayerForwarder: failure calling application contract");
    }
}
