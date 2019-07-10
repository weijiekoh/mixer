import { createApp } from '../index'
const Koa = require('koa')
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'
import { config } from 'mixer-config'
import * as errors from '../errors'
import { post } from './utils'

const PORT = config.get('backend.port')
const HOST = config.get('backend.host') + ':' + PORT.toString()

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

let server

describe('Backend API', () => {
    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
    })

    test('rejects requests with an incorrect content-type header', async () => {
        expect.assertions(1)

        try {
            const resp = await axios.post(
                HOST,
                {},
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                },
            )
        } catch (err) {
            expect(err.response.status).toEqual(400)
        }
    })

    test('rejects requests with an incorrect HTTP request method', async () => {
        expect.assertions(1)

        try {
            const resp = await axios.get(HOST)
        } catch (err) {
            expect(err.response.status).toEqual(405)
        }
    })

    test('rejects requests with invalid JSON', async () => {
        const resp = await axios.post(
            HOST,
            '[[[',
            {
                headers: {
                    'Content-Type': 'text/plain',
                }
            },
        )

        expect(resp.status).toEqual(200)
        expect(resp.data.error).toBeDefined()
        expect(resp.data.error).toEqual(JsonRpc.Errors.parseError)
    })

    test('rejects requests with an invalid JSON-RPC 2.0 request', async () => {
        const resp = await axios.post(
            HOST,
            { hello: 'world' },
            OPTS,
        )

        expect(resp.status).toEqual(200)
        expect(resp.data.error).toBeDefined()
        expect(resp.data.error).toEqual(JsonRpc.Errors.invalidRequest)
    })

    test('handles the echo method', async () => {
        const message = 'hello'
        const resp = await post(1, 'mixer_echo', { message })

        expect(resp.status).toEqual(200)
        expect(resp.data.result.message).toEqual(message)
    })

    test('handles the echo method in batch', async () => {
        let data: JsonRpc.Request[] = []
        for (let i=0; i<5; i++) {
            data.push({
                id: i,
                jsonrpc: '2.0',
                method: 'mixer_echo',
                params: {
                    message: i,
                }
            })
        }

        const resp = await axios.post(
            HOST,
            data,
            OPTS,
        )

        expect(resp.status).toEqual(200)
        expect(resp.data.length).toEqual(data.length)
        const expected = JSON.stringify(
            [ 
                { jsonrpc: '2.0', id: 0, result: { message: 0 } },
                { jsonrpc: '2.0', id: 1, result: { message: 1 } },
                { jsonrpc: '2.0', id: 2, result: { message: 2 } },
                { jsonrpc: '2.0', id: 3, result: { message: 3 } },
                { jsonrpc: '2.0', id: 4, result: { message: 4 } },
            ]
        )
        expect(JSON.stringify(resp.data)).toEqual(expected)
    })

    test('correct error handling by the echo method', async () => {
        const resp = await post(1, 'mixer_echo', { message: '' })

        expect(resp.status).toEqual(200)
        expect(resp.data.error.code).toEqual(errors.errorCodes.BACKEND_ECHO_MSG_BLANK)
        expect(resp.data.error.data.name).toEqual('BACKEND_ECHO_MSG_BLANK')
    })

    afterAll(async () => {
        server.close()
    })
})
