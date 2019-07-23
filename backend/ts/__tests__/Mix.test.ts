require('module-alias/register')
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
    genMsg,
    signMsg,
    genCircuit,
    genPublicSignals,
    genProof,
    genTree,
    genWitness,
    genIdentity,
    genIdentityCommitment,
    genSignalAndSignalHash,
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

const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
const cirDef = JSON.parse(
    fs.readFileSync(path.join(__dirname, circuitPath)).toString()
)
const circuit = genCircuit(cirDef)

const feeAmt = ethers.utils.parseEther(
    (parseFloat(config.get('burnFeeEth')) * 2).toString()
)

const validProof = {
    signal: '0xe706109ba6c5dedbbdde0e5ee5672dac00865ad1b0dd0e96e19bd51f67989a8d',
    a: [
        '0x579ce307effc91b23ecabe0a55f825cf4a1ab96df8441481ef25a7efc0fae30',
        '0x22070bc0aaa193c3138218d617df009ceeccae9c3cb3ec73317ede47b4c07b17',
    ],
    b: [
        [
            '0x1c93418aa3337eeec9ba6f6c4e56cecb488e7e9bc3ccb74743c6dc247be4115',
            '0x244d23c0d0ccac80d5cc74bdb58667dbf022ca50112b24d9c040e1889cc35edd'
        ],
        [
            '0x649ada79066e1a5822cad3686b30469c62c67675338c65960524f5baea9cfea',
            '0xbf663bb918e1091e160275138a534ceeb42618ab3657b6ba35a46f3a0c947c'
        ],
    ],
    c: [
        '0x24c964db0fe35a8ff60ae870fe61a56e68ca0c25b60c807dac7b2c4ba76c5f66',
        '0xa1e3a1f968730240f5775fef0bd2e54948dd3ef107a8d2b346906b3347d69ab',
    ],
    input: [
        '0x2955829eb3a89f06e17df3a5e8730ff8530ebbbcde2b9decc9938a470cc6ca44',
        '0xb9bac86a108a68a587b36863c9e33021576318428d1b6d2d3e8eff45389a5ce',
        '0xc0573451aef54b8e518c1a22734a2d90a0659ffcfb2bcf5bc1d228d024544f',
        deployedAddresses.Mixer,
        deployedAddresses.Mixer,
    ]
    ,
    recipientAddress: '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
    fee: '0x038d7ea4c68000',
}

// deep copy and make the signal invalid
const signalInvalidProof = JSON.parse(JSON.stringify(validProof))
signalInvalidProof.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

// deep copy and make the signal hash invalid
const signalHashInvalidProof = JSON.parse(JSON.stringify(validProof))
signalHashInvalidProof.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

// deep copy and make both the signal and the signal hash invalid
const signalAndSignalHashInvalidProof = JSON.parse(JSON.stringify(validProof))
signalAndSignalHashInvalidProof.signal = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
signalAndSignalHashInvalidProof.input[2] = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

// deep copy and make the broadcaster's address invalid
const broadcasterAddressInvalidProof = JSON.parse(JSON.stringify(validProof))
broadcasterAddressInvalidProof.input[4] = '0x0000000000000000000000000000000000000000'

// deep copy and make the external nullifier invalid
const externalNullifierInvalidProof = JSON.parse(JSON.stringify(validProof))
externalNullifierInvalidProof.input[3] = '0x0000000000000000000000000000000000000000'

// deep copy and make the fee too low
const lowFeeProof = JSON.parse(JSON.stringify(validProof))
lowFeeProof.fee = '0x0001'

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
const recipientAddress = '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef'

describe('the mixer_mix API call', () => {
    let recipientBalanceBefore
    let recipientBalanceAfter

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
    })

    test('rejects a request where the JSON-RPC schema is invalid', async () => {
        const resp = await post(1, 'mixer_mix', schemaInvalidProof)

        expect(resp.data.error.code).toEqual(JsonRpc.Errors.invalidParams.code)
    })

    test('rejects a proof where the signal is invalid', async () => {
        const resp = await post(1, 'mixer_mix', signalInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_INVALID)
    })

    test('rejects a proof where the signal hash is invalid', async () => {
        const resp = await post(1, 'mixer_mix', signalHashInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_HASH_INVALID)
    })

    test('rejects a proof where both the signal and the signal hash are invalid', async () => {
        const resp = await post(1, 'mixer_mix', signalAndSignalHashInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID)
    })

    test('rejects a proof where the external nullifier is invalid', async () => {
        const resp = await post(1, 'mixer_mix', externalNullifierInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID)
    })

    test('rejects a proof where the broadcaster\'s address is invalid', async () => {
        const resp = await post(1, 'mixer_mix', broadcasterAddressInvalidProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_BROADCASTER_ADDRESS_INVALID)
    })

    test('rejects a proof where the fee is too low', async () => {
        const resp = await post(1, 'mixer_mix', lowFeeProof)

        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_MIX_INSUFFICIENT_FEE)
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
        const broadcasterAddress = mixerContract.address

        const { signalHash, signal } = genSignalAndSignalHash(
            recipientAddress, broadcasterAddress, feeAmt,
        )

        const msg = genMsg(
            externalNullifier,
            signalHash, 
            mixerContract.address,
        )

        const signature = signMsg(identity.keypair.privKey, msg)

        const w = genWitness(
            circuit,
            identity.keypair.pubKey,
            signature,
            signalHash,
            externalNullifier,
            identity.identityNullifier,
            identityPath.path_elements,
            identityPath.path_index,
            broadcasterAddress
        )

        const publicSignals = genPublicSignals(w, circuit)

        const proof = await genProof(w, provingKey.buffer)
        const hex = (x) => '0x' + x.toString(16)

        //const depositProof = {
            //signal,
            //a: proof.pi_a.slice(0, 2).map(hex),
            //b: [ 
                //[proof.pi_b[0][1], proof.pi_b[0][0]].map(hex),
                //[proof.pi_b[1][1], proof.pi_b[1][0]].map(hex),
            //],
            //c: proof.pi_c.slice(0, 2).map(hex),
            //input: publicSignals.map(hex),
            //recipientAddress,
            //fee: feeAmt,
        //}

        //const mixTx = await mixerContract.mix(depositProof)
        //const mixReceipt = await mixTx.wait()
        //console.log(mixReceipt.status)
        //return

        const params = genMixParams(
            signal,
            proof,
            recipientAddress,
            BigInt(feeAmt.toString()),
            publicSignals,
        )

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

    afterAll(async () => {
        server.close()
    })
})
