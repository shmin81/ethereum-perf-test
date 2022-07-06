
const Common = require('@ethereumjs/common').default
let customChain = null
exports.customChain = function (chainId, forkStr='istanbul') {
    let networkComm = { chainId, networkId: chainId, defaultHardfork: forkStr }
    //console.log(networkComm)
    customChain = Common.custom(networkComm)
    return customChain
}

const ABIHelper = require('../common/abi')
const httpRequest = require('request-promise')
const { Transaction } = require('@ethereumjs/tx')
const Web3_Utils = require('web3-utils')

let contractAddr = null;
let gasHex = null
const transferObj = {
    "inputs":[{"name": "_to","type": "address"},{"name": "_amount","type": "uint256"}],
    "name":"transfer",
    "type":"function"
}
const balanceOfObj = {
    "inputs":[{"name": "_owner","type": "address"}],
    "name":"balanceOf",
    "type":"function"
}
const request = {
    method: 'POST',
    uri: null,
    json: true,
    headers: { "Content-Type": "application/json"},
    resolveWithFullResponse: true,
    timeout: 5000,
    body: []
}

exports.setTestEnv = function (_httpRpcUrl, _config, _gas=70000) {

    contractAddr = _config.erc20Address
    gasHex = Web3_Utils.toHex(_gas);
    request.uri = _httpRpcUrl
    request.headers = _config.httpheaders

    if (contractAddr == undefined || contractAddr == null || !contractAddr.startsWith('0x')) {
        throw new Error('wrong contract address')
    }
}

const estimateGasDocuBody = {
    jsonrpc:"2.0",
    method:"eth_estimateGas",
    params:[],
    id: 1
}

exports.transferEstimateGas = function (senderAddr, receiver) {
    const txData = {
        from: senderAddr,
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(transferObj, [`${receiver}`, 1])
    }
    estimateGasDocuBody.params = [ txData ]
    estimateGasDocuBody.id++
    //console.log(txData)
    request.body = estimateGasDocuBody

    return new Promise(function(resolve, reject) {
      httpRequest.post(request)
        .then(response => {
            if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
                let _gas = Web3_Utils.hexToNumber(response.body.result)
                gasHex = Web3_Utils.numberToHex(_gas + 1000)
                resolve(_gas)
            }
            else {
                console.error(response.body)
                // 초기 상태 검증 => contract 불일치(?)
                process.exit(2)
            }
        })
        .catch(err => {
            console.error(err)
            // 초기 상태 검증 => contract 불일치(?)
            process.exit(2)
        })
    })
}

exports.transferReq = function (senderKey, receiver, nonce, amount=1) {

    const hrTime = process.hrtime()
    const reqId = hrTime[0] * 1000000000 + hrTime[1]

    const txData = {
        nonce: `${Web3_Utils.toHex(nonce)}`,
        gasLimit: gasHex,
        gasPrice: '0x00', // 10 Gwei
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(transferObj, [`${receiver}`, amount])
    }
    
    // sign the transaction
    const txObj = Transaction.fromTxData(txData, { common: customChain })
    //console.log(`tx: ${JSON.stringify(txObj)}`)
    const signedObj = txObj.sign(senderKey)
    //console.log(`signed tx: ${JSON.stringify(signedObj)}`)
    const signedTx = signedObj.serialize().toString('hex')

    // fire away!
    const _body = {
        jsonrpc:"2.0",
        method:"eth_sendRawTransaction",
        params:[`0x${signedTx}`],
        id: reqId
    }

    return {
        method: 'POST',
        uri: request.uri,
        json: true,
        headers: request.headers,
        resolveWithFullResponse: true,
        timeout: 5000,
        body: _body
    }
}

let reqId = 10000
exports.ethReq = function (method, params=[]) {
    // fire away!
    const _body = {
        jsonrpc:"2.0",
        method,
        params,
        id: reqId++
    }

    return {
        method: 'POST',
        uri: request.uri,
        json: true,
        headers: request.headers,
        resolveWithFullResponse: true,
        timeout: 5000,
        body: _body
    }
}

const balanceOfBody = {
    jsonrpc:"2.0",
    method:"eth_call",
    params:[],
    id: 0
}
exports.balanceOf = function (account) {

    const txData = {
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(balanceOfObj, [`${account}`])
    }
    balanceOfBody.params = [txData, "latest"]
    balanceOfBody.id++
    //console.log(txData)
    request.body = balanceOfBody

    return new Promise(function(resolve, reject) {
      httpRequest.post(request)
        .then(response => {
            if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
                resolve(Web3_Utils.hexToNumber(response.body.result))
            }
            else {
                console.error(response)
            }
        })
        .catch(err => {
            console.error(err)
        })
    })
}