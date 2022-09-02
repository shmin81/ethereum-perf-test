
//const fs = require("fs");
//const { Address } = require('ethereumjs-util')
const Web3Utils = require('web3-utils');

const utils = require('./utils')
const test = require('./test.erc20')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const args = process.argv.slice(2)
if (args.length != 1) {
  console.log('node  3.2.deploy.sub.doc.js  configPath')
  process.exit(0)
}

let confPath = args[0]

let conf = null
let accountFrom = null
let senderNonce = 0
let request
let response

async function init() {
	conf = utils.loadConf(confPath)
	LOG(JSON.stringify(conf))

    accountFrom = utils.convertPrivKeyToAccount(conf.ownerPrivKey)
	LOG(`Sender: ${accountFrom.address}`)
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

	test.setTestEnv(httpRpcUrl, conf)
    request = test.ethReq('eth_chainId')
    response = await utils.sendHttp(request)
    let chainId = Web3Utils.hexToNumber(response)
    LOG(`ChainId: ${chainId} ${response}`)
    test.customChain(chainId)
}

async function run() {
	LOG('  =======  run  =======')
	let results = null
	try {
        LOG(`gas: (deploy docService) ${await test.deployEstimateGas(accountFrom.address)}`)

        request = test.ethReq('eth_getTransactionCount', [accountFrom.address, 'latest'])
        response = await utils.sendHttp(request)
        senderNonce = Web3Utils.hexToNumber(response)
        LOG(`eth_getTransactionCount(${accountFrom.address}) => ${senderNonce}`)

        request = test.deployReq(conf.ownerPrivKey, senderNonce)
        response = await utils.sendHttp(request)

        //////  수정해야됨 .....

        if (txResults.status == true) {
            LOG(` *** send tx - Seccess ***`)

			LOG (` * contractAddress: ${txResults.contractAddress}`)
			utils.deployNewChainzDocContract(txResults.contractAddress, txResults.transactionHash)
        }
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
