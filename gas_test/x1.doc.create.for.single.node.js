// test
const fs = require('fs')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const crypto = require('crypto');

const utils = require('../common/utils')
const test = require('../common/test.doc')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const WRITE = (msg) => {
  fs.appendFileSync(debugLog, msg)
}

// Environment variables
const args = process.argv.slice(2)
if (args.length != 2) {
  console.log('node  doc.create.for.single.node.js  configPath  index(1~61) ')
  process.exit(0)
}

// Configurations from file
const confPath = args[0]
const conf = utils.loadConf(confPath)

const caseIdx = Number(args[1])
const caseCount = 16
//const caseCount = 250
const debugLog = `./test.create.doc.ids.log`

// In-memory status
let accounts = {}

const endpointConf = utils.loadJson(conf.endpointfile)
const httpRpcUrl = endpointConf[0]

INFO(`RPC: ${httpRpcUrl}, Contract: ${conf.docuAddress}`)
let docuCnt = 0
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
  //account.docuCnt = await test.getDocCount(account.sender)
  accounts[0] = account;
  docuCnt = await test.getDocCount(account.sender)

  return new Promise(function(resolve, reject) {
    resolve(true)
  })
}

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+ new Date() / 1000) + 365 * 24 * 60 * 60 // 1년 후?

async function createDocu(idx1, idx2) {
 
  const nonce = accounts[0].nonceLock++
  //const docNum = accounts[0].docuCnt++
  const docNum = idx2 + docuCnt
  const acc = accounts[0]
  let result = true
  try {
    //let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
    let documentId = getDocId(idx1, idx2)
    let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex');
    INFO(`[${docNum}] create docID: ${documentId} [${acc.sender} ${docNum}] -> filehash: ${fileHash}`)
    WRITE(`${docNum},${idx1},${idx2},${documentId},`)
    let egas = await test.createEstimateGas(acc.sender, documentId, fileHash)
    WRITE(`${egas},`)
    const request = test.createReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
    //const reqId = request.body.id;
    let response = await httpRequest.post(request)
    if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
      WRITE(`${response.body.result}`)
      INFO(`[${docNum}] createEstimateGas: ${egas} txid: ${response.body.result}`)
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

function getDocId(_idx, _docNum) {
  
  let last = Web3Utils.numberToHex(_docNum)
  if (last.startsWith('0x')){
    last = last.substring(2)
  }
  let lastLength = 64 - last.length
  let docId='0x'
  for (let j=0; j<lastLength; j++) {
    if (j<_idx) {
      docId += 'a'
    }
    else {
      docId += '1'
    }
  }
  docId += last
  INFO(`docId: ${docId} -> ${docId.length}`)

  return Web3Utils.hexToNumberString(docId)
}

async function main() {
  let result = true
  await prepare()

  for (let k=0; k<caseCount; k++) {

    result = await createDocu(caseIdx, k)
    WRITE('\n')
    if (!result) {
      ERROR(`err: ${result}`)
      process.exit(1)
    }
  }
}

main()