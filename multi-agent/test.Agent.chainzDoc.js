// erc20 transfer test
const fs = require('fs')
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const crypto = require('crypto');

const utils = require('../common/utils')
const test = require('../common/test.chainzDoc')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.chainzDoc.js  portNumber  minerIdx  accountStartIdx configPath')
  process.exit(0)
}
const port = Number(args[0])
const minerIdx = Number(args[1])
const startIdx = Number(args[2])

// Configurations from file
let confPath = null
if (args.length == 4) {
  confPath = args[3]
}
const conf = utils.loadConf(confPath)

// In-memory status
let accounts = {}
let acountCnt = 0
let acountLock = 0
let successCount = 0

let txGasLimit = 150000

// Express
const app = express()
app.use((req, res, next) => next())
app.use(express.urlencoded({extended: false}))
app.use(express.json())

const server = http.createServer(app);
server.listen(port, async () => {

  INFO(`Listen on port ${port}!!!`)
  
  INFO(`Contract: ${conf.docuAddress}`)
  acountCnt = conf.numberOfAccounts
  
	const endpointConf = utils.loadJson(conf.endpointfile)
  httpRpcUrl = endpointConf[minerIdx]
  INFO(`RPC: ${httpRpcUrl}`)

  // account
	const accountConf = utils.loadJson(conf.accountfile)

	try {
    let connection = null
    let httpProvider = {}

    httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    connection = new Web3(httpProvider)

    let chainId = await connection.eth.getChainId()
    test.customChain(chainId)
    test.setTestEnv(httpRpcUrl, conf, txGasLimit)


    for (let i=0; i<acountCnt; i++) {

      const account = accountConf[i+startIdx]
      account.senderPrivKeyBytes = Buffer.from(account.privKey, 'hex')

      account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      account.startTxCount = account.nonceLock

      account.docuCnt = await test.getDocCount(account.sender)

      accounts[i] = account;
      INFO(`Account[${i}]: ${JSON.stringify(account)}`)
    }
    
  } catch(err) {
    ERROR(`web3 Error occurred: ${err}`)
    //process.exit(1)
	}
})

server.on('error', (error) => {
  ERROR(`Server Error occurred: ${error}`)
  //process.exit(1)
})

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+ new Date() / 1000) + 365 * 24 * 60 * 60 // 1년 후?

const createDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  const docNum = accounts[accIdLock].docuCnt++
  const acc = accounts[accIdLock]
  let id_str = acc.sender + docNum.toString()
  let documentId = Web3Utils.hexToNumberString(id_str)
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId).digest('hex');
  INFO(`docID: ${documentId} [${id_str}] -> filehash: ${fileHash}`)
  const request = test.createReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
  const reqId = request.body.id;

  let sendTime = (new Date()).toISOString()
  httpRequest.post(request)
    .then(response => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          INFO(`Success! - ${JSON.stringify(output)}`)
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
          successCount++
        } else {
          // console.dir(response)
          const output = { result: false, accIdx: accIdLock, nonce, req: request, res: response.body.error, id: reqId }
          ERROR(`Need check! - ${JSON.stringify(output)}`)
          res.status(500)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
        }
      } catch (err) {
        ERROR(`It SHOULD NOT happen! - ${err}`)
        //process.exit(1)
      }
    })
    .catch(err => {
      const output = { result: false, accIdx: accIdLock, nonce, res: `NA`, id: reqId, error: `${err}` }
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
      res.status(500)
      res.set('Content-Type', 'application/json;charset=utf8')
      res.json(output)
    })
}

const updateDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  const docNum = accounts[accIdLock].docuCnt  // 마지막 docu만 update?
  const acc = accounts[accIdLock]
  let id_str = acc.sender + docNum.toString()
  let documentId = Web3Utils.hexToNumberString(id_str)
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId + Web3Utils.numberToHex(nonce)).digest('hex');
  INFO(`docID: ${documentId} [${id_str}] -> filehash: ${fileHash}`)
  const request = test.updateReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
  const reqId = request.body.id;

  let sendTime = (new Date()).toISOString()
  httpRequest.post(request)
    .then(response => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          INFO(`Success! - ${JSON.stringify(output)}`)
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
          successCount++
        } else {
          // console.dir(response)
          const output = { result: false, accIdx: accIdLock, nonce, req: request, res: response.body.error, id: reqId }
          ERROR(`Need check! - ${JSON.stringify(output)}`)
          res.status(500)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
        }
      } catch (err) {
        ERROR(`It SHOULD NOT happen! - ${err}`)
        //process.exit(1)
      }
    })
    .catch(err => {
      const output = { result: false, accIdx: accIdLock, nonce, res: `NA`, id: reqId, error: `${err}` }
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
      res.status(500)
      res.set('Content-Type', 'application/json;charset=utf8')
      res.json(output)
    })
}

const transferCount = async (req, res) => {
  const output = { result: true, successTxCount: successCount, senders: acountCnt }
  //INFO(`Success! - ${JSON.stringify(output)}`)
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(output)
}

const serverExit = async (req, res) => {
  const output = { result: true }
  //INFO(`Success! - ${JSON.stringify(output)}`)
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(output)

  ERROR(`serverExit`)
  //process.exit(0)
}

const router = express.Router()
router.route('/prepare').post(createDocu)   // createDocument
router.route('/transfer').post(updateDocu) // updateDocument
router.route('/transferCount').get(transferCount)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
