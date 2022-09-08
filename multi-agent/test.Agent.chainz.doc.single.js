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
//  2.1 if 4 node, id 0 node only deploy. and each node change 50000 tx. (deploy is not ready, need to deploy before test)
// 3. How to make new docId? senderAddress + nonce (8 digit)
//  3.1 matching: 4 agent nodes -> 1 target contract 

// const docuMaxCount=300000
// const deployDocuCount=docuMaxCount-200000
// const readyToChangeCount=docuMaxCount-50000
const docuMaxCount=100
const deployDocuCount=docuMaxCount-40
const readyToChangeCount=docuMaxCount-5

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.chainz.doc.single.js  portNumber  minerIdx  accountStartIdx configPath [ debug(false) ]')
  process.exit(0)
}
const port = Number(args[0])
const minerIdx = Number(args[1])
const startIdx = Number(args[2])

// Configurations from file
const confPath = args[3]
const conf = utils.loadConf(confPath)

let debugLog = `./test.chainzdoc.node${minerIdx}.log`
let saveLog = false
if (args.length == 5) {
  if (args[4].toLowerCase() === 'true') {
    saveLog = true
    fs.writeFileSync(debugLog, `${new Date().toISOString()} [INFO] ${port} ${minerIdx} ${startIdx} ${confPath}\n`)
  }
}
let deployEnabled = false
if (minerIdx == 0) {
  deployEnabled = true
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

let nodeCount
let nodeIndex
let docServiceIdx=-1
let docServiceCnt=0
async function setDocServiceAddress(nodeIdx, nodeCnt) {
  
  let numDeploy = await test.getDeployDocCount()
  // if (numDeploy < 1) {
  //   await deployNewService()
  // }

  let targetAddress = null
  for (let j=0; j<numDeploy; j++) {
    targetAddress = await test.getDeployDocAddress(j)
    test.setDocServiceContractAddress(targetAddress)
    docServiceCnt = await test.getDocCount()
    if (docServiceCnt < readyToChangeCount) {
      docServiceIdx = j
      break;
    }
  }
  if (docServiceIdx == -1) {
    ERROR('need to deploy docService')
    process.exit(1)
  }
  INFO(`set docService(${docServiceIdx}): ${targetAddress} - ${docServiceCnt}`)
  docServiceCnt += nodeIdx
  nodeCount = nodeCnt
  nodeIndex = nodeIdx

}

// 필요하다면 배포도 수행하도록 변경
async function prepareNextDocServiceAddress(_docServiceIdx) {

  _docServiceIdx++
  let numDeploy = await test.getDeployDocCount()

  // check: need to deploy
  if (_docServiceIdx >= numDeploy) {
    
    if (deployEnabled) {
      await deployNewService();
    } 
    else {
      // deploy는 다른 노드에서 수행할 것임
      readyNext = false
      return
    }
    numDeploy = await test.getDeployDocCount()
    if (_docServiceIdx >= numDeploy) {
      return prepareNextDocServiceAddress(_docServiceIdx-1)
    }
  }
  let targetAddress = await test.getDeployDocAddress(_docServiceIdx)
  let _docServiceCnt = await test.getDocCount(targetAddress)
  
  //INFO(`prepare docService(${_docServiceIdx}): ${targetAddress} - ${_docServiceCnt}`)
  if (_docServiceCnt > readyToChangeCount) {
    // next contract
    return prepareNextDocServiceAddress(_docServiceIdx)
  }

  _docServiceCnt += nodeIndex
  prepareNextContract = {
    addr: targetAddress,
    idx: _docServiceIdx,
    cnt: _docServiceCnt 
  }
  INFO(`prepared: ${JSON.stringify(prepareNextContract)}`)
}

async function deployNewService() {
  INFO('*** Need to deploy DocService')
  // ERROR('Need to deploy DocService')
  // process.exit(1)
  let req = test.ethReq('eth_getTransactionCount', [accountFrom.address, 'latest'])
  let res = await utils.sendHttp(req)
  req = test.deployReq(accountFrom.privKeyBuf, Web3Utils.hexToNumber(res))
  res = await utils.sendHttp(req)
  let txReceipt = await utils.httpGetTxReceipt(httpRpcUrl, res)
  INFO(`deployed docService ${JSON.stringify(txReceipt)}`)
  // 테스트 진행 순서 관리용
  return new Promise(function(resolve, reject) {
    resolve(true)
  })
}

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+ new Date() / 1000) + 365 * 24 * 60 * 60 // 1년 후?


let prepareNextContract = null
let readyNext = false
const createDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  //const docNum = accounts[accIdLock].docuCnt++
  //const docNum = docServiceCnt++

  const acc = accounts[accIdLock]
  if (docServiceCnt >= docuMaxCount) {
    // change target contract
    test.setDocServiceContractAddress(prepareNextContract.addr)
    docServiceCnt = prepareNextContract.cnt
    docServiceIdx = prepareNextContract.idx
    readyNext = false
    INFO(`changed: ${JSON.stringify(prepareNextContract)}`)
  }
  else if (deployDocuCount < docServiceCnt) {
    if (readyNext == false) {
      readyNext = true
      prepareNextDocServiceAddress(docServiceIdx)
    }
  }
  docServiceCnt += nodeCount

  let documentId = Web3Utils.hexToNumberString(acc.sender + nonce.toString().padStart(8, '0'))
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId.toString()).digest('hex')
  let regTimestamp = Math.floor(+ new Date() / 1000)
  DEBUG(`create docID: ${documentId} [${acc.sender} ${nonce}] -> filehash: ${fileHash}`)
  
  const request = test.createReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, regTimestamp, ++expiredDate)
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
//router.route('/prepare').post(deployDocu)   // deployDocument
router.route('/transfer').post(createDocu)  // createDocument
//router.route('/transferMulti').post(updateDocu2)  // createDocument2
router.route('/transferCount').get(transferCount)
router.route('/txpool').get(txpool)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)
router.route('/message').post(controlMsg)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
