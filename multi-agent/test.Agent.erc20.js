// erc20 transfer test
const fs = require('fs')
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const Web3 = require('web3')

const utils = require('../common/utils')
const test = require('../common/test.erc20')

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

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.erc20.js  portNumber  minerIdx  accountStartIdx configPath [ debug(false) ]')
  process.exit(0)
}
const port = Number(args[0])
const minerIdx = Number(args[1])
const startIdx = Number(args[2])

// Configurations from file
const confPath = args[3]
const conf = utils.loadConf(confPath)

let debugLog = `./test.erc20.node${minerIdx}.log`
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

let txGasLimit = 70000
let httpRpcUrl = null
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
  INFO(`RPC: ${httpRpcUrl}, Contract: ${conf.erc20Address}`)

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
      account.senderToken = await test.balanceOf(account.sender)
      if (account.senderToken < 10000) {
        INFO(`Low sender's money: ${account.senderToken}`)
      }
      if (account.senderToken < 100) {
        ERROR(`sender's money: ${account.senderToken}`)
      }

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

const amount = 1
const transfer = async (req, res) => {
 
  let ps = req.body.params
  let nonceOffset = 0
  //console.log('request params:', ps.length, ps)
  if (Array.isArray(ps) && ps.length > 0) {
    nonceOffset = Number(ps[0])
    INFO(`params[0] nonce offset: ${nonceOffset} from [${ps[0]} ${typeof(ps[0])}]`)
  }

  const accIdLock = acountLock++
  if (acountLock == acountCnt) {
    acountLock = 0;
  }
	const nonce = nonceOffset + accounts[accIdLock].nonceLock++
  const acc = accounts[accIdLock]

  const request = test.transferReq(acc.senderPrivKeyBytes, acc.receiver, nonce, amount)
  // DEBUG(`transfer: from: ${acc.sender}, to: ${acc.receiver}`)
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
      const output = { result: false, accIdx: accIdLock, nonce, req: request, res: `NA`, error: `${err}`, id: reqId }
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
      res.status(500)
      res.set('Content-Type', 'application/json;charset=utf8')
      res.json(output)
    })
}

const transfer2 = async (req, res) => {
 
  let multiCnt = 2
  let ps = getParams(req.body)
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
    const acc = accounts[accIdLock]

    const request = test.transferReq(acc.senderPrivKeyBytes, acc.receiver, nonce, amount)
    // DEBUG(`transfer: from: ${acc.sender}, to: ${acc.receiver}`, false)
    const reqId = request.body.id;

    let sendTime = new Date()
    httpRequest.post(request)
      .then(response => {
        try {
          if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
            //const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
            //INFO(`Success! - ${JSON.stringify(output)}`)
            // res.status(200)
            // res.set('Content-Type', 'application/json;charset=utf8')
            // res.json(output)
            DEBUG(`${sendTime.valueOf()} ${response.body.result}`, false)
            successCount++
            success++
          } else {
            // console.dir(response)
            const output = { result: false, req: request, res: response.body.error, id: reqId }
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
        const output = { result: false, accIdx: accIdLock, nonce, req: request, res: `NA`, error: `${err}`, id: reqId }
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
    ERROR(`It SHOULD NOT happen! - ${err}`)
    res.status(500)
    res.set('Content-Type', 'application/json;charset=utf8')
    res.json({ result: false, req, send:reqTxpool, error: `${err}` })
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
router.route('/transfer').post(transfer)
router.route('/transferMulti').post(transfer2)
router.route('/transferCount').get(transferCount)
router.route('/txpool').get(txpool)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)
router.route('/message').post(controlMsg)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
