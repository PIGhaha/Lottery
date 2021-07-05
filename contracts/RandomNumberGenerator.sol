pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";
import "./Lottery.sol";

contract RandomNumberGenerator is VRFConsumerBase {

    address requester;
    bytes32 keyHash;
    uint256 fee;

    constructor(address _vrfCoordinator, address _link, bytes32 _keyHash, uint256 _fee)
        VRFConsumerBase(_vrfCoordinator, _link) public {
            keyHash = _keyHash;
            fee = _fee;
    }

    function fulfillRandomness(bytes32 _requestId, uint256 _randomness) internal override {
        Lottery(requester).numberDrawn(_requestId, _randomness);
    }


    function request() public returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) > fee, "Not enough LINK - fill contract with faucet");
        requester = msg.sender;
        return requestRandomness(keyHash, fee);
    }
}
