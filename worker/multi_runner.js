
const fs = require("fs");
const httpRequest = require('request-promise')
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 2

let agent_ip = 'localhost'
let remained=100000000000
let tickInterval = 1000
let param = []

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "config-path" [ "agent_ip(localhost)" "Interval(1000 ms)" "MaxCount(100,000,000,000)" "param[0](nonceOffset=0)" ]');
    console.log('  ex) node multi_runner.js ../configs/local.cbdc.test.json localhost 500 1000');
    process.exit(2); 
}

const configPath = args[0]
if (args[1] != undefined) {
    agent_ip = args[1]
}
if (args[2] != undefined) {
    tickInterval = parseInt(args[2])
}
if (args[3] != undefined) {
    remained = parseInt(args[3])
}
if (args[4] != undefined) {
    param.push(args[4])
}
INFO(`test option => Interval:${tickInterval}, Tx:${remained}, nonceOffset:${param}`)
//const maxCnt = remained

const conf = utils.loadConf(configPath)

// ethereum node 
const endpointConf =  utils.loadJson(conf.endpointfile)
const minerCnt = endpointConf.length
INFO(`num of nodes: ${minerCnt}`)
let rpcUrls = []
for (let i=0; i<minerCnt; i++) {
    rpcUrls.push(`http://${agent_ip}:${conf.startPortNumber+i}/transfer`)
}

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
    uri: 'http',
    json: true,
    headers: {'Content-Type': 'application/json'},
    resolveWithFullResponse: true,
    timeout: 5000,
    body: {}
}
let reqId = 0
let rpcIdx = 0
async function sendhttp() {
     if (rpcIdx == minerCnt) {
        rpcIdx = 0
    }
    let requestId = reqId++
    body.id = requestId
    request.uri = rpcUrls[rpcIdx++]
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
        clearInterval(chkTimerId);
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
