// 22.7.20 
const fs = require('fs')
const spawn = require("child_process").spawn;
const utils = require('../common/utils')

let projectName = 'testX'
const INFO = (msg) => console.log(msg)
const INFOSUB = (msg) => { if (debug) console.log(msg) }
const ERROR = (msg) => console.error(`[${projectName}] ${msg}`)

const debug=false

let startTime = new Date()
const args = process.argv.slice(2)
if (args.length == 0) {
  ERROR('need configPath [ projectName (default: testX) ]')
  INFO(`$ node make.reports.js ../configs/local.cbdc.test.json testA_01`)
}
const confPath = args[0]
const conf = utils.loadConf(confPath) // check test

if (args[1] != undefined && args[1] != null) {
  projectName = args[1]
}

let nodeScript = './verify.tx.latency.js'
if (fs.existsSync(nodeScript) == false) {
  console.error(`Not found '${nodeScript}'`)
  process.exit(2)
}

function firstProcess(id, inputConf) {

  INFO(`*${id}* new process => node ${nodeScript} ${confPath}`);

  return new Promise(function(resolve, reject) {
    let process1 = spawn("node", [ nodeScript, confPath, inputConf, id ]);
    
    process1.stderr.on('data', function(data) {
        ERROR(data)
        reject(false)
    });
    process1.stdout.on('data', function(data) {
        INFOSUB(data)
    });
    process1.on('exit', function(code) {
      resolve(code)
    })
  })
}

async function nextProcess(id) {

  INFO(`*${id}* new process => node verify.tx.latency2.js`);

  return new Promise(function(resolve, reject) {

    let process2 = spawn("node", [ 'verify.tx.latency2.js' ]);
    
    process2.stderr.on('data', function(data) {
        ERROR(data)
        reject(false)
    });
    process2.stdout.on('data', function(data) {
        INFOSUB(data)
    });
    process2.on('exit', function(code) {
        resolve(code)
    })
  })
}

async function finalProcess(id) {

  INFO(`*${id}* new process => node verify.block.js`);

  return new Promise(function(resolve, reject) {

    let process3 = spawn("node", [ 'verify.block.js', confPath ]);
    
    process3.stderr.on('data', function(data) {
        ERROR(data)
        reject(false)
    });
    process3.stdout.on('data', function(data) {
        INFOSUB(data)
    });
    process3.on('exit', function(code) {
        resolve(code)
    })
  })
}

async function mainTest() {
  let files = fs.readdirSync(__dirname);
  let cntt = 0
  let errCode = 0
  try {
    let cfiles = fs.readdirSync(__dirname);
    for (let j=0; j<cfiles.length; j++) {
      let ff = cfiles[j]
      if (ff.startsWith('verify.results.') && ff.endsWith('.log')) {
        fs.unlinkSync(`./${ff}`)
      }
    }

    let resultCode = 0
    for (let i=0; i<files.length; i++) {
      let ff = files[i]
      if (ff.startsWith('test.') && ff.endsWith('.log')) {
        resultCode = await firstProcess(++cntt, files[i])
        INFO(`*${cntt}* script done - resultCode: ${resultCode}`)
      }
    }

    resultCode = await nextProcess(++cntt)
    INFO(`*${cntt}* script done - resultCode: ${resultCode}`)
    if (resultCode > 0) {
      // 종료한다.
      process.exit(1)
    }

    resultCode = await finalProcess(++cntt)
    INFO(`*${cntt}* script done - resultCode: ${resultCode}`)

    if (fs.existsSync(`./${projectName}.old`)) {
      let rfiles = fs.readdirSync(`./${projectName}.old`)
      for (let j=0; j<rfiles.length; j++) {
        fs.unlinkSync(`./${projectName}.old/${rfiles[j]}`)
      }
      fs.rmdirSync(`./${projectName}.old`)
    }

    if (fs.existsSync(`./${projectName}`)) {
      fs.renameSync(`./${projectName}`, `./${projectName}.old`)
    }
    
    INFO(`copying to ./${projectName}`)
    fs.mkdirSync(projectName)
    let rfiles = fs.readdirSync(__dirname)
    for (let j=0; j<rfiles.length; j++) {
      let ff = rfiles[j]
      if (ff.startsWith('verify.results.') && ff.endsWith('.log')) {
        fs.renameSync(`./${ff}`, `./${projectName}/${ff}`)
      }
      if (ff.startsWith('test.') && ff.endsWith('.log')) {
        fs.renameSync(`./${ff}`, `./${projectName}/${ff}`)
      }
    }
  }
  catch(err) {
      ERROR(`Failed(${cntt} step) - ${err}`)
      errCode=1
  }
  INFO(`[${new Date().toISOString()}] done [running tims: ${(new Date()) - startTime} ms]`)
  process.exit(errCode)
}

mainTest()
