
const fs = require("fs")
const utils = require('../common/utils')
const Web3 = require('web3')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const args = process.argv.slice(2);
if (args[0] == undefined || args[0].indexOf('help') != -1) {
    console.log('Wrong input params - "configPath transactionLogPath [ project_id (int, default:0) ]"');
    console.log('  ex) node verify.tx.js ../configs/local.cbdc.test.json ./test.doc.node0.log');
    process.exit(2);
}

const resultPath = './verify.results.tx.latency.log'
const refPath = './verify.results.tx.latency.ref.log'
const simplePath = './verify.results.tx.latency.simple1.log'
const simplePath2 = './verify.results.tx.latency.simple2.log'
const resultPath2 = './verify.results.block.tps.log'

const confPath = args[0]
const conf = utils.loadConf(confPath)
const transactionLogPath = args[1]
let project_id = 0
if (args[2] != undefined) {
    project_id = parseInt(args[2])
    project_id = Math.abs(project_id)
}

let startTime = new Date()
let resultDatas = `\n*** ${startTime.toISOString()} ***\n*** ${transactionLogPath} ***\n`

let httpRpcUrl = ''
let lines = null
let web3 = null

let map = new Map();
let txMap = new Map();
let timeMap = new Map();
let timeMap2 = new Map();
let simpleTimeOffset = 0

async function init() {

	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    if (project_id < endpointConf.length) {
        httpRpcUrl = endpointConf[project_id]
    }
    else {
        httpRpcUrl = endpointConf[0]
    }
    LOG(`RPC: ${httpRpcUrl}`)

	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    web3 = new Web3(httpProvider)

    minBlockNum = await web3.eth.getBlockNumber()

    let contents = fs.readFileSync(transactionLogPath).toString()
    lines = contents.split(/\r\n|\n/)
    console.log(`items: ${lines.length - 2}(?)`)
    if (fs.existsSync(resultPath) == false) {
        fs.writeFileSync(resultPath, `sendTime blockTime timeOffset txid\n`)
    }
    // 기존 데이터가 있으면 거기에 새로운 데이터를 추가함
    if (fs.existsSync(simplePath) == true) {
        LOG(`loading... ${simplePath}`)
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
    // 기존 데이터가 있으면 거기에 새로운 데이터를 추가함
    if (fs.existsSync(simplePath2) == true) {
        LOG(`loading... ${simplePath2}`)
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
    // 기존 데이터가 있으면 거기에 새로운 데이터를 추가함
    if (fs.existsSync(resultPath2) == true) {
        LOG(`loading... ${resultPath2}`)
        let simContents = fs.readFileSync(resultPath2).toString()
        let simLines = simContents.split(/\r\n|\n/)
        let allLines = simLines.length - 1
        for (let i=0; i<allLines; i++) {
            const lineStr = simLines[i]
            let txInfos = lineStr.split(' ')
            let bn = parseInt(txInfos[0])
            let st = parseInt(txInfos[1])
            map.set(bn, st)
            updateBlock(bn, st)
        }
    }
    
    return new Promise(function(resolve, reject) {
        resolve(true)
    })
}

let maxOffset = 1
let minOffset = 100000

let maxBlockNum = 1
let minBlockNum = 1000000000000

let minSendTime = 0
let maxSettleTime = 0

let success = 0
let dropped = 0
let reverted = 0 
let progress = -1

function getObjFromStr(i) {
    const lineStr = lines[i]
            
    if (lineStr.length != 80) {
        return null
    }
    let txInfos = lineStr.split(' ')
    
    if (txInfos[1].length != 66) {
        return null
    }
    return txInfos
}

async function run() {
    LOG('  =======  run  =======')
    let results = null
    
    try {
        let allLines = lines.length
        for (let i=0; i<allLines;) {

            const txInfos = getObjFromStr(i++)
            if (txInfos == null) continue
            let transactionHash = txInfos[1]
            //console.log(i, transactionHash)
            if (simpleTimeOffset == 0) {
                simpleTimeOffset = Number(txInfos[0]) - 200
            }

            let progressNow = parseInt(i * 100 / allLines)
            if (progress != progressNow) {
                LOG(` * ${project_id} [${progressNow}%] transactionHash: ${transactionHash}`)
                progress = progressNow
            }

            // Tx가 포함된 block 정보가 없을 경우에만 txReceipt를 확인 (이때에만 success/revert 여부 확인)
            if (txMap.has(transactionHash)) {
                let startTime = Number(txInfos[0])
                let settleTime = txMap.get(transactionHash)
                update(startTime, settleTime, transactionHash)
                success++
                continue
            }

            let txResults = await web3.eth.getTransactionReceipt(transactionHash)

            if (txResults == undefined || txResults == null) {
                //LOG(`eth_getTransactionReceipt(${transactionHash}) => ${txResults}`)
                console.log(` * tx: ${transactionHash} -> Dropped`)
                dropped++
            }
            else {
                //LOG(`eth_getTransactionReceipt(${transactionHash}) => ${JSON.stringify(txResults)}`)
                if (txResults.status == true) {
                    // console.log(` * tx: ${transactionHash} -> Seccess`)
                    success++

                    let startTime = Number(txInfos[0])
                    if (minSendTime == 0) {
                        minSendTime = startTime
                    }

                    let settleTime = 0
                    if (txMap.has(transactionHash) == false) {
                        
                        settleTime = await getBlockTx(txResults.blockHash)
                        //results = await web3.eth.getBlock(txResults.blockHash, true)
                        //settleTime = results.timestamp * 1000
                        if (map.has(txResults.blockNumber) == false) {
                            map.set(txResults.blockNumber, settleTime)
                            updateBlock(txResults.blockNumber, settleTime)
                        }
                    }
                    else {
                        settleTime = map.get(txResults.blockNumber)
                    }

                    update(startTime, settleTime, transactionHash)
                }
                else {
                    console.log(` * tx: ${transactionHash} -> Reverted`)
                    // Why ??
                    reverted++
                    // test is failed??
                    // process.exit(2)
                    // break
                }
            }
        }

        LOG(`==================================`)
        
        let refStr = `[tx]  success: ${success}  reverted: ${reverted}  dropped: ${dropped}\n`
        refStr += `[tx latency]  min: ${minOffset}  max: ${maxOffset}\n`
        refStr += `[tx time]  send first: ${minSendTime}  settle last: ${maxSettleTime}\n`
        refStr += `[block number]  min: ${minBlockNum}  max: ${maxBlockNum}`
        if (reverted > 0) {
            LOG(`[ERROR] found reverted transactions!!!`)
            refStr += '\n[ERROR] found reverted transactions!!!\n\n'
        }
        LOG(refStr)

        LOG(`saving... (updating) ${refPath}`)
        fs.appendFileSync(refPath, resultDatas + refStr +`\n`)

        //let mapsize = timeMap.keys.length
        let cnt = 1
        let saveStr = ''
        for (let [key, value] of timeMap) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        LOG(`saving...(overwriting) ${simplePath}`)
        fs.writeFileSync(simplePath, `${simpleTimeOffset}\nidx sTime eTime counts\n`)
        fs.appendFileSync(simplePath, saveStr)

        cnt = 1
        saveStr = ''
        for (let [key, value] of timeMap2) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        LOG(`saving...(overwriting) ${simplePath2}`)
        fs.writeFileSync(simplePath2, `${simpleTimeOffset}\nidx sTime eTime counts\n`)
        fs.appendFileSync(simplePath2, saveStr)

        saveStr = ''
        for (let [key, value] of map) {
            saveStr += `${key} ${value}\n`
        }
        LOG(`saving...(overwriting) ${resultPath2}`)
        fs.writeFileSync(resultPath2, saveStr)
    }
    catch (err) {
		LOG(err); 
	}
    let endTime = new Date()
    //console.log(startTime.toISOString())
    //console.log(endTime.toISOString())
	LOG(` =======  done [working time: ${endTime - startTime} ms] ======`)
}

function getBlockTx(_blockHash) {

    return new Promise(function(resolve, reject) {
        web3.eth.getBlock(_blockHash)
        .then(res => {
            let settleTxTime = res.timestamp * 1000
            LOG(`getBlockTx(${_blockHash}) timestamp:${res.timestamp}, txCnt: ${res.transactions.length}`)
            for(let tx of res.transactions) {
                txMap.set(tx, settleTxTime)
            }
            resolve(settleTxTime)
        }).catch(err => {
            reject(err)
        })
    })
}

function updateBlock(_blockNumber, _settleTime) {
    //console.log('updateBlock', _blockNumber, _settleTime)
    if (maxBlockNum < _blockNumber) {
        maxBlockNum = _blockNumber
        maxSettleTime = _settleTime
    }
    if (minBlockNum > _blockNumber) {
        minBlockNum = _blockNumber
    }
}

function update(_startTime, _settleTime, _transactionHash) {

    let timeOffset = _settleTime - _startTime
    if (timeOffset > maxOffset) {
        maxOffset = timeOffset
    }
    if (timeOffset < minOffset) {
        minOffset = timeOffset
    }
    if (minSendTime > _startTime) {
        minSendTime = _startTime
    }

    // sendTime, blockTime, 반영시간, txid ?
    fs.appendFileSync(resultPath, `${_startTime} ${_settleTime} ${timeOffset} ${_transactionHash}\n`)

    let stx = parseInt((_startTime - simpleTimeOffset) / 10)
    let etx = parseInt((_settleTime - simpleTimeOffset) / 10)

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

init().then(() => {
    return run()
})
