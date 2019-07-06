import { createApp } from '../index'
const Koa = require('koa')
import axios from 'axios'
import * as JsonRpc from '../jsonRpc'

const PORT = 1111
const HOST = 'http://localhost:' + PORT.toString()
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
                        'Content-Type': 'text/plain'
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

    test('rejects requests with an invalid JSON-RPC 2.0 body', async () => {
        const resp = await axios.post(
            HOST,
            {
                hello: 'world'
            },
            {
                headers: {
                    'Content-Type': 'application/json-rpc'
                }
            },
        )

        expect(resp.status).toEqual(200)
        expect(resp.data.error).toBeDefined()
        expect(resp.data.error).toEqual(JsonRpc.Errors.parseError)
    })

    afterAll(async () => {
        server.close()
    })
})
