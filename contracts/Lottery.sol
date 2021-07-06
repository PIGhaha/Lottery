pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./RandomNumberGenerator.sol";

contract Lottery is Ownable{

	using EnumerableSet for EnumerableSet.AddressSet;
	using Address for address;
	using SafeMath for uint;
    
    IERC20 public DAI;
	enum LotteryState { Open, Closed, Finished }

	mapping(string => address[]) entries;
	mapping(uint => string) public historyWinningNumbers;
	mapping(uint => address[]) historyWinners;
	string[] numbers;
	LotteryState public state;
	uint public bettingEnd;
	uint public numberOfEntries;
	uint public entryFee;
	uint public ownerCut;
	string public winningNumber;
	uint public roundNumber;
	address randomNumberGenerator;
	bytes32 randomNumberRequestId;

	event LotteryStateChanged(LotteryState newState);
	event NewEntry(address player, string number);
	event NumberRequested(bytes32 requestId);
	event NumberDrawn(bytes32 requestId, uint winningNumber);
	event NewRound(uint roundNumber);

	// modifiers
	modifier isState(LotteryState _state) {
		require(state == _state, "Wrong state for this action");
		_;
	}

	modifier onlyRandomGenerator {
		require(msg.sender == randomNumberGenerator, "Must be correct generator");
		_;
	}

	//constructor
	constructor (uint _entryFee, uint _ownerCut, address _randomNumberGenerator, IERC20 _DAI) public Ownable() {
		require(_entryFee > 0, "Entry fee must be greater than 0");
		require(_ownerCut < _entryFee, "Entry fee must be greater than owner cut");
		require(_randomNumberGenerator != address(0), "Random number generator must be valid address");
		require(_randomNumberGenerator.isContract(), "Random number generator must be smart contract");
		DAI = _DAI;
		entryFee = _entryFee;
		ownerCut = _ownerCut;
		randomNumberGenerator = _randomNumberGenerator;
		_changeState(LotteryState.Finished);
	}

	//functions
	function submitNumber(string memory _number) public payable isState(LotteryState.Open) {
	    require(block.timestamp < bettingEnd, "betting already ended");
	    require(DAI.allowance(msg.sender,address(this)) >= entryFee, "not enough allowance");
	    DAI.transferFrom(msg.sender, address(this), entryFee);
		entries[_number].push(msg.sender);
		numbers.push(_number);
		numberOfEntries++;
		DAI.transfer(owner(), ownerCut);
		emit NewEntry(msg.sender, _number);
	}

	function drawNumber() public onlyOwner isState(LotteryState.Open) {
	    require(block.timestamp >= bettingEnd, "betting not ended yet");
		_changeState(LotteryState.Closed);
		randomNumberRequestId = RandomNumberGenerator(randomNumberGenerator).request();
		emit NumberRequested(randomNumberRequestId);
	}

	function rollover(uint bettingTime) public onlyOwner isState(LotteryState.Finished) {
		//rollover new lottery
		_changeState(LotteryState.Open);
		bettingEnd = block.timestamp + bettingTime;
		roundNumber++;
		emit NewRound(roundNumber);
	}

	function numberDrawn(bytes32 _randomNumberRequestId, uint _randomNumber) public onlyRandomGenerator isState(LotteryState.Closed) {
		if (_randomNumberRequestId == randomNumberRequestId) {
			winningNumber = _substring(_toString(_randomNumber), 0, 4);
			historyWinningNumbers[roundNumber] = winningNumber;
			_payout(entries[winningNumber]);
			_changeState(LotteryState.Finished);
			emit NumberDrawn(_randomNumberRequestId, _randomNumber);
		}
	}

	function _payout(address[] storage winners) private {
		uint balance = address(this).balance;
		for (uint index = 0; index < winners.length; index++) {
			DAI.transferFrom(address(this),winners[index],DAI.balanceOf(address(this)).div(winners.length));
		    historyWinners[roundNumber].push(winners[index]);
		}
	}

	function _changeState(LotteryState _newState) private {
		state = _newState;
		emit LotteryStateChanged(state);
	}
	function getHistoryWinners(uint ternNumber) public view returns(address[] memory) {
	    return historyWinners[ternNumber];
	}
	
	function _toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    function _substring(string memory str, uint startIndex, uint endIndex) internal returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex-startIndex);
        for(uint i = startIndex; i < endIndex; i++) {
            result[i-startIndex] = strBytes[i];
        }
        return string(result);
    }

}
