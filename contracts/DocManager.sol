// SPDX-License-Identifier: MIT
pragma solidity >0.4.23 <0.9.0;
import "./ChainZDoc.sol";

// solc DocManager.sol  --bin --abi --optimize --overwrite -o .

contract DocManager {

    event LogChainZDocCreated(
        address indexed createdAddress,
        address deployer);

    event LogOwnerAdded(
        address indexed owner,
        address instigator);

    event LogOwnerRemoved(
        address indexed owner,
        address instigator);

    uint contractDeployCount;
    mapping(address => bool) owners;
    mapping(uint => address) deployedContracts;     // contract 배포 순서?? (단순히 contract의 배포 순서가 몇번쨰인지??)
    //mapping(address => uint) contractDeployedTime;  // contract 배포 시간? (배포되는 contract 관련 business logic)
    
    modifier onlyOwner() {
        require(owners[msg.sender] == true, "NO_PERMISSION");
        _;
    }

    modifier validAddress(address addr) { //protects against some weird attacks
        require(addr != address(0));
        _;
    }

    constructor() {
		contractDeployCount = 0;
        owners[msg.sender] = true;
	}

    function createDocIdentity() public onlyOwner() returns(address) {
        ChainZDoc identity = new ChainZDoc();
        deployedContracts[contractDeployCount] = address(identity);
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        return address(identity);
    }

    function deployedCount() public view returns(uint) {
        return contractDeployCount;
    }

    function deployedAddress(uint idx) 
	    public view returns(address) 
	{
        require(idx < contractDeployCount, "OUT_OF_INDEX_RANGE");
		return deployedContracts[idx];
	}

    /// @dev Allows an olderOwner to add a new owner instantly
    function addOwner(address newOwner) public onlyOwner() validAddress(newOwner) {
        require(owners[newOwner] == false, "ALREADY_EXISTED");
        owners[newOwner] = true;
        emit LogOwnerAdded(newOwner, msg.sender);
    }

    /// @dev Allows an owner to remove another owner instantly
    function removeOwner(address owner) public onlyOwner() {
        // an owner should not be allowed to remove itself
        require(msg.sender != owner, "NO_PERMISSION");
        require(owners[owner] == true, "NOT_EXISTED");
        owners[owner] = false;
        emit LogOwnerRemoved(owner, msg.sender);
    }
}