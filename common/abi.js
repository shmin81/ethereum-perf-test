const ABI = require('web3-eth-abi');

function ABIHelper() {
}

ABIHelper.prototype.getFuncCallDataABI = (funcABI, args) => {
    const paramTypes = funcABI.inputs.map(m => m.type);
    if (paramTypes.length !== args.length) {
        throw new Error(`Requested ABI and arguments are incompatible!`);
    }
    return ABI.encodeFunctionSignature(funcABI) + ABI.encodeParameters(paramTypes, args).slice(2);
};

module.exports = ABIHelper;
