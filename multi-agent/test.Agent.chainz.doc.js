// erc20 transfer test
const fs = require('fs')
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const crypto = require('crypto');

const utils = require('../common/utils')
const test = require('../common/test.chainzdoc')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const DEBUG = (msg, showLog=true) => {
  if (saveLog) {
    fs.appendFileSync(debugLog, msg+'\n')
  }
  else if (showLog) {
    console.log(msg)
  }
}
//////////////////////////////////////
// 1. starting this server, DocManager is deploy new docService contract? (or get docuCount from deployed target docService)
//  1.1 check docService count and docuCount => if need, deploy? what is condition? 
// 2. when deploy and change? (when added over 100,000 docu, deploy new contract. and when added 200,000 docu , change target new contract.)
// 3. How to make new docId? index of target docService from DocManager + doc sequence of target docService (8 digit)

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.chainz.doc.js  portNumber  minerIdx  accountStartIdx configPath [ debug(false) ]')
  process.exit(0)
}
const port = Number(args[0])
const minerIdx = Number(args[1])
const startIdx = Number(args[2])

// Configurations from file
const confPath = args[3]
const conf = utils.loadConf(confPath)

let debugLog = `./test.doc.node${minerIdx}.log`
let saveLog = false
if (args.length == 5) {
  if (args[4].toLowerCase() === 'true') {
    saveLog = true
    fs.writeFileSync(debugLog, `${new Date().toISOString()} [INFO] ${port} ${minerIdx} ${startIdx} ${confPath}\n`)
  }
}

// In-memory status
let accounts = {}
let acountCnt = 0
let acountLock = 0
let successCount = 0

let httpRpcUrl = null
let accountFrom = null  // to deploy
// Express
const app = express()
app.use((req, res, next) => next())
app.use(express.urlencoded({extended: false}))
app.use(express.json())

const server = http.createServer(app);
server.listen(port, async () => {

  INFO(`Listen on port ${port}!!!`)
  acountCnt = conf.numberOfAccounts
  
	const endpointConf = utils.loadJson(conf.endpointfile)
  httpRpcUrl = endpointConf[minerIdx]
  INFO(`RPC: ${httpRpcUrl}, Contract: ${conf.docuAddress}`)

  // account
	const accountConf = utils.loadJson(conf.accountfile)

	try {
    let connection = null
    let httpProvider = {}

    httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    connection = new Web3(httpProvider)

    let chainId = await connection.eth.getChainId()
    test.customChain(chainId)
    test.setTestEnv(httpRpcUrl, conf)

    accountFrom = utils.convertPrivKeyToAccount(conf.ownerPrivKey)
	  INFO(`deploy sender: ${accountFrom.address}`)

    await setDocServiceAddress(minerIdx, endpointConf.length)

    INFO(`gas: (deploy docService) ${await test.deployEstimateGas(accountFrom.address)}`)
    INFO(`gas: (create document) ${await test.createEstimateGas(accountFrom.address)}`)
    

    for (let i=0; i<acountCnt; i++) {

      const account = accountConf[i+startIdx]
      account.senderPrivKeyBytes = Buffer.from(account.privKey, 'hex')

      account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      account.startTxCount = account.nonceLock

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

async function deployNewService() {

  let resp = test.ethReq('eth_getTransactionCount', [accountFrom.address, 'latest'])
  let req = test.deployReq(conf.ownerPrivKey, Web3Utils.hexToNumber(resp))
  resp = await utils.sendHttp(req)
  // txReceipt?
  test.setDocServiceContractAddress()
  
}

async function setDocServiceAddress(nodeIdx, nodeCnt) {
  let numDeploy = await test.getDeployDocCount()
  let selectIdx = numDeploy - nodeCnt + nodeIdx
  if (selectIdx < 0) {
    await deployNewService()
  }
  else {
    let targetAddress = await test.getDeployDocAddress(selectIdx)
    test.setDocServiceContractAddress(targetAddress)
  }
}

let docServiceCnt=0
async function setDocCount() {
  docServiceCnt = await test.getDocCount()
}

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+ new Date() / 1000) + 365 * 24 * 60 * 60 // 1년 후?

const deployDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  const acc = accounts[accIdLock]

  let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex');
  DEBUG(`deploy new docService`)
  
  const request = test.deployReq(acc.senderPrivKeyBytes, nonce)
  const reqId = request.body.id;

  let sendTime = new Date()
  httpRequest.post(request)
    .then(response => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          //INFO(`Success! - ${JSON.stringify(output)}`)
          DEBUG(`${sendTime.valueOf()} ${response.body.result}`)
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
          successCount++
        } else {
          // console.dir(response)
          const output = { result: false, accIdx: accIdLock, nonce, req: request, res: response.body.error }
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
      const output = { result: false, accIdx: accIdLock, nonce, req: request, res: `NA`, error: `${err}` }
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
      res.status(500)
      res.set('Content-Type', 'application/json;charset=utf8')
      res.json(output)
    })
}

const createDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  //const docNum = accounts[accIdLock].docuCnt++
  const docNum = docServiceCnt++
  const acc = accounts[accIdLock]

  let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex');
  DEBUG(`create docID: ${documentId} [${acc.sender} ${docNum}] -> filehash: ${fileHash}, expiredDate: ${expiredDate}`)
  
  const request = test.createReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
  const reqId = request.body.id;

  let sendTime = new Date()
  httpRequest.post(request)
    .then(response => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          //INFO(`Success! - ${JSON.stringify(output)}`)
          DEBUG(`${sendTime.valueOf()} ${response.body.result}`)
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
          successCount++
        } else {
          // console.dir(response)
          const output = { result: false, accIdx: accIdLock, nonce, req: request, res: response.body.error }
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
      const output = { result: false, accIdx: accIdLock, nonce, req: request, res: `NA`, error: `${err}` }
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

const txpool = async (req, res) => {

  let reqTxpool = utils.getPostRequest(httpRpcUrl, 'txpool_besuStatistics')
  try {
    let resp = await utils.sendHttp(reqTxpool)
    const output = { result: (resp.localCount + resp.remoteCount) }
    //INFO(`Success! - ${JSON.stringify(output)}`)
    res.status(200)
    res.set('Content-Type', 'application/json;charset=utf8')
    res.json(output)
  }
  catch (err) {
    ERROR(`It SHOULD NOT happen! - ${JSON.stringify(err)}`)
    res.status(500)
    res.set('Content-Type', 'application/json;charset=utf8')
    res.json({ result: false, req, send:reqTxpool, error: err })
    //process.exit(1)
  }
}

const serverExit = async (req, res) => {

  INFO(`/serverExit`)
  const output = { result: true }
  //INFO(`Success! - ${JSON.stringify(output)}`)
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(output)

  process.exit(0)
}

const controlMsg = async (req, res) => {

  INFO(`/message`)
  let msg = null
  let ps = getParams(req.body)
  if (Array.isArray(ps)) {
    msg = String(ps[0])
    INFO(`[SYSCMD] ${msg}`)
  }

  const output = { result: (msg == null ? false : true), message: msg }
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(output)
}

function getParams(_reqBody) {
  if (_reqBody.params != undefined) {
    return _reqBody.params
  }
  //console.log('body1', _reqBody)
  let bodyStr = JSON.stringify(_reqBody)
  //console.log('body2', bodyStr, bodyStr.lastIndexOf('['), bodyStr.lastIndexOf(']'))
  let budyStrSub = bodyStr.substring(bodyStr.lastIndexOf('[')+3, bodyStr.lastIndexOf(']')-2)
  //console.log('body3', budyStrSub)

  if (budyStrSub.length < 4) {
    // param data length
    return undefined  
  }
  if (budyStrSub.indexOf(',') > -1) {
    // param은 1개만 존재해야 됨
    return undefined  
  }
  return [ budyStrSub ]
}

const router = express.Router()
router.route('/prepare').post(deployDocu)   // deployDocument
router.route('/transfer').post(createDocu)  // createDocument
//router.route('/transferMulti').post(updateDocu2)  // createDocument2
router.route('/transferCount').get(transferCount)
router.route('/txpool').get(txpool)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)
router.route('/message').post(controlMsg)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
