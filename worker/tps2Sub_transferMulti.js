
const fs = require("fs");
const httpRequest = require('request-promise')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)

const debug = false  // 정송 TPS 정보를 매초마다 보고 싶을 경우 (default: 20초마다 출력)
const tpsAllowOffset = 2

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'target_tps.txt'

let isRunning = true
let displayLogInterval = 60 // 60 sec
let tickInterval = 1000
let maxTps = 0
let minTps = 0
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
    INFO('Wrong input params - "agent_rpc" [ start_up_time(ms) working_time(s) ]');
    INFO('  ex) node tps2Sub_single_thread.js http://localhost:10080/transferMulti');
    process.exit(2);
}

let savedTps = fs.readFileSync(confPath)
if (isNaN(Number(savedTps))) {
    ERROR(`wrong data: '${savedTps}' (${confPath})`)
    process.exit(2);
}
updateInterval(Number(savedTps))

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

let remainWorkTime = -1
if (args[2] != undefined) {
    remainWorkTime = Number(args[2])
    if (isNaN(remainWorkTime) || remainWorkTime < 1) {
        ERROR(`Wrong input params(working_time): ${args[2]}`)
        process.exit(2)
    }
    remainWorkTime = Math.round(remainWorkTime)

    if (remainWorkTime <= 120) {
        displayLogInterval = 10
    }
    else if (remainWorkTime <= 1200) { // 20 minutes
        displayLogInterval = 20
    }
    else if (remainWorkTime < 3600) { // 1 hour
        displayLogInterval = 30
    }
}

let runningItems = 0
let chkCnt = 0
let before = 0
function updateStatus() {

    //let lastIdx = reqId
    let lastIdx = sendCount
    let lastIdx2 = successCount
    let nowOffset = ((new Date()) - startTime) / 1000
    let allTps = lastIdx / nowOffset
    numTxs.push(lastIdx)
    if (++chkCnt > 4) {
        let firstIdx = numTxs.shift()
        let tps5s = (lastIdx-firstIdx) / 5.0
        let tps1s = lastIdx-before

        if (debug || (remainWorkTime < 6 || (remainWorkTime % displayLogInterval == 0))) {
            // INFO(`* ${chkCnt} seconds... active:${runningItems} requested tx: ${lastIdx}, responsed tx: ${lastIdx2}, tps(5s): ${tps5s.toFixed(1)}, tps(1s): ${tps1s}`)
            INFO(`* ${chkCnt} seconds... active:${runningItems} requested tx: ${lastIdx}, responsed tx: ${lastIdx2}, tps:${allTps.toFixed(1)}, tps(5s): ${tps5s}, tps(1s): ${tps1s}`)
        }
        
        // response 기준에서 request 기준으로 변경되어 주석처리함
        // if (runningItems < tpsAllowOffset) {  ...
        if (allTps > maxTps && tps1s > savedTps) {
            tickInterval++
            if (debug) {
                INFO(`[${chkCnt}s] tps down -> interval(+): ${tickInterval} (tps: ${allTps.toFixed(1)}, ${tps5s}, ${tps1s})`)
            }
        }
        else if (allTps < minTps && tps1s < savedTps) {
            tickInterval--
            if (debug) {
                INFO(`[${chkCnt}s] tps up -> interval(-): ${tickInterval} (tps: ${allTps.toFixed(1)}, ${tps5s}, ${tps1s})`)
            }
        }
    }
    before = lastIdx
    
    loadInterval()

    if (remainWorkTime !=  -1) {
        remainWorkTime -= 1
        if (remainWorkTime == 0) {
            // 종료 모드
            isRunning = false;
        }
    }
}

function loadInterval() {
    fs.readFile(confPath, 'utf-8', (err, data) => {
        if (err) { console.log('read', confPath, err); }
        else if (savedTps != data) {
            let nVal = Number(data)
            if (isNaN(nVal)) {
                INFO(`[SKIP] wrong data: ${_nVal}`)
            }
            else {
                savedTps = data
                updateInterval(nVal)
            }
        }
    });
}

function updateInterval(_nVal) {

    maxTps = _nVal + tpsAllowOffset
    minTps = _nVal - tpsAllowOffset
    INFO(' * set target tps:', _nVal, "(", minTps, "~", maxTps, ")")

    let iVal = Math.round(_nVal)
    if (iVal > 0) {
        if (iVal >= 400) {
            // too high
            sendLoopCnt = 10
        }
        else if (iVal >= 200) {
            sendLoopCnt = 5
        }
        else {
            sendLoopCnt = 2
        }

        let newTickInterval = Math.round(sendLoopCnt * 1000 / _nVal)
        if (tickInterval != newTickInterval) {
            tickInterval = newTickInterval
            INFO(`set -tps: ${_nVal} -tickInterval: ${tickInterval}, -multi-tx: ${sendLoopCnt}`)
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
    body: {}
}

let reqId = 0
let successCount = 0
let sendCount = 0
async function sendhttp() {
    runningItems++

    let requestId = reqId++
    body.id = requestId
    request.body = body
    sendCount += sendLoopCnt
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
    // process.exit(1)
    isRunning = false;
}

let readyEnd = false
async function eachTest()
{
    if (isRunning) {
        let timerId = setTimeout(function() { 
            eachTest()
        }, tickInterval)

        sendhttp()
    }
    else {
        let endTime = new Date()
        let offsetTime = (endTime - startTime - tickInterval) / 1000

        if (chkTimerId != null) {
            clearInterval(chkTimerId)
            chkTimerId = null
        }

        if (runningItems > 0) {
            let timerIdx2 = setTimeout(function() { 
                eachTest()
            }, tickInterval)
            
            if (!readyEnd) {  
                readyEnd = true 
                INFO(`sended tx: ${sendCount}, processed tx: ${successCount}, tps(avg): ${(successCount/offsetTime).toFixed(3)}, time: ${offsetTime} seconds`)
            }
            return
        }
        INFO(`processed tx: ${successCount}, tps(avg): ${(successCount/offsetTime).toFixed(3)}, time: ${offsetTime} seconds`)
    }
}

let startTime = null
let chkTimerId = null
async function mainTest() {

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);

    INFO('starting...')
    startTime = new Date()
    eachTest();
}

mainTest();
