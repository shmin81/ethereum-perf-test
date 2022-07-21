
const fs = require("fs");
const spawn = require("child_process").spawn;
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const INFOSUB = (msg) => process.stdout.write(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'target_tps.txt'

const nodeScript = './tps2Sub_transferMulti.js'
const nodeDelayOffset = 100 // 0 ~ 900 (각 process 시작 후, tx send 시작 간격)
// #####################################

let agent_ip = 'localhost'
let remained = 600
let targetTps = 200
const apiName = 'transferMulti'

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "config-path" [ "agent_ip(localhost)" "tps(200tps)" "TestTime(600s)" ]');
    console.log('  ex) node tps2Main_transferMulti.js ../configs/local.cbdc.test.json localhost 200 60');
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

INFO(`test option => target: ${agent_ip}, targetTps: ${targetTps} tps, testTime: ${remained} seconds`)

const conf = utils.loadConf(configPath)

// ethereum node 
const endpointConf =  utils.loadJson(conf.endpointfile)
const minerCnt = endpointConf.length
INFO(`num of nodes: ${minerCnt}`)
let rpcUrls = []
for (let i=0; i<minerCnt; i++) {
    rpcUrls.push(`http://${agent_ip}:${conf.startPortNumber+i}/${apiName}`)
}

//const nodeTargetTps = Math.floor(targetTps / minerCnt)
const nodeTargetTps = targetTps / minerCnt
if (nodeTargetTps > 2000) {
    ERROR(`target node Tps is too high, (each node's tps: ${nodeTargetTps}, target Tps: ${targetTps})`)
    process.exit(1)
}
fs.writeFileSync(confPath, (nodeTargetTps).toString());

function updateStatus() {

    if (Date.now() > startTime) {
        remained--;
    }
    if (remained < 0) {
        remained = 0
        fs.writeFileSync(confPath, remained.toString());
    }
}

const delayMilliSecond = (1200 + nodeDelayOffset) * minerCnt
INFO(`test run after ${(delayMilliSecond / 1000).toFixed(1)} seconds`)
let runningTask = 0
let childs = []
let startTime = Date.now() + delayMilliSecond
function newProcess(id, agentRpc) {
  runningTask++;

  let delay_to_start_up = startTime - (minerCnt - id - 1) * nodeDelayOffset;
  //INFO(`=========================================================`);
  INFO(`[${id}] new test process => node ${nodeScript} ${agentRpc} ${delay_to_start_up} ${remained}\n`);

  let process2 = spawn("node", [ nodeScript, agentRpc, delay_to_start_up, remained ]);
  childs.push(process2)
  
  process2.stderr.on('data', function(data) {
      //let dataStr = data.toString();
      ERROR(`[${id}] ${data}`)
      if (chkTimerId != null) {
        clearInterval(chkTimerId);
      }
      //exitAll()
      setTimeout(exitAll, 1000)
  });
  process2.stdout.on('data', function(data) {
    INFOSUB(`[${id}] ${data}`)
  });
  process2.on('exit', function(code) {
      runningTask--;
      if (exitCode == -1){
        exitCode = code
      }
      //let msg = `${(new Date()).toISOString()} [${id}] exit [code: ${code}] -> ${runningTask} task remained.`;
      //console.log(msg);
      if (chkTimerId != null) {
        clearInterval(chkTimerId);
      }
      //exitAll()
      setTimeout(exitAll, 2000)
  })
}
let exitCode = -1
function exitAll() {

  if (runningTask > 0) {
    childs.forEach(element => {
        if (element.killed == false) {
            INFO(`[pid:${element.pid}] ${element.spawnargs.join(' ')} -> kill...`)
            element.kill()
        }
    });
  }
  process.exit(exitCode);
}

let chkTimerId = null;
async function mainTest() {

    for (let i=0; i<minerCnt; i++) {
        newProcess(i, rpcUrls[i])
    }

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);
}

mainTest( );
