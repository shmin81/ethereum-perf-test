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
if (args.length != 1) {
  console.log('node  doc.update.for.single.node.js  configPath')
  process.exit(0)
}

// Configurations from file
const confPath = args[0]
const conf = utils.loadConf(confPath)

//const caseIdx = Number(args[1])
let inputLog = `./test.create.doc.ids.log`
let debugLog = `./results/test.create.doc.ids.txt`


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
let minGasOffset = 1000000
let maxGasOffset = 1
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
  let gasOffset = _egas - _rgas
  if (gasOffset < minGasOffset) {
    minGasOffset = gasOffset
  }
  if (gasOffset > maxGasOffset) {
    maxGasOffset = gasOffset
  }
}

async function main() {
  let result = true
  await prepare()

  let simContents = fs.readFileSync(inputLog).toString()
  let simLines = simContents.split(/\r\n|\n/)
  let allLines = simLines.length
  for (let i=0; i<allLines; i++) {
  //for (let i=0; i<2; i++) {
    const lineStr = simLines[i].trim()
    if (lineStr.length < 5) continue
    if (lineStr.startsWith('/')) continue
    INFO(lineStr)
    const strs = lineStr.split(',')
    if (strs.length < 7) {
      //INFO(strs[5])
      //result = await utils.httpGetTxReceipt(httpRpcUrl, strs[5])
      let reqq = utils.getPostRequest(httpRpcUrl, 'eth_getTransactionReceipt', [ strs[5] ])
      INFO(JSON.stringify(reqq))
      result = await utils.sendHttp2(reqq)
      setMinMax(Number(strs[4]), Web3Utils.hexToNumber(result.gasUsed))
      WRITE(lineStr)
      WRITE(`,${result.status},${result.gasUsed},${Web3Utils.hexToNumberString(result.gasUsed)},${Number(strs[4])-Web3Utils.hexToNumber(result.gasUsed)}\n`)
      
    }
    else {
      setMinMax(Number(strs[4]), Number(strs[8]))
      WRITE(lineStr)
      WRITE('\n')
    }
  } // end for

  let resultStr = '// =======================\n'
  resultStr += `// estmate gas: ${minGasE} ~ ${maxGasE} [${maxGasE - minGasE}]\n`
  resultStr += `// used gas: ${minGasR} ~ ${maxGasR} [${maxGasR - minGasR}]\n`
  resultStr += `// gas offset: ${minGasOffset} ~ ${maxGasOffset} [${maxGasOffset - minGasOffset}]\n`
  //WRITE(resultStr) // 재 실행시 에러 발생
  INFO(resultStr)
}

main()