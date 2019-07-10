require('module-alias/register')
import * as Ajv from 'ajv'
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser'

import * as helmet from 'koa-helmet'

import { config } from 'mixer-config'
import { router } from './routes'
import * as JsonRpc from './jsonRpc'

//const ajv = new Ajv({ missingRefs: 'ignore' })

const ajv = new Ajv()
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
const jsonRpcSchema = require('@mixer-backend/schemas/jsonRpc.json')
const basicValidate: Ajv.ValidateFunction = ajv.compile(jsonRpcSchema)

/*
 * Validate the request against the basic JSON-RPC 2.0 schema
 */
const validateJsonRpcSchema = async (
    ctx: Koa.Context,
    next: Function,
) => {

    if (basicValidate(JSON.parse(ctx.request.rawBody))) {
        await next()
    } else {
        ctx.type = 'application/json-rpc'
        ctx.body = JsonRpc.genErrorResponse(
            null,
            JsonRpc.Errors.invalidRequest.code,
            JsonRpc.Errors.invalidRequest.message,
        )
    }
}

/*
 * Middleware to ensure that the request body is valid JSON
 */
const validateJsonParse = async (
    ctx: Koa.Context,
    next: Function,
) => {
    try {
        JSON.parse(ctx.request.rawBody)
        await next()
    } catch (err) {
        ctx.type = 'application/json-rpc'
        ctx.body = JsonRpc.genErrorResponse(
            null,
            JsonRpc.Errors.parseError.code,
            JsonRpc.Errors.parseError.message,
        )
    }
}

/*
 * Middleware to ensure that the HTTP Content-Type is
 * either application/json-rpc, applicaton/json, or application/jsonrequest
 */
const validateHeaders = async (
    ctx: Koa.Context,
    next: Function,
) => {
    const contentType = ctx.request.type
    if (
        contentType === 'application/json' ||
        contentType === 'text/plain'
    ) {
        await next()
    } else {
        ctx.throw(400, 'Invalid content-type')
    }
}

/*
 * Middleware to ensure that the HTTP method is only POST
 */
const validateMethod = async (
    ctx: Koa.Context,
    next: Function,
) => {
    if (ctx.request.method !== 'POST') {
        ctx.throw(405, 'Method not allowed')
    } else {
        await next()
    }
}

/*
 * Returns a Koa app
 */
const createApp = () => {
    const app = new Koa()

    // Set middleware
    app.use(helmet())
    app.use(bodyParser({
        enableTypes: ['json', 'text'],
        disableBodyParser: true,
    }))

    // Validate basic JSON-RPC 2.0 requirements
    app.use(validateMethod)
    app.use(validateHeaders)
    app.use(validateJsonParse)
    app.use(validateJsonRpcSchema)

    // Let the router handle everything else
    app.use(router)

    return app
}

const main = async () => {
    const port = config.get('backend.port')
    const app = createApp()
    app.listen(port)

    console.log('Running server on port', port)
}

if (require.main === module) {
    main()
}

export { createApp }
