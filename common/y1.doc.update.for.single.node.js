// erc20 transfer test
const fs = require('fs')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const crypto = require('crypto');

const utils = require('./utils')
const test = require('./test.doc')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const WRITE = (msg) => {
  fs.appendFileSync(debugLog, msg)
}

// Environment variables
const args = process.argv.slice(2)
if (args.length != 2) {
  console.log('node  doc.update.for.single.node.js  configPath  index(0~61)')
  process.exit(0)
}

// Configurations from file
const confPath = args[0]
const conf = utils.loadConf(confPath)

const caseIdx = Number(args[1])
let inputLog = `./test.create.doc.ids.log`
let debugLog = `./test.update.doc.${caseIdx}.log`


// In-memory status
let accounts = {}

const endpointConf = utils.loadJson(conf.endpointfile)
const httpRpcUrl = endpointConf[0]
INFO(`RPC: ${httpRpcUrl}, Contract: ${conf.docuAddress}`)

async function prepare() {

  let connection = null
  let httpProvider = {}

  const accountConf = utils.loadJson(conf.accountfile)

  httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
  connection = new Web3(httpProvider)

  let chainId = await connection.eth.getChainId()
  test.customChain(chainId)
  test.setTestEnv(httpRpcUrl, conf)

  const account = accountConf[0]
  account.senderPrivKeyBytes = Buffer.from(account.privKey, 'hex')
  account.nonceLock = await connection.eth.getTransactionCount(account.sender)
  account.startTxCount = account.nonceLock
  account.docuCnt = await test.getDocCount(account.sender)
  accounts[0] = account;

  return new Promise(function(resolve, reject) {
    resolve(true)
  })
}

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+ new Date() / 1000) + 365 * 24 * 60 * 60 + 24 * 60 * 60 * caseIdx // 1년 ?? 후

async function updateDocu(idx1, docNum, documentId) {
 
  const nonce = accounts[0].nonceLock++
  //const docNum = accounts[0].docuCnt++
  const acc = accounts[0]
  let result = true
  try {
    //let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
    //let documentId = getDocId(idx1, idx2)
    let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex');
    INFO(`update docID: ${documentId} [${acc.sender} ${docNum}] -> filehash: ${fileHash}`)
    WRITE(`${docNum},${idx1},${documentId},`)
    let egas = await test.updateEstimateGas(acc.sender, documentId, fileHash)
    WRITE(`${egas},`)
    const request = test.updateReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
    //const reqId = request.body.id;
    let response = await httpRequest.post(request)
    if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
      WRITE(`${response.body.result}`)
    }
    else {
      WRITE(`${response.body.error}`)
    }

  } catch (err) {
    ERROR(`It SHOULD NOT happen! - ${err}`)
    result = false
  }

  return new Promise(function(resolve, reject) {
    resolve(result)
    /*
    httpRequest.post(request)
      .then(response => {
        try {
          if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
            const output = { result: true, docNum, nonce, res: `${response.body.result}`, id: reqId }
            WRITE(`${response.body.result},`)
            resolve(true)
          } else {
            const output = { result: false, docNum, nonce, req: request, res: response.body.error }
            ERROR(`Need check! - ${JSON.stringify(output)}`)
            reject(false)
          }
        } catch (err) {
          ERROR(`It SHOULD NOT happen! - ${err}`)
          reject(err)
        }
      })
      .catch(err => {
        const output = { result: false, docNum, nonce, req: request, res: `NA`, error: `${err}` }
        ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
        reject(false)
      })*/
  })
}

async function main() {
  let result = true
  await prepare()

  let simContents = fs.readFileSync(inputLog).toString()
  let simLines = simContents.split(/\r\n|\n/)
  let allLines = simLines.length
  for (let i=0; i<allLines; i++) {
    const lineStr = simLines[i]
    if (lineStr.length < 2) continue
    const strs = lineStr.split(',')
    result = await updateDocu(caseIdx, strs[0], strs[3])

    WRITE('\n')
    if (!result) {
      process.exit(1)
    }
  }
}

main()