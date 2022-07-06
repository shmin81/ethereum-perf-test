
const fs = require("fs");
const httpRequest = require('request-promise')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'target_tps.txt'

loadInterval()

let isRunning = true
let tickInterval = 1000
let numTxs = [ ]
numTxs.push(0)

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "agent_rpc" [ delay_start_up_time(ms) ]');
    console.log('  ex) node tps2Sub_single_thread.js http://localhost:10080/transfer');
    process.exit(2);
}

const rpcUrl = args[0]
INFO(rpcUrl)
//console.log(`${new Date().toISOString()} [INFO] '${args[1]}'`)
if (args[1] != undefined) {
    const ms = Number(args[1])
    if (isNaN(ms)) {
        ERROR(`Wrong input params(delay_start_up_time): ${args[1]}`)
        process.exit(2)
    }
    // delay 
    const wakeUpTime = Date.now() + ms;
    while (Date.now() < wakeUpTime) { }
    //console.log(`${new Date().toISOString()} [INFO] '${ms}' '${wakeUpTime}'`)
}

let sendLoopCnt = 1
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
            let nVal = Number(data)
            let iVal = 0
            if (!isNaN(nVal)) {
                iVal = Math.round(nVal)
            }
            //console.log('read:', data, '->', iVal, '-', nVal);
            if (iVal > 0) {
                if (iVal > 800) {
                    // too high
                    sendLoopCnt = 5
                }
                else if (iVal > 600) {
                    sendLoopCnt = 4
                }
                else if (iVal > 400) {
                    sendLoopCnt = 3
                }
                else if (iVal > 200) {
                    sendLoopCnt = 2
                }
                else {
                    sendLoopCnt = 1
                }
                let newTickInterval = Math.round(sendLoopCnt * 1000 / nVal)
                if (tickInterval != newTickInterval) {
                    tickInterval = newTickInterval
                    INFO(`set tickInterval: ${tickInterval}, send tx: ${sendLoopCnt}`)
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
    method: "ok",
    params: [ ],
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
        let offsetTime = (endTime-startTime-tickInterval)/1000
        INFO(`tx: ${reqId}, tps(avg): ${(reqId/offsetTime).toFixed(3)}, time: ${offsetTime} seconds`)
        //INFO(`end time: ${endTime.toISOString()}`)

        if (chkTimerId != null) {
            clearInterval(chkTimerId);
        }
        return
    }
    for (let i=0; i<sendLoopCnt; i++) {
        sendhttp()
    }
}

let startTime = null
let chkTimerId = null;
async function mainTest() {

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);

    startTime = new Date()
    eachTest();
}

mainTest();
