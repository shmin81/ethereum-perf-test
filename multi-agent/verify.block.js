
const fs = require("fs");
const utils = require('../common/utils')
const Web3 = require('web3')

const refPath = './verify.tx.results.latency.ref.log'
const resultPath = './verify.tx.results.block.log'
const LOG = (msg) =>  {
    console.log(new Date().toISOString(), msg)
}

// tx가 없는 블록이 지정된 수만큼 연속으로 나타날 경우, 스캔을 중지
const MaxScanRangeNotFoundTx = 5
let blockNumber = 0
const args = process.argv.slice(2);
if (args[0] == undefined || args[0].indexOf('help') != -1) {
    console.log('Wrong input params - "configPath [ blockNumber (int) ]"');
    console.log(`  ex1) ${refPath} 파일로 부터 블록번호를 가져와 이전 블록들을 스캔: node verify.block.js ../configs/local.cbdc.test.json`);
    console.log('  ex2) 입력한 블록번호부터 이전 블록들을 스캔: node verify.block.js ../configs/local.cbdc.test.json 100');
    process.exit(2);
}
else if (args[1] != undefined) {
    blockNumber = parseInt(args[1])
    if (blockNumber <= MaxScanRangeNotFoundTx) {
        LOG(`Wrong input optional param - "blockNumber": ${blockNumber}`);
        process.exit(2);
    }
}
const confPath = args[0]
const conf = utils.loadConf(confPath)

let httpRpcUrl = ''
let web3 = null

async function init() {
	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

    if (fs.existsSync(refPath)) {
        LOG(`loading... ${refPath}`)
        let simContents = fs.readFileSync(refPath).toString()
        let simLines = simContents.split(/\r\n|\n/)
        let allLines = simLines.length - 2
        for (let i=2; i<allLines; i++) {
            const lineStr = simLines[i]
            if (lineStr.startsWith('[block number]')) {
                //let strinfos = lineStr.split(' ')
                let idx = lineStr.indexOf('max:')
                let maxBlockNumGet = Number(lineStr.substring(idx+4))
                if (!Number.isNaN(maxBlockNumGet) && maxBlockNumGet > blockNumber) {
                    blockNumber = maxBlockNumGet
                }
            }
        }
        blockNumber += MaxScanRangeNotFoundTx
    }

	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    web3 = new Web3(httpProvider)

    let latestBlockNum = await web3.eth.getBlockNumber()
    LOG(`get latest block: ${latestBlockNum}`)
    if (latestBlockNum < blockNumber) {
        console.log(`wrong input the future's blockNumber": ${blockNumber}`);
        process.exit(2);
    }
    else if (blockNumber == 0) {
        blockNumber = latestBlockNum
    }
    LOG(`set start block ${blockNumber}`)
}

let resultStr = ''
async function run() {
	LOG('  =======  run  =======')
	let results = null
    let blockInfo = null
    let nextBlockTimeStamp = 0
    let nextBlockTxCount = 0
    let maxTps = 0
	try {
        let NeedContinue = true
        let foundTx = false  // 첫 tx가 발견될 떄 까지는 계속 block을 skip
        let beforeLedgerHaveTxs = 0
        while (NeedContinue) {

            blockInfo = await web3.eth.getBlock(blockNumber, true)
            LOG(`BlockNumber (${blockNumber}) -miner: ${blockInfo.miner} -timestamp: ${blockInfo.timestamp} -tx count: ${blockInfo.transactions.length}`, blockInfo.transactions.length > 0)

            // 직전에 조회한 블록의 TPS
            if (nextBlockTxCount > 0) {
                let tpsTmp = nextBlockTxCount / (nextBlockTimeStamp - blockInfo.timestamp)
                resultStr += ` - block tps: ${tpsTmp} [ tx:${nextBlockTxCount}, timeOffset:${nextBlockTimeStamp - blockInfo.timestamp} ]\n`
                if (tpsTmp > maxTps) {
                    maxTps = tpsTmp
                }
            }
            nextBlockTimeStamp = blockInfo.timestamp
            nextBlockTxCount = blockInfo.transactions.length

            blockNumber--;
            if (nextBlockTxCount == 0) {
                if (foundTx == false) {
                    // 첫 tx가 발견될때 까지는 block을 계속 탐색
                    continue;
                }
                // 연속으로 5개 블록에 tx가 없다면 블록 스캔을 중지
                if (beforeLedgerHaveTxs >= MaxScanRangeNotFoundTx) {
                    NeedContinue = false
                }
                beforeLedgerHaveTxs++
                continue;
            }

            foundTx = true // 여러개의 블록을 스캔하던 중 첫 tx가 발견됨
            beforeLedgerHaveTxs = 0
            //let gasUsedP = Web3Utils.hexToNumber(blockInfo.gasUsed) / Web3Utils.hexToNumber( blockInfo.gasLimit) * 100
            let gasUsedP = blockInfo.gasUsed / blockInfo.gasLimit * 100
            resultStr += `BlockNumber: ${blockNumber} -miner: ${blockInfo.miner} -timestamp: ${blockInfo.timestamp} -block tx: ${nextBlockTxCount} -gas: ${gasUsedP.toFixed(3)} %\n`
            let privSender = null
            let txCnt = 0
            for (let i=0; i<nextBlockTxCount; i++) {
                let tx = blockInfo.transactions[i]
                let num = String(i)
                while(num.length < 4) {
                    num = '0' + num
                }
                //LOG(`  [${num}] ${tx.from} ${tx.nonce} ${tx.transactionIndex}`)
            
                if (privSender != tx.from) {
                    if (privSender != null) {
                        resultStr += ` * ${privSender} ${txCnt}\n`
                    }
                    privSender = tx.from
                    txCnt = 1
                }
                else {
                    txCnt++
                }
            }
            resultStr += ` * ${privSender} ${txCnt}\n`
        }

        let tpsResultStr = ` * block tps (max): ${maxTps}`
        LOG(tpsResultStr)

        LOG(`saving...(overwriting) ${resultPath}`)
        fs.writeFileSync(resultPath, resultStr+`\n===================\n${tpsResultStr}`)

        LOG(`saving... (updating) ${refPath}`)
        fs.appendFileSync(refPath, `${tpsResultStr}\n`)
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init().then(() => {
    return run()
})
