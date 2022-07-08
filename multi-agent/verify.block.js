
const fs = require("fs");
const utils = require('../common/utils')
const Web3 = require('web3')
const Web3Utils = require('web3-utils');

const config = require("../config")
const conf = config.prepare()

//const logPath = './verify.block.log'
const resultPath = './verify.tx.results.block.log'
const LOG = (msg, saveLog=false) =>  {
    console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)
    // if (saveLog) {
    //     fs.appendFileSync(logPath, msg+'\n')
    // }
}

const MaxScanRangeNotFoundTx = 5
let blockNumber = 0
const args = process.argv.slice(2);
if (args[0] == undefined || args[0].indexOf('help') != -1) {
    console.log('Wrong input params - "configPath [ blockNumber (int) ]"');
    console.log('  ex) 100번쨰 블록에서 시작하여 이전 블록들을 스캔: node verify.block.js ../configs/local.cbdc.test.json 100');
    process.exit(2);
}
else if (args[1] != undefined) {
    blockNumber = parseInt(args[1])
    if (blockNumber <= MaxScanRangeNotFoundTx) {
        console.log(`Wrong input optional param - "blockNumber": ${blockNumber}`);
        process.exit(2);
    }
}

let httpRpcUrl = ''
let web3 = null

async function init() {
	LOG(JSON.stringify(conf))
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

	let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    web3 = new Web3(httpProvider)

    let latestBlockNum = await web3.eth.getBlockNumber()
    if (latestBlockNum < blockNumber) {
        console.log(`wrong input the future's blockNumber": ${blockNumber}`);
        process.exit(2);
    }
    else if (blockNumber == 0) {
        blockNumber = latestBlockNum
    }
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

            blockInfo = await web3.eth.getBlock(blockNumber)
            LOG(`BlockNumber (${blockNumber}) -miner: ${blockInfo.miner} -tx count: ${blockInfo.transactions.length}`, blockInfo.transactions.length > 0)

            // 직전에 조회한 블록의 TPS
            if (nextBlockTxCount > 0) {
                let tpsTmp = nextBlockTxCount / (nextBlockTimeStamp - blockInfo.timestamp)
                resultStr += ` - block tps: ${tpsTmp}\n`
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
            resultStr += `BlockNumber: ${blockNumber} -miner: ${blockInfo.miner} -timestamp: ${blockInfo.timestamp} -block tx: ${nextBlockTxCount} -gas: ${gasUsedP} %\n`
            let privSender = null
            let txCnt = 0
            for (let i=0; i<nextBlockTxCount; i++) {
                let tx = blockInfo.transactions[i]
                let num = String(i)
                while(num.length < 4) {
                    num = '0' + num
                }
                LOG(`  [${num}] ${tx.from} ${tx.nonce} ${tx.transactionIndex}`, true)
            
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

        let tpsResultStr = ` * max TPS: ${maxTps}`
        LOG(tpsResultStr)

        console.log('saving...')
        fs.writeFileSync(resultPath, resultStr+`\n===================\n${tpsResultStr}`)
	}
	catch (err) {
		LOG(err); 
	}
	LOG('  =======  done  ======')
}

init().then(() => {
    return run()
})
