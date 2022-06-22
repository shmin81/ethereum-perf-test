
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

const confPath = args[0]
const conf = utils.loadConf(confPath)
const transactionLogPath = args[1]

let httpRpcUrl = ''
let lines = null
let web3
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
}

let map = new Map();
async function run() {
    LOG('  =======  run  =======')
    let results = null
    let maxOffset = 1
    let minOffset = 1000

    let success = 0
    let failed = 0
    let reverted = 0 
    
    try {
        for (let i=1; i<lines.length; i++) {
            const lineStr = lines[i]
            
            if (lineStr.length != 80) {
                console.log('[SKIP]', lineStr)
                continue
            }
            let txInfos = lineStr.split(' ')
            let transactionHash = txInfos[1]
            if (transactionHash.length != 66) {
                // SKIP
                console.log('[ERR] wrong data:', lineStr)
                continue
            }
            LOG(` * transactionHash: ${transactionHash}`)
            let txResults = await web3.eth.getTransactionReceipt(transactionHash)
            if (txResults == undefined || txResults == null) {
                LOG(`eth_getTransactionReceipt(${transactionHash}) => ${txResults}`)
                failed++
            }
            else {
                LOG(`eth_getTransactionReceipt(${transactionHash}) => ${JSON.stringify(txResults)}`)
                if (txResults.status == true) {
                    LOG(` *** send tx - Seccess ***`)
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

                    let timeOffset = settleTime - Number(txInfos[0])
                    if (timeOffset > maxOffset) {
                        maxOffset = timeOffset
                    }
                    if (timeOffset < minOffset) {
                        minOffset = timeOffset
                    }
                    //let outOffset = parseInt(timeOffset * 1000)
                    // sendTime, blockTime, 반영시간, txid ?
                    fs.appendFileSync(resultPath, `${txInfos[0]} ${results.timestamp}000 ${timeOffset} ${transactionHash}\n`)
                }
                else {
                    LOG(` *** send tx - Reverted ***`)
                    // Why ??
                    reverted++
                }
            }
        }

        LOG(`==================================`)
        let refStr = `[tx]  success: ${success}  reverted: ${reverted}  deleted: ${failed}\n`
        refStr += `[latency]  min: ${minOffset}  max: ${maxOffset}`
        LOG(refStr)
        
        fs.appendFileSync(refPath, `*** ${resultPath} ***\n`)
        fs.appendFileSync(refPath, refStr +'\n')

    }
    catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
