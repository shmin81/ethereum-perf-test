
//const fs = require("fs");
//const { Address } = require('ethereumjs-util')
const Web3Utils = require('web3-utils');

const utils = require('./utils')
const test = require('./test.erc20')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

//=============================
const value = 100000
//const abiPath = "../contracts/SimpleToken.abi"
//=============================
const args = process.argv.slice(2)
if (args.length != 1) {
  console.log('node  1.2.deposit.erc20.js  configPath')
  process.exit(0)
}

let confPath = args[0]

let conf = null
let accountFrom = null
let accountConf = null
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

    accountConf = utils.loadJson(conf.accountfile)

    test.setTestEnv(httpRpcUrl, conf)
    request = test.ethReq('eth_chainId')
    response = await utils.sendHttp(request)
    let chainId = Web3Utils.hexToNumber(response)
    LOG(`ChainId: ${chainId} ${response}`)
    test.customChain(chainId)
}

async function run() {

    request = test.ethReq('eth_getTransactionCount', [accountFrom.address, 'latest'])
    response = await utils.sendHttp(request)
    senderNonce = Web3Utils.hexToNumber(response)
    //LOG(`NONCE: ${senderNonce} ${response}`)

    response = await test.balanceOf(accountFrom.address)
    LOG(`* token owner's balance: ${response}`)

    const acountCnt = accountConf.length
    LOG(`* target account count: ${acountCnt}`)

    for (let i=0; i<acountCnt; i++) {
        const acc = accountConf[i]
        request = test.transferReq(accountFrom.privKeyBuf, acc.sender, senderNonce, value)
        senderNonce++
        response = await utils.sendHttp(request)
        LOG(`${i} => txid: ${response}`)
    }
    LOG('done.')
}

init()
run()
