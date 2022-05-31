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

// Environment variables
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('node  test.Agent.erc20.js  portNumber  minerIdx  accountStartIdx [configPath]')
  process.exit(0)
}
const port = Number(args[0])
const minerIdx = Number(args[1])
const startIdx = Number(args[2])

let confPath = null
if (args.length == 4) {
  confPath = args[3]
}
const conf = utils.loadConf(confPath)

INFO(`agent server port:${port}`)
//INFO(`-minerIndex:${minerIdx}`)
//INFO(`-accountIndex:${startIdx}`)
// Configurations from file
let successCount = 0
//let httpheaders = {}
//let customCommon = null

// In-memory status
let accounts = {}
let acountCnt = 0
let acountLock = 0

let txGasLimit = 50000

// Express
const app = express()
app.use((req, res, next) => next())
app.use(express.urlencoded({extended: false}))
app.use(express.json())

const server = http.createServer(app);
server.listen(port, async () => {
//http.createServer(app).listen(port, async () => {
  INFO(`Listen on port ${port}!!!`)
  
  INFO(`Contract: ${conf.erc20Address}`)
  acountCnt = conf.numberOfAccounts
  
	const endpointConf = utils.loadJson(conf.endpointfile)
  httpRpcUrl = endpointConf[minerIdx]
  INFO(`RPC: ${httpRpcUrl}`)

  // account
	const accountConf = utils.loadJson(conf.accountfile)

	try {
    let connection = null
    let httpProvider = {}
    /*if (conf.jwt != undefined && conf.jwt.length > 30) {
      httpheaders= { "Content-Type": "application/json", "Authorization": "Bearer " + conf.jwt }
      httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, { headers: httpheaders });
    }
    else {
      httpheaders= { "Content-Type": "application/json" }
      httpProvider = new Web3.providers.HttpProvider(httpRpcUrl);
    }*/
    httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, { headers: conf.httpheaders });
    connection = new Web3(httpProvider)

    let chainId = await connection.eth.getChainId()
    //customCommon = test.customChain(chainId)
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
  if (ps.length > 0) {
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
  const reqId = request.body.id;

  let sendTime = (new Date()).toISOString()
  httpRequest.post(request)
    .then(response => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          const output = { result: true, accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          INFO(`Success! - ${JSON.stringify(output)}`)
          res.status(200)
          res.set('Content-Type', 'application/json;charset=utf8')
          res.json(output)
          successCount++
        } else {
          // console.dir(response)
          const output = { result: false, accIdLock, nonce, req: request, res: response.body.error, id: reqId }
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
      const output = { result: false, accIdLock, nonce, res: `NA`, id: reqId, error: `${err}` }
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
router.route('/transfer').post(transfer)
router.route('/transferCount').get(transferCount)
router.route('/serverExit').post(serverExit)
router.route('/serverExit').get(serverExit)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
