
const fs = require("fs");
const httpRequest = require('request-promise')

// const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const INFO = (msg) => console.log(`[INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 1

let remained=100000000000
let tickInterval = 1000
let apiName = 'transfer'

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "http url" [ "Interval(1000 ms)" "MaxCount(100,000,000,000)"  "api(transfer)" ]');
    console.log('  ex) node single_runner.js localhost:10080 500 1000');
    process.exit(2); 
}

if (args[1] != undefined) {
    tickInterval = Number(args[1])
}
if (args[2] != undefined) {
    remained = Number(args[2])
}
if (args[3] != undefined) {
    apiName = String(args[3])
}
INFO(`test option => Interval:${tickInterval}, Tx:${remained}`)

let httpRpcUrl = `http://${args[0]}/${apiName}`
INFO(`rpc: ${httpRpcUrl}`)

fs.writeFileSync(confPath, (tickInterval).toString());
tickInterval -= intervalOffset

function updateStatus() {

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
    method: "ok",
    params: [],
    id: 0
}

const request = {
    method: 'POST',
    uri: httpRpcUrl,
    json: true,
    headers: {'Content-Type': 'application/json'},
    resolveWithFullResponse: true,
    timeout: 5000,
    body: {}
}
let reqId = 0
async function sendhttp() {
    let requestId = reqId++
    body.id = requestId 
    request.body = body
    //INFO(JSON.stringify(request, null, 2))
    let response = await httpRequest.post(request)
    //INFO(JSON.stringify(response, null, 2))
    if (response.statusCode == 200) {
      if (response.body.result == true){
        INFO(`${requestId}: Success ${response.body.accIdx} ${response.body.nonce} ${response.body.res}`)
        return true
      }
    }

    ERROR(JSON.stringify(response, null, 2))
    process.exit(1)
}

async function eachTest()
{
    if (--remained > 0) {
        let timerId = setTimeout(function() { 
            eachTest();
        }, tickInterval);
    }
    else {
        let endTime = new Date()
        INFO(`end time: ${endTime.toISOString()}`)
        INFO(`time: ${(endTime-startTime)/1000} seconds`)
        if (chkTimerId != null) {
            clearInterval(chkTimerId);
        }
    }

    sendhttp();
}

let startTime = null
let chkTimerId = null;
async function mainTest() {

    // test 예상 시간이 1분 이상인 경우
    if (remained * (tickInterval+intervalOffset) > 60 * 1000) {
        // 2초마다 설정값을 확인
        chkTimerId = setInterval(function() {
            updateStatus();
        }, 2000);
    }

    startTime = new Date()
    INFO(`start time: ${startTime.toISOString()}`)
    
    eachTest();
}

mainTest( );
