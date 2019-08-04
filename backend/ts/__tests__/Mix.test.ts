require('module-alias/register')
declare var assert: any
import { createApp } from '../index'
const Koa = require('koa')
import * as ethers from 'ethers'
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'
const fs = require('fs');
const path = require('path');
import { sleep, genMixParams } from 'mixer-utils'
import { config } from 'mixer-config'
import * as errors from '../errors'
import { getContract } from 'mixer-contracts'
import {
    bigInt,
    genSignedMsg,
    genCircuit,
    genPublicSignals,
    genProof,
    genTree,
    genWitness,
    genIdentity,
    genIdentityCommitment,
    genSignalAndSignalHash,
    unstringifyBigInts,
    verifyProof,
} from 'mixer-crypto'

import { post } from './utils'

jest.setTimeout(90000)

const deployedAddresses = require('@mixer-backend/deployedAddresses.json')

const PORT = config.get('backend.port')
const HOST = config.get('backend.host') + ':' + PORT.toString()
const depositAmt = ethers.utils.parseEther(config.get('mixAmtEth'))

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const provider = new ethers.providers.JsonRpcProvider(
    config.get('chain.url'),
    config.get('chain.chainId'),
)

const signer = new ethers.Wallet(
    config.get('backend.testing.privKeys')[0],
    provider,
)

const mixerContract = getContract(
    'Mixer',
    signer,
    deployedAddresses,
)

const provingKey = fs.readFileSync(
    path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'),
)

const verifyingKey = unstringifyBigInts(
    JSON.parse(fs.readFileSync(
        path.join(
            __dirname,
            '../../../semaphore/semaphorejs/build/verification_key.json',
        )
    ))
)

const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
const cirDef = JSON.parse(
    fs.readFileSync(path.join(__dirname, circuitPath)).toString()
)
const circuit = genCircuit(cirDef)

const feeAmt = ethers.utils.parseEther(
    (parseFloat(config.get('feeAmtEth'))).toString()
)

let validProof

const schemaInvalidProof = {
    signal: 'INVALID<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
    a: ['0x0', '0x0'],
    b: [
        ['0x0', '0x0'],
        ['0x0', '0x0'],
    ],
    c: ['0x0', '0x0'],
    input: ['0x0', '0x0', '0x0', '0x0', '0x0'],
    recipientAddress: '0x2bD9aAa2953F988153c8629926D22A6a5F69b14E',
    fee: '0x0',
}

const toHex = (num: string) => {
    return '0x' + bigInt(num).toString(16)
}

let server
const broadcasterAddress = '0x627306090abab3a6e1400e9345bc60c78a8bef57'
const recipientAddress = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'

describe('the mixer_mix API call', () => {
    let recipientBalanceBefore
    let recipientBalanceAfter

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
    })

    test('accepts a valid proof and credits the recipient', async () => {
        // generate an identityCommitment
        const identity = genIdentity()
        const identityCommitment = genIdentityCommitment(identity.identityNullifier, identity.keypair.pubKey)

        const tx = await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
        const receipt = await tx.wait()

        // generate withdrawal proof

        const leaves = await mixerContract.getLeaves()
        const tree = await genTree(leaves)
        const leafIndex = await tree.element_index(identityCommitment)
        const identityPath = await tree.path(leafIndex)
        const externalNullifier = mixerContract.address

        const { signalHash, signal } = genSignalAndSignalHash(
            recipientAddress, broadcasterAddress, feeAmt,
        )

        const { signature, msg } = genSignedMsg(
            identity.keypair.privKey,
            externalNullifier,
            signalHash, 
        )

        const w = genWitness(
            circuit,
            identity.keypair.pubKey,
            signature,
            signalHash,
            externalNullifier,
            identity.identityNullifier,
            identityPath.path_elements,
            identityPath.path_index,
        )

        const publicSignals = genPublicSignals(w, circuit)

        const proof = await genProof(w, provingKey.buffer)

        const isVerified = verifyProof(verifyingKey, proof, publicSignals)
        expect(isVerified).toBeTruthy()

        const params = genMixParams(
            signal,
            proof,
            recipientAddress,
            BigInt(feeAmt.toString()),
            publicSignals,
        )

        validProof = params

        recipientBalanceBefore = await provider.getBalance(recipientAddress)

        // make the API call to submit the proof
        const resp = await post(1, 'mixer_mix', params)
        
        if (resp.data.error) {
            console.log(params)
            console.error(resp.data.error)
        }

        expect(resp.data.result.txHash).toMatch(/^0x[a-fA-F0-9]{40}/)

        // wait for the tx to be mined
        while (true) {
            const receipt = await provider.getTransactionReceipt(resp.data.result.txHash)
            if (receipt == null) {
                await sleep(1000)
            } else {
                break
            }
        }

        recipientBalanceAfter = await provider.getBalance(recipientAddress)
        expect(ethers.utils.formatEther(recipientBalanceAfter.sub(recipientBalanceBefore)))
            .toEqual('0.099')
    })

    test('rejects a request where the JSON-RPC schema is invalid', async () => {
        const resp = await post(1, 'mixer_mix', schemaInvalidProof)

        expect(resp.data.error.code).toEqual(JsonRpc.Errors.invalidParams.code)
    })

    test('rejects a proof where the signal is invalid', async () => {
        // deep copy and make the signal invalid
        const signalInvalidProof = JSON.parse(JSON.stringify(validProof))
        signalInvalidProof.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

        const resp = await post(1, 'mixer_mix', signalInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_INVALID)
    })

    test('rejects a proof where the signal hash is invalid', async () => {
        // deep copy and make the signal hash invalid
        const signalHashInvalidProof = JSON.parse(JSON.stringify(validProof))
        signalHashInvalidProof.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

        const resp = await post(1, 'mixer_mix', signalHashInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_HASH_INVALID)
    })

    test('rejects a proof where both the signal and the signal hash are invalid', async () => {
        // deep copy and make both the signal and the signal hash invalid
        const signalAndSignalHashInvalidProof = JSON.parse(JSON.stringify(validProof))
        signalAndSignalHashInvalidProof.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        signalAndSignalHashInvalidProof.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

        const resp = await post(1, 'mixer_mix', signalAndSignalHashInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID)
    })

    test('rejects a proof where the external nullifier is invalid', async () => {
        // deep copy and make the external nullifier invalid
        const externalNullifierInvalidProof = JSON.parse(JSON.stringify(validProof))
        externalNullifierInvalidProof.input[3] = '0x0000000000000000000000000000000000000000'

        const resp = await post(1, 'mixer_mix', externalNullifierInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID)
    })

    test('rejects a proof where the fee is too low', async () => {
        // deep copy and make the fee too low
        const lowFeeProof = JSON.parse(JSON.stringify(validProof))
        lowFeeProof.fee = '0x0001'

        const resp = await post(1, 'mixer_mix', lowFeeProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_FEE)
    })

    afterAll(async () => {
        server.close()
    })
})
