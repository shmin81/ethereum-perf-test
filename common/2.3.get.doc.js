
const Web3Utils = require('web3-utils');

const utils = require('./utils')
const test = require('./test.doc')

const LOG = (msg) => console.log(`[${new Date().toISOString()}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}`)

//=============================
const args = process.argv.slice(2)
if (args.length != 1) {
  console.log('node  2.3.get.doc.js  configPath')
  process.exit(0)
}

let confPath = args[0]

let conf = null
let accountFrom = null
let accountConf = null
let response = null
async function init() {
	conf = utils.loadConf(confPath)
	LOG(JSON.stringify(conf))

    accountFrom = utils.convertPrivKeyToAccount(conf.ownerPrivKey)
    LOG(`Sender: ${accountFrom.address}`)
	
	const endpointConf = utils.loadJson(conf.endpointfile)
    httpRpcUrl = endpointConf[0]
    LOG(`RPC: ${httpRpcUrl}`)

    accountConf = utils.loadJson(conf.accountfile)

    test.setTestEnv(httpRpcUrl, conf)
}

async function run() {
    let resultStrLog = 'documents of each user\n'
    const acountCnt = accountConf.length
    LOG(`Account Count: ${acountCnt}\n`)
    //LOG('***** get document count *****')
    for (let i=0; i<acountCnt; i++) {
        const acc = accountConf[i]
        response = await test.getDocCount(acc.sender)
        LOG(`${i} ${acc.sender} => document count: ${response}`)
        resultStrLog += `${i} ${acc.sender}: ${response}\n`
        let docuCnt = Number(response)

        if (docuCnt > 0) {
            LOG('***** get documents *****')
            for (let j=0; j<docuCnt; j++) {
                let id_str = acc.sender + j.toString()
                let documentId = Web3Utils.hexToNumberString(id_str)
                response = await test.getDoc(documentId)
                LOG(`${i} document: ${JSON.stringify(response, null, 2)}`)
            }
        }
    }
    LOG("*****************************\n")
    LOG(resultStrLog)
}

init()
run()
