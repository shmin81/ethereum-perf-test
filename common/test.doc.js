
const Common = require('@ethereumjs/common').default
let customChain = null
exports.customChain = function (chainId, forkStr='istanbul') {
    let networkComm = { chainId, networkId: chainId, defaultHardfork: forkStr }
    //console.log(networkComm)
    customChain = Common.custom(networkComm)
    return customChain
}

const ABIHelper = require('./abi')
const httpRequest = require('request-promise')
const { Transaction } = require('@ethereumjs/tx')
const Web3_Utils = require('web3-utils')

let contractAddr = null;
let createGasHex = '0x249F0'
let updateGasHex = '0x186A0'
const gasUp = 10000

const createObj = {
    "inputs":[{"name": "_id","type": "uint256"},{"name": "_fileHash","type": "bytes32"},{"name": "_expTimestamp","type": "uint256"}],
    "name":"createDocument",
    "type":"function"
}
const updateObj = {
    "inputs":[{"name": "_id","type": "uint256"},{"name": "_fileHash","type": "bytes32"},{"name": "_expTimestamp","type": "uint256"}],
    "name":"updateDocument",
    "type":"function"
}
const checkObj = {
    "inputs":[{"name": "_id","type": "uint256"},{"name": "_fileHash","type": "bytes32"}],
    "name":"checkDocument",
    "type":"function"
}
const getDocObj = {
    "inputs":[{"name": "_id","type": "uint256"}],
    "name":"getDocument",
    "type":"function"
}
const getDocCntObj = {
    "inputs":[{"name": "_owner","type": "address"}],
    "name":"getDocumentCount",
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

exports.setTestEnv = function (_httpRpcUrl, _config, _gas=200000) {

    contractAddr = _config.docuAddress
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

exports.createEstimateGas = function (senderAddr, _id=12345, _fileHash='0x11111111111111111111111111111111ffffffffffffffffffffffffffffffff') {
    const txData = {
        from: senderAddr,
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(createObj, [`${_id}`, `${_fileHash}`, `${Math.ceil(+ new Date() / 100)}`])
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
                createGasHex = Web3_Utils.numberToHex(_gas + gasUp)
                // update가 불가능한 상황??
                updateGasHex = Web3_Utils.numberToHex(Math.floor(_gas/3))
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

exports.updateEstimateGas = function (senderAddr, _id=1, _fileHash='0x11111111111111111111111111111111ffffffffffffffffffffffffffffffff') {
    const txData = {
        from: senderAddr,
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(updateObj, [`${_id}`, `${_fileHash}`, `${Math.ceil(+ new Date() / 100)}`])
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
                updateGasHex = Web3_Utils.numberToHex(_gas + gasUp)
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

exports.createReq = function (senderKey, nonce, _id, _fileHash, _expTimestamp) {

    const hrTime = process.hrtime()
    const reqId = hrTime[0] * 1000000000 + hrTime[1]

    const txData = {
        nonce: `${Web3_Utils.toHex(nonce)}`,
        gasLimit: createGasHex,
        gasPrice: '0x00', // 10 Gwei
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(createObj, [`${_id}`, `${_fileHash}`, `${_expTimestamp}`])
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
exports.updateReq = function (senderKey, nonce, _id, _fileHash, _expTimestamp) {

    const hrTime = process.hrtime()
    const reqId = hrTime[0] * 1000000000 + hrTime[1]

    const txData = {
        nonce: `${Web3_Utils.toHex(nonce)}`,
        gasLimit: updateGasHex,
        gasPrice: '0x00', // 10 Gwei
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(updateObj, [`${_id}`, `${_fileHash}`, `${_expTimestamp}`])
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

const callDocuBody = {
    jsonrpc:"2.0",
    method:"eth_call",
    params:[],
    id: 100
}
exports.check = function (_id, _fileHash) {

    const txData = {
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(checkObj, [`${_id}`, `${_fileHash}`])
    }
    callDocuBody.params = [txData, "latest"]
    callDocuBody.id++
    //console.log(txData)
    request.body = callDocuBody

    return new Promise(function(resolve, reject) {
      httpRequest.post(request)
        .then(response => {
            if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
                resolve(Web3_Utils.hexToNumber(response.body.result))
            }
            else {
                console.error(response.body)
            }
        })
        .catch(err => {
            console.error(err)
        })
    })
}

exports.getDoc = function (_id) {

    const txData = {
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(getDocObj, [`${_id}`])
    }
    callDocuBody.params = [txData, "latest"]
    callDocuBody.id++
    //console.log(txData)
    request.body = callDocuBody

    return new Promise(function(resolve, reject) {
      httpRequest.post(request)
        .then(response => {
            if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
                let resStr = response.body.result
                //console.log(resStr)
                let docObj = {
                    id: Web3_Utils.hexToNumberString(resStr.substring(0, 2+64)),
                    filehash: '0x'+resStr.substring(2+64, 2+64*2),
                    regTimestamp:  Web3_Utils.hexToNumber('0x'+resStr.substring(2+64*2, 2+64*3)),
                    expiredTime:  Web3_Utils.hexToNumber('0x'+resStr.substring(2+64*3, 2+64*4)),
                    owner: '0x'+resStr.substring(26+64*4, 2+64*5),
                    actived: Number(resStr.substring(2+64*5, 2+64*6))
                }
                resolve(docObj)
                // resolve(response.body.result)
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

exports.getDocCount = function (account) {

    const txData = {
        to: contractAddr,
        data: ABIHelper.getCallDataByABI(getDocCntObj, [`${account}`])
    }
    callDocuBody.params = [txData, "latest"]
    callDocuBody.id++
    //console.log(txData)
    request.body = callDocuBody

    return new Promise(function(resolve, reject) {
      httpRequest.post(request)
        .then(response => {
            if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
                resolve(Web3_Utils.hexToNumber(response.body.result))
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
