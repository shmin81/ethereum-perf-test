const ABI = require('web3-eth-abi');
exports.getCallDataByABI = function (funcABI, args) {
    const paramTypes = funcABI.inputs.map(m => m.type);
    if (paramTypes.length !== args.length) {
        throw new Error(`ABI and arguments are mismatched!`);
    }
    return ABI.encodeFunctionSignature(funcABI) + ABI.encodeParameters(paramTypes, args).slice(2);
}