
const fs = require("fs")
const utils = require('../common/utils')
const Web3 = require('web3')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const args = process.argv.slice(2);
if (args[0] == undefined || args[0].indexOf('help') != -1) {
    console.log('Wrong input params - "configPath transactionLogPath"');
    console.log('  ex) node verify.tx.js ../configs/local.cbdc.test.json ./test.doc.node0.log');
    process.exit(2);
}

const resultPath = './verify.tx.latency.results.log'
const refPath = './verify.tx.latency.ref.log'
const simplePath = './verify.tx.latency.res.simple.log'
const simplePath2 = './verify.tx.latency.res.simple2.log'

const confPath = args[0]
const conf = utils.loadConf(confPath)
const transactionLogPath = args[1]

fs.appendFileSync(refPath, `\n*** ${new Date().toISOString()} ***\n`)
fs.appendFileSync(refPath, `*** ${transactionLogPath} ***\n`)

let httpRpcUrl = ''
let lines = null
let web3

let timeMap = new Map();
let timeMap2 = new Map();
let simpleTimeOffset = 0

function init() {

	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    web3 = new Web3(httpProvider)

    let contents = fs.readFileSync(transactionLogPath).toString()
    lines = contents.split(/\r\n|\n/)
    console.log(`items: ${lines.length - 2}(?)`)
    if (fs.existsSync(resultPath) == false) {
        fs.writeFileSync(resultPath, `sendTime blockTime timeOffset txid\n`)
    }
    if (fs.existsSync(simplePath) == true) {
        LOG('loading...')
        let simContents = fs.readFileSync(simplePath).toString()
        let simLines = simContents.split(/\r\n|\n/)
        let allLines = simLines.length - 1
        simpleTimeOffset = parseInt(simLines[0])
        for (let i=2; i<allLines; i++) {
            const lineStr = simLines[i]
            let txInfos = lineStr.split(' ')
            timeMap.set(`${txInfos[1]} ${txInfos[2]}`, parseInt(txInfos[3]))
        }
    }
    if (fs.existsSync(simplePath2) == true) {
        LOG('loading...')
        let simContents = fs.readFileSync(simplePath2).toString()
        let simLines = simContents.split(/\r\n|\n/)
        let allLines = simLines.length - 1
        simpleTimeOffset = parseInt(simLines[0])
        for (let i=2; i<allLines; i++) {
            const lineStr = simLines[i]
            let txInfos = lineStr.split(' ')
            timeMap2.set(`${txInfos[1]} ${txInfos[2]}`, parseInt(txInfos[3]))
        }
    }
}

let map = new Map();
async function run() {
    LOG('  =======  run  =======')
    let results = null
    let maxOffset = 1
    let minOffset = 1000

    let success = 0
    let dropped = 0
    let reverted = 0 
    
    try {
        let allLines = lines.length
        for (let i=0; i<allLines; i++) {
            const lineStr = lines[i]
            
            if (lineStr.length != 80) {
                // console.log('[SKIP]', lineStr)
                continue
            }
            let txInfos = lineStr.split(' ')
            let transactionHash = txInfos[1]
            if (transactionHash.length != 66) {
                // console.log('[ERR] wrong data format:', lineStr)
                continue
            }
            if (simpleTimeOffset == 0) {
                simpleTimeOffset = Number(txInfos[0]) - 100
            }

            let progress = parseInt(i * 100 / allLines)
            LOG(` * [${progress}%] transactionHash: ${transactionHash}`)
            let txResults = await web3.eth.getTransactionReceipt(transactionHash)
            if (txResults == undefined || txResults == null) {
                LOG(`eth_getTransactionReceipt(${transactionHash}) => ${txResults}`)
                console.log(` *** send tx - Dropped ***`)
                dropped++
            }
            else {
                LOG(`eth_getTransactionReceipt(${transactionHash}) => ${JSON.stringify(txResults)}`)
                if (txResults.status == true) {
                    console.log(` *** send tx - Seccess ***`)
                    success++

                    let settleTime = 0
                    if (map.has(txResults.blockNumber) == false) {
                        results = await web3.eth.getBlock(txResults.blockHash)
                        settleTime = results.timestamp * 1000
                        map.set(txResults.blockNumber, settleTime)
                    }
                    else {
                        settleTime = map.get(txResults.blockNumber)
                    }

                    let startTime = Number(txInfos[0])
                    let timeOffset = settleTime - startTime
                    if (timeOffset > maxOffset) {
                        maxOffset = timeOffset
                    }
                    if (timeOffset < minOffset) {
                        minOffset = timeOffset
                    }
                    //let outOffset = parseInt(timeOffset * 1000)
                    // sendTime, blockTime, 반영시간, txid ?
                    fs.appendFileSync(resultPath, `${txInfos[0]} ${results.timestamp}000 ${timeOffset} ${transactionHash}\n`)

                    let stx = parseInt((startTime - simpleTimeOffset) / 10)
                    let etx = parseInt((settleTime - simpleTimeOffset) / 10)

                    let timeStr = `${stx} ${etx}`
                    if (timeMap.has(timeStr) == false) {
                        timeMap.set(timeStr, 1)
                    }
                    else {
                        let cntValue = timeMap.get(timeStr)
                        timeMap.set(timeStr, cntValue+1)
                    }

                    let stx2 = parseInt(stx / 10)
                    let etx2 = parseInt(etx / 10)

                    let timeStr2 = `${stx2} ${etx2}`
                    if (timeMap2.has(timeStr2) == false) {
                        timeMap2.set(timeStr2, 1)
                    }
                    else {
                        let cntValue2 = timeMap2.get(timeStr2)
                        timeMap2.set(timeStr2, cntValue2+1)
                    }
                }
                else {
                    console.log(` *** send tx - Reverted ***`)
                    // Why ??
                    reverted++
                }
            }
        }

        LOG(`==================================`)
        let refStr = `[tx]  success: ${success}  reverted: ${reverted}  dropped: ${dropped}\n`
        refStr += `[latency]  min: ${minOffset}  max: ${maxOffset}`
        LOG(refStr)

        fs.appendFileSync(refPath, refStr +'\n')

        LOG('saving...')
        let mapsize = timeMap.keys.length
        let cnt = 1
        let saveStr = ''
        for (let [key, value] of timeMap) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        LOG('saving...(overwriting)')
        fs.writeFileSync(simplePath, `${simpleTimeOffset}\nidx sTime eTime counts\n`)
        fs.appendFileSync(simplePath, saveStr)

        cnt = 1
        saveStr = ''
        for (let [key, value] of timeMap2) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        LOG('saving...(overwriting)')
        fs.writeFileSync(simplePath2, `${simpleTimeOffset}\nidx sTime eTime counts\n`)
        fs.appendFileSync(simplePath2, saveStr)

    }
    catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
