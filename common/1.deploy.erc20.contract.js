
const fs = require("fs");
const path = require("path");
const Web3 = require('web3')
const utils = require('../common/utils')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const bytecode = fs.readFileSync(
	path.join(__dirname, "../contracts/SimpleToken.bin")
	//path.join(__dirname, "../contracts/EventEmitter.bin")
	//path.join(__dirname, "../contracts/EventEmitter_sol_EventEmitter.bin")
);

let conf = null
let web3 = null
let accountFrom = null
function init() {
	conf = utils.loadConf(confPath)
	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, { headers: conf.httpheaders });
    web3 = new Web3(httpProvider)

	accountFrom = utils.convertPrivKeyToAccount(conf.ownerPrivKey)
	LOG(`Sender: ${accountFrom.address}`)
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
        LOG(`signed tx: ${JSON.stringify(signedObj)}`)

		let txResults = await web3.eth.sendSignedTransaction(signedObj.rawTransaction)
		LOG(`web3.eth.sendSignedTransaction() => ${JSON.stringify(txResults)}`)

        if (txResults.status == true) {
            LOG(` *** send tx - Seccess ***`)

			LOG (' * contractAddress: ', txResults.contractAddress)
			utils.deployNewContract(conf, txResults.contractAddress, txResults.transactionHash)
        }
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
