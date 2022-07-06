
const fs = require("fs");
const spawn = require("child_process").spawn;
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'target_tps.txt'

const nodeScript = './tps2Sub_transferMulti.js'
const nodeDelayOffset = 200 // 0 ~ 900 (process 시작 간격이 1초 정도 되는 듯)
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

    remained--;
    if (remained < 1) {
        remained = 0
        fs.writeFileSync(confPath, remained.toString());
    }
}


let runningTask = 0
let childs = []
function newProcess(id, agentRpc) {
  runningTask++;

  let delay_to_start_up = (minerCnt - id - 1) * nodeDelayOffset;
  //INFO(`=========================================================`);
  INFO(`[${id}] new test process => node ${nodeScript} ${agentRpc} ${delay_to_start_up}\n`);

  let process2 = spawn("node", [ nodeScript, agentRpc, delay_to_start_up ]);
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
      INFO(`[${id}] ${data}`)
  });
  process2.on('exit', function(code) {
      runningTask--;
      //let msg = `${(new Date()).toISOString()} [${id}] exit [code: ${code}] -> ${runningTask} task remained.`;
      //console.log(msg);
      if (chkTimerId != null) {
        clearInterval(chkTimerId);
      }
      //exitAll()
      setTimeout(exitAll, 2000)
  })
}

function exitAll() {

  if (runningTask > 0) {
    childs.forEach(element => {
        INFO(`[pid:${element.pid}] ${element.spawnargs.join(' ')} -> kill...`)
        element.kill()
    });
  }
  process.exit(1);
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
