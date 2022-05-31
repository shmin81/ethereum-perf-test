
const fs = require("fs");
const httpRequest = require('request-promise')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 2

let remained=100000000000
let tickInterval = 998
let param = []

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "http url" [ "Interval(1000 ms)" "MaxCount(100,000,000,000)" "param[0](nonceOffset=0)" ]');
    console.log('  ex) node single_runner.js localhost:10080 500 1000');
    process.exit(2); 
}

let httpRpcUrl = `http://${args[0]}/transfer`
INFO(`rpc: ${httpRpcUrl}`)

if (args[1] != undefined) {
    tickInterval = parseInt(args[1])
}
if (args[2] != undefined) {
    remained = parseInt(args[2])
}
if (args[3] != undefined) {
    param.push(args[3])
}
INFO(`test option => Interval:${tickInterval}, Tx:${remained}, nonceOffset:${param}`)
const maxCnt = remained
remained--; // 종료모드 관련 처리

fs.writeFileSync(confPath, tickInterval.toString());

function updateStatus() {

    fs.readFile(confPath, 'utf-8', (err, data) => {
        if (err) { console.log('read', confPath, err); }
        else { 
            let iVal = parseInt(data);
            //console.log(txid, 'read:',  data, iVal);
            if (iVal > 4 && iVal < 15000) {
                if (iVal != tickInterval) {
                    INFO(`update tx interval ${tickInterval} ====>>>> ${iVal}`);
                    tickInterval = iVal;
                }
            }
            else {
                // 종료 모드
                //remained = 0;
                process.exit(0)
            }
        }
    });
}

const body = {
    jsonrpc: "2.0",
    method: "transfer",
    params: param,
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

    body.id = reqId++    
    request.body = body
  
    let response = await httpRequest.post(request)
    //INFO(JSON.stringify(response, null, 2))
    if (response.statusCode == 200) {
      if (response.body.result == true){
        INFO(`Success ${reqId} ${response.body.accIdLock} ${response.body.nonce} ${response.body.res}`)
        return true
      }
    }

    ERROR(`It SHOULD NOT happen! - ${response.body}`)
    process.exit(1)
}

async function eachTest()
{
    if (remained > 0) {
        remained--;
        let timerId = setTimeout(function() { 
            eachTest();
        }, tickInterval-intervalOffset);
    }
    else {
        clearInterval(chkTimerId);
        process.exit(0)
    }

    sendhttp();
}

let chkTimerId;
async function mainTest() {

    eachTest();

    // 2초마다 설정값을 확인
    chkTimerId = setInterval(function() {
        updateStatus();
    }, 2000);
}

mainTest( );
