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
        // TODO: make a deposit here to test mix()
        // first, make a deposit
        const resp = await post(1, 'mixer_mix', validProof)

        expect(resp.data.result.txHash).toMatch(/^0x[a-fA-F0-9]{40}/)
    })

    afterAll(async () => {
        await sleep(2000)
        server.close()
    })
})
