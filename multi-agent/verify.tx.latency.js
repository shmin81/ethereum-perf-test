
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

async function run() {
    LOG('  =======  run  =======')
    let results = null
    
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
            }
            else {
                LOG(`eth_getTransactionReceipt(${transactionHash}) => ${JSON.stringify(txResults)}`)
                if (txResults.status == true) {
                    LOG(` *** send tx - Seccess ***`)
                    results = await web3.eth.getBlock(txResults.blockHash)
                    let timeOffset = results.timestamp * 1000 - Number(txInfos[0])
                    //let outOffset = parseInt(timeOffset * 1000)
                    // sendTime, blockTime, 반영시간, txid ?
                    fs.appendFileSync(resultPath, `${txInfos[0]} ${results.timestamp}000 ${timeOffset} ${transactionHash}\n`)
                }
                else {
                    LOG(` *** send tx - Reverted ***`)
                    // Why ??
                }
            }
        }
    }
    catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
