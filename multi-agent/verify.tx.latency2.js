
const fs = require("fs")

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

const resultPath = './verify.results.tx.latency.log'
const simplePath = './verify.results.tx.latency.simple.full.log'
const simplePath1 = './verify.results.tx.latency.simple.10ms.log'
const simplePath2 = './verify.results.tx.latency.simple.100ms.log'
const refPath = './verify.results.tx.latency.ref.log'

let lines = null

let timeMap = []
let simpleTimeOffset = 0

function init() {
    LOG(`loading... ${resultPath}`)
    let contents = fs.readFileSync(resultPath).toString()
    lines = contents.split(/\r\n|\n/)
    console.log(`items: ${lines.length - 2}(?)`)
    if (lines.length < 5) {
        console.error('Too small datas')
        process.exit(2)
    }
}

async function run() {
    LOG('  =======  run  =======')

    let minTxLatency = 10000
    let maxTxLatency = 0
    let minSendTime = 0
    let maxSettleTime = 0
    let count = 0
    let pre_progress = -1
    let settleSum = 0
    try {
        let allLines = lines.length - 1
        for (let i=1; i<allLines; i++) {
            const lineStr = lines[i]

            let txInfos = lineStr.split(' ')
            let transactionHash = txInfos[3]
            if (transactionHash.length != 66) {
                // console.log('[ERR] wrong data format:', lineStr)
                continue
            }
            count++
            let sendTimeMs = Number(txInfos[0])
            let settleTimeMs = Number(txInfos[1])
            if (simpleTimeOffset == 0) {
                simpleTimeOffset = sendTimeMs - 100
                minSendTime = sendTimeMs
                maxSettleTime = settleTimeMs
            }
            else {
                if (minSendTime > sendTimeMs) {
                    minSendTime = sendTimeMs
                }
                if (maxSettleTime < settleTimeMs) {
                    maxSettleTime = settleTimeMs
                }
            }
            let txLatency = settleTimeMs - sendTimeMs
            if (minTxLatency > txLatency) {
                minTxLatency = txLatency
            }
            if (maxTxLatency < txLatency) {
                maxTxLatency = txLatency
            }
            settleSum += txLatency
            //settleSum += parseInt(Math.round(txLatency / 10).toString())

            let progress = parseInt(i * 100 / allLines)
            // LOG(` * [${progress}%] transactionHash: ${transactionHash}`)
            if (pre_progress != progress) {
                LOG(` * [${progress}%] transactionHash: ${transactionHash}`)
                pre_progress = progress
            }
            
            timeMap.push({
                id: txInfos[3],
                sTime: Number(txInfos[0])-simpleTimeOffset,
                eTime: Number(txInfos[1])-simpleTimeOffset
            })
        }

        LOG('sorting...')
        timeMap.sort(function(a, b) { // 오름차순
            return a.eTime < b.eTime ? -1 : a.eTime > b.eTime ? 1 : 0;
        });

        timeMap.sort(function(a, b) { // 오름차순
            return a.sTime < b.sTime ? -1 : a.sTime > b.sTime ? 1 : 0;
        });

        let strX0 = ''
        let timeMap1 = new Map();
        let timeMap2 = new Map();
        let cnt = 1
        let mapsize = timeMap.length
        for (let obj of timeMap) {
            strX0 += `${cnt++} ${obj.sTime} ${obj.eTime}\n`
            //console.log(cnt, obj.sTime, obj.eTime)
            let stx = parseInt(obj.sTime / 10)
            let etx = parseInt(obj.eTime / 10)

            let timeStr = `${stx} ${etx}`
            if (timeMap1.has(timeStr) == false) {
                timeMap1.set(timeStr, 1)
            }
            else {
                let cntValue = timeMap1.get(timeStr)
                timeMap1.set(timeStr, cntValue+1)
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
        
        LOG(`saving...(overwriting) ${simplePath}`)
        fs.writeFileSync(simplePath, `idx sTime eTime\n`)
        fs.appendFileSync(simplePath, strX0)

        cnt = 1
        let saveStr = ''
        for (let [key, value] of timeMap1) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        
        LOG(`saving...(overwriting) ${simplePath1}`)
        fs.writeFileSync(simplePath1, `idx sTime eTime counts\n`)
        fs.appendFileSync(simplePath1, saveStr)

        cnt = 1
        saveStr = ''
        for (let [key, value] of timeMap2) {
            saveStr += `${cnt++} ${key} ${value}\n`
        }
        
        LOG(`saving...(overwriting) ${simplePath2}`)
        fs.writeFileSync(simplePath2, `idx sTime eTime counts\n`)
        fs.appendFileSync(simplePath2, saveStr)

        let refStr = ' ============================================\n'
        refStr += ` * tx count: ${count}, time offset(ms): ${maxSettleTime-minSendTime}\n`
        refStr += ` * start time: ${minSendTime}, last block time: ${maxSettleTime}\n`
        refStr += ` * latency avg: ${(settleSum / count).toFixed(1)}, min: ${minTxLatency}, max: ${maxTxLatency}\n`
        refStr += ` * tps: ${(count * 1000 / (maxSettleTime-minSendTime)).toFixed(3)}`
        LOG(refStr)
        LOG(`saving... (updating) ${refPath}`)
        fs.appendFileSync(refPath, `\n${refStr}\n`)

    }
    catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init()
run()
