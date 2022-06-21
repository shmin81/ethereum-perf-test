
const fs = require("fs");
const spawn = require("child_process").spawn;
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

// 장기간 실행중 실행 간격을 변경하거나 실행을 종료하고자 할 경우, 이 파일의 값을 수정
const confPath = 'interval.txt'
const intervalOffset = 1

let agent_ip = 'localhost'
let remained = 600
let targetTps = 100
let tickInterval = 1000
let apiName = 'transfer'

const args = process.argv.slice(2);
if (args[0] == undefined) {
    console.log('Wrong input params - "config-path" [ "agent_ip(localhost)" "tps(100tps)" "TestTime(600s)"  "api(transfer)" ]');
    console.log('  ex) node temp2Main_single_thread.js ../configs/local.cbdc.test.json localhost 200 60');
    console.log('  ex) node temp2Main_single_thread.js ../configs/local.cbdc.test.json localhost 100 30 prepare');
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

function updateStatus() {

    remained--;
    if (remained < 1) {
        remained = 0
        fs.writeFileSync(confPath, remained.toString());
    }
}


const nodeScript = './temp2Sub_single_thread.js'

let runningTask = 0
let childs = []
function newProcess(id, agentRpc) {
  runningTask++;
  //INFO(`=========================================================`);
  INFO(`[${id}] new test process => node ${nodeScript} ${agentRpc}\n`);

  let process2 = spawn("node", [ nodeScript, agentRpc ]);
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

let startTime = null
let chkTimerId = null;
async function mainTest() {

    startTime = new Date()
    INFO(`start time: ${startTime.toISOString()}`)

    for (let i=0; i<minerCnt; i++) {
        newProcess(i, rpcUrls[i])
    }

    chkTimerId = setInterval(function() {
        updateStatus();
    }, 1000);
}

mainTest( );
