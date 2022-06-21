
const fs = require("fs");
const httpRequest = require('request-promise')
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 1

let agent_ip = 'localhost'
let remained = 600
let apiName = 'transfer'
let targetTps = 100
let tickInterval = 1000
let numTxs = [ ]
numTxs.push(0)

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "config-path" [ "agent_ip(localhost)" "tps(100tps)" "TestTime(600s)" "api(transfer)" ]');
    console.log('  ex) node send_multi_runner.js ../configs/local.cbdc.test.json localhost 200 60');
    console.log('  ex) node send_multi_runner.js ../configs/local.cbdc.test.json localhost 500 30 prepare');
    process.exit(2); 
}

const configPath = args[0]
if (args[1] != undefined) {
    agent_ip = args[1]
}
if (args[2] != undefined) {
    targetTps = Number(args[2])
}
if (args[3] != undefined) {
    remained = Number(args[3])
}
if (args[4] != undefined) {
    apiName = String(args[4])
}

INFO(`test option => target: ${agent_ip}, targetTps: ${targetTps} tps, testTime: ${remained} seconds`)
//const maxCnt = remained

const conf = utils.loadConf(configPath)

// ethereum node 
const endpointConf =  utils.loadJson(conf.endpointfile)
const minerCnt = endpointConf.length
INFO(`num of nodes: ${minerCnt}`)
let rpcUrls = []
for (let i=0; i<minerCnt; i++) {
    rpcUrls.push(`http://${agent_ip}:${conf.startPortNumber+i}/${apiName}`)
}
tickInterval = Math.floor(1000 * minerCnt / targetTps) 
if (tickInterval - intervalOffset < 2) {
    ERROR(`targetTps is too big, (tickInterval: ${tickInterval}, targetTps: ${targetTps})`)
    process.exit(1)
}

fs.writeFileSync(confPath, (tickInterval).toString());
tickInterval -= intervalOffset

let chkCnt = 0
let before = 0
function updateStatus() {

    let lastIdx = reqId
    //INFO(`===== ${chkCnt} updateStatus [${remained} - ${lastIdx}] =====`)
    numTxs.push(lastIdx)
    if (++chkCnt > 4) {
        let firstIdx = numTxs.shift()    
        //INFO(`* [${chkCnt}] tx : ${firstIdx}~${lastIdx}, tps(5s) : ${(lastIdx-firstIdx) / 5}, tps(1s) : ${(lastIdx-before)}`)
        INFO(`* ${chkCnt} seconds... tx: ${lastIdx}, tps(5s): ${(lastIdx-firstIdx) / 5}, tps(1s): ${(lastIdx-before)}`)
    }
    before = lastIdx

    remained--;
    fs.readFile(confPath, 'utf-8', (err, data) => {
        if (err) { console.log('read', confPath, err); }
        else { 
            let iVal = parseInt(data);
            //console.log(txid, 'read:',  data, iVal);
            if (iVal > intervalOffset) {
                if (iVal != (tickInterval+intervalOffset)) {
                    INFO(`update tx interval ${tickInterval+intervalOffset} ====>>>> ${iVal}`);
                    tickInterval = iVal-intervalOffset;
                }
            }
            else if (iVal > 0) {
                if (tickInterval > 2) {
                    INFO(`update tx interval ${tickInterval+intervalOffset} ====>>>> ${iVal}`);
                    tickInterval = iVal
                }
                else {
                    // 변경 필요없음
                }
            }
            else {
                // 종료 모드
                remained = 0;
                //process.exit(0)
            }
        }
    });
}

const body = {
    jsonrpc: "2.0",
    method: "transfer",
    params: [],
    id: 0
}

const request = {
    method: 'POST',
    uri: 'http',
    json: true,
    headers: {'Content-Type': 'application/json'},
    resolveWithFullResponse: true,
    timeout: 5000,
    agent: false,
    body: {}
}

let reqId = 0
//let rpcIdx = 0
async function sendhttp(reqNodeIdx) {
    /*if (rpcIdx == minerCnt) {
        rpcIdx = 0
    }
    let reqNodeIdx = rpcIdx++*/
    let requestId = reqId++
    body.id = requestId
    request.uri = rpcUrls[reqNodeIdx]
    request.body = body
    //INFO(JSON.stringify(request, null, 2))
    let response = await httpRequest.post(request)
    //INFO(JSON.stringify(response, null, 2))
    if (response.statusCode == 200) {
      if (response.body.result == true){
        //INFO(`${requestId}: Success ${reqNodeIdx} ${response.body.accIdx} ${response.body.nonce} ${response.body.res}`)
        //INFO(`${requestId} ${reqNodeIdx} ${response.body.res}`)
        //console.log(`${requestId} ${reqNodeIdx} ${response.body.res}`)
        return
      }
    }

    ERROR(JSON.stringify(response, null, 2))
    process.exit(1)
}

async function eachTest()
{
    if (remained > 0) {
        let timerId = setTimeout(function() { 
            eachTest();
        }, tickInterval);
    }
    else {
        let endTime = new Date()
        let offsetTime = (endTime-startTime)/1000
        INFO(`tx: ${reqId}, tps(avg): ${reqId/offsetTime}`)
        
        INFO(`end time: ${endTime.toISOString()}`)
        INFO(`time: ${offsetTime} seconds`)
        if (chkTimerId != null) {
            clearInterval(chkTimerId);
        }
        return
    }

    for (let i=0; i<minerCnt; i++) {
        sendhttp(i);
    }
}

let startTime = null
let chkTimerId = null;
async function mainTest() {

    startTime = new Date()
    INFO(`start time: ${startTime.toISOString()}`)

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);

    eachTest();
}

mainTest( );
