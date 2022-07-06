// erc20 transfer test
const fs = require('fs')
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const crypto = require('crypto');

const utils = require('../common/utils')
const test = require('../common/test.doc')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const showLog = true
const DEBUG = (msg) => {
  if (saveLog) {
    fs.appendFileSync(debugLog, msg+'\n')
  }
  if (showLog) {
    console.log(msg)
  }
}

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.chainzDoc.js  portNumber  minerIdx  accountStartIdx configPath [ debug(false) ]')
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

    for (let i=0; i<acountCnt; i++) {

      const account = accountConf[i+startIdx]
      account.senderPrivKeyBytes = Buffer.from(account.privKey, 'hex')

      account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      account.startTxCount = account.nonceLock

      if (i == 0) {
        INFO(`gas: (create document) ${await test.createEstimateGas(account.sender)}`)
      }

      account.docuCnt = await test.getDocCount(account.sender)
      if (account.docuCnt == 0) {
        INFO(`[WARN] No document!! - Need to prepare api beforn test`)
      }
      else if (i == 0) {
        let docId = Web3Utils.hexToNumberString(account.sender + (account.docuCnt - 1).toString())
        INFO(`gas: (update document) ${await test.updateEstimateGas(account.sender, docId)}`)
      }

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

const updateDocu = async (req, res) => {
 
  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = accounts[accIdLock].nonceLock++
  const docNum = accounts[accIdLock].docuCnt - 1  // 마지막 docu만 update?
  const acc = accounts[accIdLock]

  let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
  let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex')
  DEBUG(`update docID: ${documentId} [${acc.sender} ${docNum}] -> filehash: ${fileHash}, expiredDate: ${expiredDate}`)
  const request = test.updateReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
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

const updateDocu2 = async (req, res) => {
 
  let ps = req.body.params
  let multiCnt = 2
  //console.log('request params:', ps.length, ps)
  if (Array.isArray(ps) && ps.length > 0) {
    multiCnt = Number(ps[0])
    //DEBUG(`params[0]: ${multiCnt} from [${ps[0]} ${typeof(ps[0])}]`)
  }
  
  let success = 0
  for (let i=0; i<multiCnt; i++) {
  
    const accIdLock = acountLock++
    if (acountLock == acountCnt) {
      acountLock = 0;
    }
    const nonce = accounts[accIdLock].nonceLock++
    const docNum = accounts[accIdLock].docuCnt - 1  // 마지막 docu만 update?
    const acc = accounts[accIdLock]

    let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
    let fileHash = '0x' + crypto.createHash('sha256').update(documentId + nonce).digest('hex')
    DEBUG(`update docID: ${documentId} [${acc.sender} ${docNum}] -> filehash: ${fileHash}, expiredDate: ${expiredDate}`)
    const request = test.updateReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
    const reqId = request.body.id;

    let sendTime = new Date()
    httpRequest.post(request)
      .then(response => {
        try {
          if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
            const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
            //INFO(`Success! - ${JSON.stringify(output)}`)
            DEBUG(`${sendTime.valueOf()} ${response.body.result}`)
            //res.status(200)
            //res.set('Content-Type', 'application/json;charset=utf8')
            //res.json(output)
            successCount++
            success++
          } else {
            // console.dir(response)
            const output = { result: false, req: request, res: response.body.error }
            ERROR(`Need check! - ${JSON.stringify(output)}`)
            res.status(500)
            res.set('Content-Type', 'application/json;charset=utf8')
            res.json(output)
          }

        } catch (err) {
          ERROR(`It SHOULD NOT happen! - ${err}`)
          res.status(500)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json({ result: false, req: request, res: response.body, error: `${err}` })
          //process.exit(1)
        }
        // 전체가 성공한 경우(?)
        if (multiCnt == success) {
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json({ result: true, success })
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
router.route('/transfer').post(updateDocu)  // updateDocument
router.route('/transferMulti').post(updateDocu2)  // updateDocument2
router.route('/transferCount').get(transferCount)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
