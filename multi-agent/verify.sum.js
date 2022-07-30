
const fs = require("fs");
const utils = require('../common/utils')

const refPath = './verify.results.tx.latency.ref.log'
const resultPath = './verify.sum.results.log'

const args = process.argv.slice(2);
if (args[0] == undefined || args[0].indexOf('help') != -1) {
    console.log('Wrong input params - "projectName"')
    process.exit(2)
}
const projectName = args[0]
const dt = new Date()

let maxBlockNumber = -1
let minBlockNumber = -1
// let maxTxTime = -1
// let minTxTime = 100000
let txlatencyAvg = 0
let maxTxLatency = -1
let minTxLatency = 100000
let txCnt = 0
let sTx = 0
let rTx = 0
let dTx = 0
let workingTime = 0
let tps = 0
let blkTps = 0
let dateTime = null

function main () {
    if (fs.existsSync(refPath)) {
        console.log(`loading... ${refPath}`)
        let simContents = fs.readFileSync(refPath).toString()
        let simLines = simContents.split(/\r\n|\n/)
        let allLines = simLines.length
        for (let i=2; i<allLines; i++) {
            const lineStr = simLines[i]
            if (lineStr.startsWith('[block number]')) {
                let idx = lineStr.indexOf('max:')
                let maxBlockNumGet = Number(lineStr.substring(idx+4))
                if (!Number.isNaN(maxBlockNumGet) && maxBlockNumGet > maxBlockNumber) {
                    maxBlockNumber = maxBlockNumGet
                }
                let idx2 = lineStr.indexOf('min:')
                let minBlockNumGet = Number(lineStr.substring(idx2+4, idx-1))
                if (!Number.isNaN(minBlockNumGet) && (minBlockNumber < 0 || minBlockNumGet < minBlockNumber)) {
                    minBlockNumber = minBlockNumGet
                }
            }
            else if (lineStr.startsWith('[tx]')) {
                let idx = lineStr.indexOf('dropped:')
                let dTxGet = Number(lineStr.substring(idx+8))
                if (!Number.isNaN(dTxGet)) {
                    dTx += dTxGet
                }
                let idx2 = lineStr.indexOf('reverted:')
                let rTxGet = Number(lineStr.substring(idx2+9, idx-1))
                if (!Number.isNaN(rTxGet)) {
                    rTx += rTxGet
                }
                let idx3 = lineStr.indexOf('success:')
                let sTxGet = Number(lineStr.substring(idx3+8, idx2-1))
                if (!Number.isNaN(sTxGet)) {
                    sTx += sTxGet
                }
            }
            /*else if (lineStr.startsWith('[tx time]')) {
                let idx = lineStr.indexOf('max:')
                let maxTxTimeGet = Number(lineStr.substring(idx+4))
                if (!Number.isNaN(maxTxTimeGet) && maxTxTimeGet > maxTxTime) {
                    maxTxTime = maxTxTimeGet
                }
                let idx2 = lineStr.indexOf('min:')
                let minTxTimeGet = Number(lineStr.substring(idx2+4, idx-1))
                if (!Number.isNaN(minTxTimeGet) && (minTxTimeGet < minTxTime)) {
                    minTxTime = minBlockNumGet
                }
            }*/
            else if (lineStr.startsWith('[tx latency]')) {
                let idx = lineStr.indexOf('max:')
                let maxTxTimeGet = Number(lineStr.substring(idx+4))
                if (!Number.isNaN(maxTxTimeGet) && maxTxTimeGet > maxTxLatency) {
                    maxTxLatency = maxTxTimeGet
                }
                let idx2 = lineStr.indexOf('min:')
                let minTxTimeGet = Number(lineStr.substring(idx2+4, idx-1))
                if (!Number.isNaN(minTxTimeGet) && (minTxTimeGet < minTxLatency)) {
                    minTxLatency = minTxTimeGet
                }
            }
            else if (lineStr.startsWith(' * tx count: ')) {
                // verify?
                let idx2 = lineStr.indexOf(':')
                if (idx2 < 20) {
                    let idx3 = lineStr.indexOf(',')
                    let txCntGet = Number(lineStr.substring(idx2+1, idx3))
                    if (!Number.isNaN(txCntGet)) {
                        txCnt = txCntGet
                        if (txCntGet != sTx) {
                            console.log('ERROR??', 'sum:', txCntGet, '(', sTx, rTx, dTx, ')')
                        }
                    }
                }
                // offset time
                let idx = lineStr.lastIndexOf(':')
                if (idx > 20) {
                    let txTimeGet = Number(lineStr.substring(idx+1))
                    if (!Number.isNaN(txTimeGet)) {
                        workingTime = txTimeGet
                    }
                }
            }
            else if (lineStr.startsWith(' * latency ')) {
                // verify?
                let idx2 = lineStr.indexOf(':')
                if (idx2 < 20) {
                    let idx3 = lineStr.indexOf(',')
                    let txlatencyAvgGet = Number(lineStr.substring(idx2+1, idx3))
                    if (!Number.isNaN(txlatencyAvgGet)) {
                        txlatencyAvg = txlatencyAvgGet
                    }
                }
            }
            else if (lineStr.startsWith(' * tps: ')) {
                let idx = lineStr.lastIndexOf(':')
                if (idx > 5) {
                    let txTpsGet = Number(lineStr.substring(idx+1))
                    if (!Number.isNaN(txTpsGet)) {
                        tps = txTpsGet
                    }
                }
            }
            else if (lineStr.startsWith(' * block tps ')) {
                let idx = lineStr.lastIndexOf(':')
                if (idx > 10) {
                    let txTpsGet = Number(lineStr.substring(idx+1))
                    if (!Number.isNaN(txTpsGet)) {
                        blkTps = txTpsGet
                    }
                }
            }
            else if (dateTime == null && lineStr.startsWith('*** 20')) {
                dateTime = lineStr.replace('***', " ")
                dateTime = dateTime.replace('***', " ")
                dateTime = dateTime.trim()
            }
        }
    }
    else {
        console.error(`Not found: ${refPath}`)
        process.exit(1)
    }

    let headerStr = 'report time,test name,tps(avg),tx count,tx time,latency(avg),latency(min),latency(max),success,reverted,dropped,block count,max tps(block)'
    if (fs.existsSync(resultPath) == false) {
        fs.writeFileSync(resultPath, `${headerStr}\n`)
    }
    if (dateTime == null) {
        dateTime = dt.toISOString()
    }
    let dataStr = `${dateTime},${projectName},${tps},${txCnt},${workingTime},${txlatencyAvg},${minTxLatency},${maxTxLatency},${sTx},${rTx},${dTx},${maxBlockNumber-minBlockNumber+1},${blkTps}`
    console.log(headerStr)
    console.log(dataStr)
    fs.appendFileSync(resultPath, `${dataStr}\n`)
    console.log('done.')
}

main()
