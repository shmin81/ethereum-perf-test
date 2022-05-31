
const fs = require('fs');
const Web3 = require('web3');
const utils = require('../common/utils')

const web3 = new Web3(new Web3.providers.HttpProvider('http://dev-testnet.chainz.biz'));

let accountCounts = 10  // max: 9999

const pkListFile = '../configs/account.json';

const PrePrivKeyFrom = '0x20210101000000000000000000000000000000000000000000000000000000'; // string 
const PrePrivKeyTo   = '0x20210505000000000000000000000000000000000000000000000000000000'; // string 

const args = process.argv.slice(2)
if (args.length == 1) {
    accountCounts = Number(args[0])
}
console.log('creating...', accountCounts, ' users')
utils.sleep(2000)

var writer = fs.createWriteStream(pkListFile);
writer.write('[{\n');


function makeAcc(num) {
    let hexNum = num.toString(16);
    if (hexNum.length > 4) {
        throw new Error('PrivKeyNum value is too big.');
    }
    while (hexNum.length < 4) {
        hexNum = '0' + hexNum;
    }

    let fromPrivKey = PrePrivKeyFrom.substring(0, 62) + hexNum;
    let toPrivKey = PrePrivKeyTo.substring(0, 62) + hexNum;
    let name = `  "name": "User-${num.toString().padStart(4,'0')}",\n`;
    const account = web3.eth.accounts.privateKeyToAccount(fromPrivKey);
    let sender = `  "sender": "${account.address}",\n`;
    let privKey = `  "privKey": "${fromPrivKey.substring(2)}",\n`;
    const accountTo = web3.eth.accounts.privateKeyToAccount(toPrivKey);
    let receiver = `  "receiver": "${accountTo.address}"\n`;

    writer.write(name);
    writer.write(sender);
    writer.write(privKey);
    writer.write(receiver);

    console.log(`User-${num.toString().padStart(4,'0')}`);
}

for (let i = 1; i < accountCounts; i++) {

    makeAcc(i);
    writer.write('}, {\n');
}

makeAcc(accountCounts);
writer.write('}]\n');

writer.end();
writer.on('finish', function () {
    console.log('finish');
});
