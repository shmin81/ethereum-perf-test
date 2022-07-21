// ##
// endpointfile에 정의된 수만큼 testAgent.js를 실행한다.
// default config 파일은 ./agent.json이며, 첫번째 실행 인자로 다른 config 파일 결로를 지정할 수 있다.

const fs = require('fs')
const spawn = require("child_process").spawn;
const utils = require('../common/utils')

const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)

const args = process.argv.slice(2)
if (args.length == 0) {
  ERROR('need configPath [ testAgentScriptPath(./test.Agent.erc20.js) saveLog (false) ]')
  INFO(`$ node controlAgent.js ../configs/local.cbdc.test.json ./test.Agent.doc.js true`)
}
const confPath = args[0]
const conf = utils.loadConf(confPath)

let nodeScript = './test.Agent.erc20.js'
if (args[1] != undefined && args[1] != null) {
  nodeScript = args[1]
}
if (fs.existsSync(nodeScript) == false) {
  console.error(`Not found '${nodeScript}'`)
  process.exit(2)
}

let saveLog = false
if (args[2] != undefined) {
  saveLog = args[2] === 'true' ? true : false
}

// ethereum node 
const endpointConf =  utils.loadJson(conf.endpointfile)
const minerCnt = endpointConf.length
INFO(`num of nodes: ${minerCnt}`)

// account
const accountConf = utils.loadJson(conf.accountfile)
const accountCnt = accountConf.length
INFO(`num of accounts: ${accountCnt} [${conf.numberOfAccounts}]`)

if ( minerCnt * conf.numberOfAccounts + conf.startAccountIdx > accountCnt) {
  ERROR(`account 개수 부족 (${minerCnt * conf.numberOfAccounts + conf.startAccountIdx}개의 계정셋이 필요함)`)
  process.exit(1)
}

let runningTask = 0
let childs = []
function newProcess(id, portNum, minerIdx, accountIdx) {
  runningTask++;
  //INFO(`=========================================================`);
  INFO(`[${id}] new test process => node ${nodeScript} ${portNum} ${minerIdx} ${accountIdx} ${confPath} ${saveLog}\n`);

  let process2 = spawn("node", [ nodeScript, portNum, minerIdx, accountIdx, confPath, saveLog ]);
  childs.push(process2)
  
  process2.stderr.on('data', function(data) {
      ERROR(`[${id}] ${data}`)
      exitAll()
  });
  process2.stdout.on('data', function(data) {
      let dataStr = data.toString();
      if (dataStr.startsWith('[SYSCMD] ')){
        let strs = dataStr.split()
        if (statusReporting) {
          console.log(`${new Date().toISOString()} [WARN] The other reporting is running ... (=> ${dataStr} is not run.)`)
        }
        else {
          runMakeReport(strs[1], id)
        }
      }
      else {
        INFO(`[${id}] ${dataStr}`)
      }
  });
  process2.on('exit', function(code) {
      runningTask--;
      let now = new Date();
      let msg = `${now.toISOString()} [${id}] exit [code: ${code}] -> ${runningTask} task remained.`;
      console.log(msg);
      exitAll()
  })
}

let exitReady = false
function exitAll() {
  
  childs.forEach(element => {
    INFO(`[pid:${element.pid}] ${element.spawnargs.join(' ')} -> kill...`)
    element.kill()
  });
  if (statusReporting == false) {
    process.exit(1);
  }
  else {
    exitReady = true
  }
}

let statusReporting = false
const nodeReportScript = 'make.reports.js'
function runMakeReport(projName, _id) {

  INFO(`[${_id}] run report process => node ${nodeReportScript} ${confPath} ${projName}\n`);

  let process3 = spawn("node", [ nodeReportScript, confPath, projName ]);
  statusReporting = true
  // 성능을 위해서 로그를 미출력??
  process3.stderr.on('data', function(data) {
      console.error(data.toString())
  })
  process3.stdout.on('data', function(data) {
    console.log(data.toString())
  })
  process2.on('exit', function(code) {
    if (exitReady) {
      process.exit(1);
    }
    statusReporting = false
  })
}

for (let i=0; i<minerCnt; i++) {
  newProcess(i, conf.startPortNumber+i, i, i*conf.numberOfAccounts+conf.startAccountIdx)
}
