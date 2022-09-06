// SPDX-License-Identifier: MIT
pragma solidity >0.4.23 <0.9.0;
import "./ChainZDoc.sol";
import "./ChainZDocA.sol";
import "./ChainZDocB.sol";

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
        require(owners[msg.sender] == true, "No permission");
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
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 0;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        
        return address(identity);
    }

    function createDocIdentityA() public onlyOwner() returns(address) {
        ChainZDocA identity = new ChainZDocA();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 1;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
        contractDeployCount++;
        //contractDeployedTime[address(identity)] = block.timestamp;
        emit LogChainZDocCreated(address(identity), msg.sender);
        return address(identity);
    }

    function createDocIdentityB() public onlyOwner() returns(address) {
        ChainZDocB identity = new ChainZDocB();
        deployedContracts[contractDeployCount] = address(identity);
        deployedContractInfos[contractDeployCount].contractAddress = address(identity);
        deployedContractInfos[contractDeployCount].contractType = 2;
        deployedContractInfos[contractDeployCount].deployTimestamp = block.timestamp;
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
        require(idx < contractDeployCount, "out of range");
		return deployedContracts[idx];
	}

    function deployedContractInfo(uint idx) 
	    public view returns(address, uint256, uint256) 
	{
        require(idx < contractDeployCount, "out of range");
        DocService memory ds = deployedContractInfos[idx];
		return (
            ds.contractAddress,
            ds.contractType,
            ds.deployTimestamp
        );
	}

    /// @dev Allows an olderOwner to add a new owner instantly
    function addOwner(address newOwner) public onlyOwner() validAddress(newOwner) {
        require(owners[newOwner] == false, "Already registered");
        owners[newOwner] = true;
        emit LogOwnerAdded(newOwner, msg.sender);
    }

    /// @dev Allows an owner to remove another owner instantly
    function removeOwner(address owner) public onlyOwner() {
        // an owner should not be allowed to remove itself
        require(msg.sender != owner, "cannot remove self");
        require(owners[owner] == true, "Already un-registered");
        owners[owner] = false;
        emit LogOwnerRemoved(owner, msg.sender);
    }
}