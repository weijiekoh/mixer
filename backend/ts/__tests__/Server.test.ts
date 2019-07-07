import { createApp } from '../index'
const Koa = require('koa')
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'

const PORT = 1111
const HOST = 'http://localhost:' + PORT.toString()

const post = (id: JsonRpc.Id, method: string, params: any) => {
    return axios.post(
        HOST,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        {
            headers: {
                'Content-Type': 'application/json',
            }
        },
    )
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
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            },
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

    afterAll(async () => {
        server.close()
    })
})
