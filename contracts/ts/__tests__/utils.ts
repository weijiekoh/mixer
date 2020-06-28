import * as ethers from 'ethers'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genCircuit,
    parseVerifyingKeyJson,
} from 'libsemaphore'
const fs = require('fs');
const path = require('path');

const mix = async (
    relayerRegistryContract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddress,
) => {
    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )
    const iface = new ethers.utils.Interface(mixerContract.interface.abi)
    const callData = iface.functions.mix.encode([depositProof, relayerAddress])

    return relayerRegistryContract.relayCall(
        mixerContract.contractAddress,
        callData,
        { gasLimit: 1000000 }
    )

    //return await mixerContract.mix(
        //depositProof,
        //relayerAddress,
        //{ gasLimit: 1000000 }
    //)
}

const mixERC20 = async (
    relayerRegistryContract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddress,
) => {
    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )
    const iface = new ethers.utils.Interface(mixerContract.interface.abi)
    const callData = iface.functions.mixERC20.encode([depositProof, relayerAddress])

    return relayerRegistryContract.relayCall(
        mixerContract.contractAddress,
        callData,
        { gasLimit: 1000000 },
    )
}

const genDepositProof = (
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
) => {
    return {
        signal,
        a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
        b: [ 
            [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
            [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ],
        ],
        c: [ proof.pi_c[0].toString(), proof.pi_c[1].toString() ],
        input: [
            publicSignals[0].toString(),
            publicSignals[1].toString(),
            publicSignals[2].toString(),
            publicSignals[3].toString(),
        ],
        recipientAddress,
        fee: feeAmt,
    }
}

const areEqualAddresses = (a: string, b: string) => {
    return BigInt(a) === BigInt(b)
}

const getSnarks = () => {
    const verifyingKey = parseVerifyingKeyJson(fs.readFileSync(
        path.join(
            __dirname,
            '../../../semaphore/semaphorejs/build/verification_key.json',
        )
    ))

    const provingKey: SnarkProvingKey = fs.readFileSync(
        path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'),
    )
    const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
    const cirDef = JSON.parse(
        fs.readFileSync(path.join(__dirname, circuitPath)).toString()
    )

    const circuit = genCircuit(cirDef)

    return {
        verifyingKey,
        provingKey,
        circuit,
    }
}

export {
    genDepositProof,
    areEqualAddresses,
    mix,
    mixERC20,
    getSnarks,
}
