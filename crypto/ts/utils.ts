// Copied from semaphore/semaphorejs/src/util/index.js

import * as snarkjs from 'snarkjs'
import * as assert from 'assert'

const bigInt = require('big-integer')

const unstringifyBigInts = (o) => {
    if ((typeof(o) == "string") && (/^[0-9]+$/.test(o) ))  {
        return bigInt(o)
    } else if (Array.isArray(o)) {
        return o.map(unstringifyBigInts)
    } else if (typeof o == "object") {
        const res = {}
        for (let k in o) {
            res[k] = unstringifyBigInts(o[k])
        }
        return res
    } else {
        return o
    }
}

function writeUint32(h, val) {
    h.dataView.setUint32(h.offset, val, true)
    h.offset += 4
}


function writeBigInt(h, bi) {
    for (let i=0; i<8; i++) {
        const v = bi.shiftRight(i*32).and(0xFFFFFFFF).toJSNumber()
        writeUint32(h, v)
    }
}


function calculateBuffLen(witness) {

    let size = 0

    // beta2, delta2
    size += witness.length * 32

    return size
}


function convertWitness(witnessJson) {
    const witness = unstringifyBigInts(witnessJson)
    const buffLen = calculateBuffLen(witness)

    const buff = new ArrayBuffer(buffLen)

    const h = {
        dataView: new DataView(buff),
        offset: 0
    }


    // writeUint32(h, witness.length)

    for (let i=0; i<witness.length; i++) {
        writeBigInt(h, witness[i]);
    }

    assert.equal(h.offset, buffLen);

    return Buffer.from(buff);
}

const buildGroth16 = require('websnark/src/bn128.js')

async function prove(witness, provingKey) {
    const groth16 = await buildGroth16()
    const p = await groth16.groth16GenProof(witness, provingKey);
    //groth16.terminate()
    return snarkjs.unstringifyBigInts(p)
}

const cutDownBits = (b: snarkjs.bigInt, bits: number) => {
    let mask = snarkjs.bigInt(1)
    mask = mask.shl(bits).sub(snarkjs.bigInt(1))
    return b.and(mask)
}

const beBuff2int = (buff: snarkjs.bigInt) => {
    let res = snarkjs.bigInt.zero
    for (let i=0; i<buff.length; i++) {
        const n = snarkjs.bigInt(buff[buff.length - i - 1])
        res = res.add(n.shl(i*8))
    }
    return res
}

export {
    convertWitness,
    prove,
    cutDownBits,
    beBuff2int,
}
