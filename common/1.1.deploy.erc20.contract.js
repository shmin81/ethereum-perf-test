
const fs = require("fs");
const path = require("path");
const Web3 = require('web3')
const utils = require('./utils')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const bytecode = fs.readFileSync(
	path.join(__dirname, "../contracts/SimpleToken.bin")
	//path.join(__dirname, "../contracts/EventEmitter.bin")
	//path.join(__dirname, "../contracts/EventEmitter_sol_EventEmitter.bin")
);

const args = process.argv.slice(2)
if (args.length != 1) {
  console.log('node  1.1.deploy.erc20.contract.js  configPath')
  process.exit(0)
}

let confPath = args[0]

let conf = null
let web3 = null
let accountFrom = null
async function init() {
	conf = utils.loadConf(confPath)
	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

	//let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl);
    web3 = new Web3(httpProvider)

	accountFrom = utils.convertPrivKeyToAccount(conf.ownerPrivKey)
	LOG(`Sender: ${accountFrom.address}`)

	let results = await web3.eth.getBlockNumber()
	LOG(`web3.eth.getBlockNumber() => ${results}`)
}

async function run() {
	LOG('  =======  run  =======')
	let results = null
	try {
        const txObject = {
            data: '0x' + bytecode
        }
        results = await web3.eth.estimateGas(txObject)
		LOG(`web3.eth.estimateGas() => ${results}`)

		let txNonce = await web3.eth.getTransactionCount(accountFrom.address, "pending")
        LOG(`web3.eth.getTransactionCount(${accountFrom.address}) => ${txNonce}`)

		txObject.nonce = web3.utils.numberToHex(txNonce)
        txObject.gasPrice = 0
        txObject.gasLimit = (results + 50000)

        LOG(`tx: ${JSON.stringify(txObject)}`)
        let signedObj = await web3.eth.accounts.signTransaction(txObject, accountFrom.privateKey);
        //LOG(`signed tx: ${JSON.stringify(signedObj)}`)

		let txResults = await web3.eth.sendSignedTransaction(signedObj.rawTransaction)
		LOG(`web3.eth.sendSignedTransaction() => ${JSON.stringify(txResults)}`)

        if (txResults.status == true) {
            LOG(` *** send tx - Seccess ***`)

			LOG (` * contractAddress: ${txResults.contractAddress}`)
			utils.deployNewErc20Contract(txResults.contractAddress, txResults.transactionHash)
        }
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init().then(() => {
	return run()
})
