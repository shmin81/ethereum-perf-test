
const fs = require("fs");
const httpRequest = require('request-promise')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 1

loadInterval()

let isRunning = true
let tickInterval = 1000
let numTxs = [ ]
numTxs.push(0)

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "agent_rpc"');
    console.log('  ex) node runnerSub_single_thread.js http://localhost:10080/transfer');
    process.exit(2);
}

const rpcUrl = args[0]
INFO(rpcUrl)

let runningItems = 0

let chkCnt = 0
let before = 0
function updateStatus() {

    let lastIdx = reqId
    //INFO(`===== ${chkCnt} updateStatus [${lastIdx}] =====`)
    numTxs.push(lastIdx)
    if (++chkCnt > 4) {
        let firstIdx = numTxs.shift()    
        //INFO(`* [${chkCnt}] tx : ${firstIdx}~${lastIdx}, tps(5s) : ${(lastIdx-firstIdx) / 5}, tps(1s) : ${(lastIdx-before)}`)
        INFO(`* ${chkCnt} seconds... active:${runningItems} tx: ${lastIdx}, tps(5s): ${(lastIdx-firstIdx) / 5}, tps(1s): ${(lastIdx-before)}`)
    }
    before = lastIdx
    
    loadInterval()
}

function loadInterval() {
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
                isRunning = false;
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
    uri: rpcUrl,
    json: true,
    headers: {'Content-Type': 'application/json'},
    resolveWithFullResponse: true,
    timeout: 5000,
    //agent: false,
    body: {}
}

let reqId = 0
//let rpcIdx = 0
async function sendhttp() {
    runningItems++

    let requestId = reqId++
    body.id = requestId
    request.body = body
    //INFO(JSON.stringify(request, null, 2))
    let response = await httpRequest.post(request)
    runningItems--
    //INFO(JSON.stringify(response, null, 2))
    if (response.statusCode == 200) {
      if (response.body.result == true){
        //INFO(`${requestId}: Success ${reqNodeIdx} ${response.body.accIdx} ${response.body.nonce} ${response.body.res}`)
        //INFO(`${requestId} ${reqNodeIdx} ${response.body.res}`)
        //console.log(`${requestId} ${response.body.res}`)
        return
      }
    }

    ERROR(JSON.stringify(response, null, 2))
    process.exit(1)
}

async function eachTest()
{
    if (isRunning) {
        let timerId = setTimeout(function() { 
            eachTest();
        }, tickInterval);
    }
    else {
        let endTime = new Date()
        let offsetTime = (endTime-startTime)/1000
        INFO(`tx: ${reqId}, tps(avg): ${reqId/offsetTime}, time: ${offsetTime} seconds`)
        //INFO(`end time: ${endTime.toISOString()}`)

        if (chkTimerId != null) {
            clearInterval(chkTimerId);
        }
        return
    }
    sendhttp()
}

let startTime = null
let chkTimerId = null;
async function mainTest() {

    startTime = new Date()

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);

    eachTest();
}

mainTest();
