import { createApp } from '../index'
const Koa = require('koa')
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'
import { config, sleep, errors } from 'mixer-utils'
import { bigInt } from 'mixer-crypto'
import { post } from './utils'
const deployedAddresses = require('../deployedAddresses.json')

const PORT = config.get('backend.port')
const HOST = config.get('backend.host') + ':' + PORT.toString()

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const validProof = {
    signal: '0xe706109ba6c5dedbbdde0e5ee5672dac00865ad1b0dd0e96e19bd51f67989a8d',
    a: [
        '0x16a016665c6c9e1c9f7c31e8d15da7a13422cfe9d34033385029ec1f63d64ee',
        "0x2c8901269cf94c9750bf6a483d435cdb8208fb2e6c33c95a2075898f87680ca1",
    ],
    b: [
        [
            "0x2595acb7d68899af526d68aa5b683ac962eb1d0c8a7d5580f8a18ce52eb3a0d6",
            "0x518f333664a3ea1abe4d23515df938e355b3d27fa6b990e93a8f79e1add08f8"
        ],
        [
            "0xbe59983d803d70060d5da420d85ec1a2acc8e3cb2e47841389da642ceb3633d",
            "0x29bb878c7daf8f253b05a34dc93ad8a758cec8a6b629bbaaa9962a6cb20df8c3",
        ],
    ],
    c: [
        "0x20a91d3bd0ff84d1da10136ac8aabd432efa6413feb9b290168e9faeb6f2560b",
        "0x1cc765e992f5a708bd07e7da5232ba6322ff4b7b705f8798ae132806a84d299a",
    ],
    input: [
        '0x16f1c8223e3533940ab092e11a8bda201868fce34405a09215f49828967b9ef3',
        '0xf13fadb946e1c807b2a98d48aa8f234ba95bb42a04413cfb80bd61911d0c959',
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

let server

const toHex = (num: string) => {
    return '0x' + bigInt(num).toString(16)
}

jest.setTimeout(30000)

describe('Relayer', () => {
    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
    })

    // TODO: test for BACKEND_MIX_NULLIFIER_ALREADY_SET
    // TODO: test for BACKEND_MIX_ROOT_NOT_FOUND

    test('rejects a proof where the schema is invalid', async () => {
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

    test('accepts a valid proof', async () => {
        const resp = await post(1, 'mixer_mix', validProof)

        expect(resp.data.result.txHash).toMatch(/^0x[a-fA-F0-9]{40}/)
    })

    afterAll(async () => {
        await sleep(2000)
        server.close()
    })
})
