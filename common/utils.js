const fs = require('fs');

const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)
const defaultConfigDir = '../configs/'
let confPath = null
let confContent = null;
let conf = null;
exports.loadConf = function(_confPath) {

    confPath = checkPath(_confPath)
    
    confContent = fs.readFileSync(confPath, 'utf8')
    // const conf = JSON.parse(confContent)
    conf = JSON.parse(confContent)

    if (conf.ownerPrivKey.indexOf('0x') == 0){
        conf.ownerPrivKey = conf.ownerPrivKey.substring(2)
    }

    if (conf.jwt != undefined && conf.jwt.length > 30) {
        conf.httpheaders= { "Content-Type": "application/json", "Authorization": "Bearer " + conf.jwt }
    }
    else {
        conf.httpheaders= { "Content-Type": "application/json" }
    }

    return conf
}

exports.getweb3HttpHeader = function (conf) {

    const httpOptions = {
        headers: [
            { name: "Content-Type", value: "application/json"}
        ]
    };
    if (conf.jwt != undefined && conf.jwt.length > 30) {
        httpOptions.headers.push({ name: "Authorization", value: "Bearer " + jwt_token })
    }
    return httpOptions
}

function checkPath(_confPath) {
    if (fs.existsSync(_confPath) == false) {
        if (fs.existsSync(defaultConfigDir + _confPath) == false) {
            ERROR(`Not found: ${_confPath}`)
            process.exit(1)
        }
        else {
            return defaultConfigDir + _confPath
        }
    }
    return _confPath
}

exports.loadJson = function (path) {

    path = checkPath(path)
    const jsonContent = fs.readFileSync(path, 'utf8')
    return JSON.parse(jsonContent)
}

exports.sleep = function (ms) {
    const wakeUpTime = Date.now() + ms;
    while (Date.now() < wakeUpTime) { }
}

const { Address } = require('ethereumjs-util')
exports.convertPrivKeyToAccount = function (privkey) {
    if (privkey.indexOf('0x') == 0){
        privkey = privkey.substring(2)
    }
    let privKeyBuf = Buffer.from(privkey, 'hex')
    let addressBuf = Address.fromPrivateKey(privKeyBuf)
    let address = addressBuf.toString('hex')
    return {
            address,
            privKeyBuf,
            privateKey: `0x${privkey}`
        }
}

exports.deployNewErc20Contract = function (contractAddress, transactionHash=null) {
    const confObj = JSON.parse(confContent)
    confObj.erc20Address = contractAddress
    let outStr = JSON.stringify(confObj, null, 2)
    fs.writeFileSync(confPath, outStr)
    // log ??
}

exports.deployNewDocuContract = function (contractAddress, transactionHash=null) {
    const confObj = JSON.parse(confContent)
    confObj.docuAddress = contractAddress
    let outStr = JSON.stringify(confObj, null, 2)
    fs.writeFileSync(confPath, outStr)
    // log ??
}

const _request = {
    method: 'POST',
    uri: null,
    json: true,
    headers: { "Content-Type": "application/json"},
    resolveWithFullResponse: true,
    timeout: 5000,
    body: []
}
// http header??? JWT ?????? ????????? ?????? ?????????.
exports.getPostRequest = function (_url, _method, _params = [], _id = 1) {

    _request.uri = _url
    _request.body = {
        jsonrpc: "2.0",
        method: _method,
        params: _params,
        id: _id
    }
    return _request
}

const httpRequest = require('request-promise')
exports.sendHttp = function (req) {
    return new Promise(function(resolve, reject) {
        httpRequest.post(req)
            .then(response => {
                //if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
                if (response.body.error == undefined && response.body.result !== undefined) {
                    resolve(response.body.result)
                }
                else {
                    reject(response.body)
                }
            })
            .catch(err => {
                console.error(err)
            })
    })
}