"use strict";
exports.__esModule = true;
var sleep = function (ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
};
exports.sleep = sleep;
var hexify = function (n) {
    return '0x' + n.toString(16);
};
var genMixParams = function (signal, proof, recipientAddress, fee, publicSignals) {
    return {
        signal: signal,
        a: proof.pi_a.slice(0, 2).map(hexify),
        b: [
            [
                hexify(proof.pi_b[0][1]),
                hexify(proof.pi_b[0][0]),
            ],
            [
                hexify(proof.pi_b[1][1]),
                hexify(proof.pi_b[1][0]),
            ],
        ],
        c: proof.pi_c.slice(0, 2).map(hexify),
        input: publicSignals.map(hexify),
        recipientAddress: recipientAddress,
        fee: hexify(fee)
    };
};
exports.genMixParams = genMixParams;
//# sourceMappingURL=index.js.map