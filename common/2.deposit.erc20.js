
const fs = require("fs");
const { Address } = require('ethereumjs-util')
const Web3Utils = require('web3-utils');

const utils = require('../common/utils')
const test = require('../common/test.erc20')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

//=============================
const value = 100000
const abiPath = "../contracts/SimpleToken.abi"
//=============================
let conf = null
let accountFrom = null
let accountConf = null
let abiObj = null
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

    abiObj = utils.loadJson(abiPath)

    test.setTestEnv(httpRpcUrl, conf)
    request = test.ethReq('eth_chainId')
    response = await utils.sendHttp(request)
    test.customChain(response)

    request = test.ethReq('eth_getTransactionCount', [accountFrom.address, 'latest'])
    response = await utils.sendHttp(request)
    senderNonce = Web3Utils.hexToNumber(response)
}

async function run() {

    const acountCnt = accountConf.length
    LOG(`Account Count: ${acountCnt}`)

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
