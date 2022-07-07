
const fs = require("fs");
const httpRequest = require('request-promise')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'target_tps.txt'

let isRunning = true
let tickInterval = 1000
let sendLoopCnt = 2
let numTxs = [ ]
numTxs.push(0)

const body = {
    jsonrpc: "2.0",
    method: "ok",
    params: [ sendLoopCnt ],
    id: 0
}

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "agent_rpc" [ start_up_time(ms) ]');
    console.log('  ex) node tps2Sub_single_thread.js http://localhost:10080/transferMulti');
    process.exit(2);
}

// loadInterval()
let tps = fs.readFileSync(confPath)
if (isNaN(Number(tps))) {
    ERROR(`wrong ... ${confPath} -> ${tps}`)
    return
}
updateInterval(Number(tps))

const rpcUrl = args[0]
INFO(rpcUrl)
//console.log(`${new Date().toISOString()} [INFO] '${args[1]}'`)
if (args[1] != undefined) {
    const wakeUpTime = Number(args[1])
    if (isNaN(wakeUpTime)) {
        ERROR(`Wrong input params(start_up_time): ${args[1]}`)
        process.exit(2)
    }
    // delay 
    //const wakeUpTime = Date.now() + ms;
    while (Date.now() < wakeUpTime) { }
    //console.log(`${new Date().toISOString()} [INFO] '${ms}' '${wakeUpTime}'`)
}

let runningItems = 0
let chkCnt = 0
let before = 0
function updateStatus() {

    //let lastIdx = reqId
    let lastIdx = successCount
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
            if (!isNaN(nVal)) {
                updateInterval(nVal)
            }
        }
    });
}

function updateInterval(_nVal) {

    let iVal = Math.round(_nVal)

    //console.log('read:', data, '-', iVal);
    if (iVal > 0) {
        if (iVal > 300) {
            // too high
            sendLoopCnt = 5
        }
        else if (iVal > 200) {
            sendLoopCnt = 4
        }
        else if (iVal > 100) {
            sendLoopCnt = 3
        }
        else {
            sendLoopCnt = 2
        }

        let newTickInterval = Math.round(sendLoopCnt * 1000 / _nVal)
        if (tickInterval != newTickInterval) {
            tickInterval = newTickInterval
            INFO(`set -tickInterval: ${tickInterval}, -multi-tx: ${sendLoopCnt}`)
            body.params = [ sendLoopCnt ]
        }
    }
    else {
        // 종료 모드
        isRunning = false;
        //process.exit(0)
    }
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
let successCount = 0
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
        //console.log(`${requestId} ${JSON.stringify(response.body)}`)
        successCount += response.body.success
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
        // 종료시
        let endTime = new Date()
        let offsetTime = (endTime - startTime - tickInterval)/1000
        INFO(`tx: ${successCount}, tps(avg): ${(successCount/offsetTime).toFixed(3)}, time: ${offsetTime} seconds`)
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

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);

    INFO('starting...')
    startTime = new Date()
    eachTest();
}

mainTest();
