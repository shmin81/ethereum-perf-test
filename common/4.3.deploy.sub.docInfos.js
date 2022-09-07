
//const fs = require("fs");
//const { Address } = require('ethereumjs-util')
const Web3Utils = require('web3-utils');

const utils = require('./utils')
const test = require('./test.chainzdoc')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const args = process.argv.slice(2)
if (args.length != 1) {
  console.log('node  3.3.deploy.sub.docInfos.js  configPath')
  process.exit(0)
}

let confPath = args[0]

let conf = null
let accountFrom = null
let request
let response
let httpRpcUrl

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
        LOG(`deploy docService count: ${await test.getDeployDocCount()}`)

        response = await test.getDeployDocCount()
        LOG(`deployedCount().call() => ${response}`)
        let newContractIdx = response - 1
        let getObj = { "inputs":[{"name": "idx","type": "uint256"}], "name":"deployedContractInfo", "type":"function" }

        if (newContractIdx > 0) {
            for (let i=0; i<response; i++) {
                let docContractAddress = await test.getDeployDocAddress(i)
                let docContractAddressX = await test.getFromDocManager(getObj, [ i ])
                test.setDocServiceContractAddress(docContractAddress)
                let docCount = await test.getDocCount()
                LOG(`deployedAddress(${i}).call() => ${docContractAddress} (docuCount: ${docCount}) ${JSON.stringify(docContractAddressX)}`)
            }
        }
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
