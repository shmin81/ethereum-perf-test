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
  console.log('node  doc.update.for.single.node.js  configPath  index(0~61)')
  process.exit(0)
}

// Configurations from file
const confPath = args[0]
const conf = utils.loadConf(confPath)

const caseIdx = Number(args[1])
let inputLog = `./test.update.doc.${caseIdx}.log`
let debugLog = `./test.update.doc.${caseIdx}.txt`


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
  INFO(`ChainId: ${chainId}`)

  return new Promise(function(resolve, reject) {
    resolve(true)
  })
}

let minGasE = 1000000
let minGasR = 1000000
let maxGasE = 1
let maxGasR = 1
function setMinMax(_egas, _rgas) {
  if (_egas < minGasE) {
    minGasE = _egas
  }
  if (_egas > maxGasE) {
    maxGasE = _egas
  }
  if (_rgas < minGasR) {
    minGasR = _rgas
  }
  if (_rgas > maxGasR) {
    maxGasR = _rgas
  }
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
    INFO(lineStr)
    const strs = lineStr.split(',')
    if (strs.length < 6) {
      //INFO(strs[4])
      //result = await utils.httpGetTxReceipt(httpRpcUrl, strs[4])
      let reqq = utils.getPostRequest(httpRpcUrl, 'eth_getTransactionReceipt', [ strs[4] ])
      INFO(JSON.stringify(reqq))
      result = await utils.sendHttp2(reqq)
      setMinMax(Number(strs[3]), Web3Utils.hexToNumber(result.gasUsed))
      WRITE(lineStr)
      WRITE(`,${result.status},${result.gasUsed},${Web3Utils.hexToNumberString(result.gasUsed)},${Number(strs[3])-Web3Utils.hexToNumber(result.gasUsed)}\n`)
    }
    else {
      setMinMax(Number(strs[3]), Number(strs[7]))
      WRITE(lineStr)
      WRITE('\n')
    }
  } // end for
  INFO('=======================')
  INFO(`estmate gas: ${minGasE} ~ ${maxGasE} [${maxGasE - minGasE}]`)
  INFO(`used gas: ${minGasR} ~ ${maxGasR} [${maxGasR - minGasR}]`)
}

main()