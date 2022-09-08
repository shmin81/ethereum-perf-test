// SPDX-License-Identifier: MIT
pragma solidity >0.4.23 <0.9.0;
import "./ChainZDoc.sol";
import "./ChainZDocA.sol";
import "./ChainZDocB.sol";
import "./ChainZDocC.sol";

// solc DocManagerMulti.sol  --bin --abi --optimize --overwrite -o .

contract DocManagerMulti {

    event LogChainZDocCreated(
        address indexed createdAddress,
        address deployer);

    event LogOwnerAdded(
        address indexed owner,
        address instigator);

    event LogOwnerRemoved(
        address indexed owner,
        address instigator);

    struct DocService {
        address contractAddress;
        uint256 contractType;
        uint256 deployTimestamp;
    }

    uint256 contractDeployCount;
    
    mapping(address => bool) owners;
    mapping(uint => address) deployedContracts;     // contract 배포 순서?? (단순히 contract의 배포 순서가 몇번쨰인지??)
    mapping(uint => DocService) deployedContractInfos;
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

    function createDocIdentity() public onlyOwner() returns(bool) {
        ChainZDoc identity = new ChainZDoc();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 0;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        return true;
    }

    function createDocIdentityA() public onlyOwner() returns(bool) {
        ChainZDocA identity = new ChainZDocA();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 1;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        return true;
    }

    function createDocIdentityB() public onlyOwner() returns(bool) {
        ChainZDocB identity = new ChainZDocB();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 2;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        return true;
    }

    function createDocIdentityC() public onlyOwner() returns(bool) {
        ChainZDocC identity = new ChainZDocC();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 3;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        
        return true;
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

    function deployedContractInfo(uint idx) 
	    public view returns(address, uint256, uint256) 
	{
        require(idx < contractDeployCount, "OUT_OF_INDEX_RANGE");
        DocService memory ds = deployedContractInfos[idx];
		return (
            ds.contractAddress,
            ds.contractType,
            ds.deployTimestamp
        );
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