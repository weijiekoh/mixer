require('module-alias/register')
import { config } from 'mixer-utils'
import * as Koa from 'koa';
import * as Ajv from 'ajv'
import * as JsonRpc from './jsonRpc'

const ajv = new Ajv()
//const ajv = new Ajv({ missingRefs: 'ignore' })
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
const jsonRpcSchema = require('@mixer-backend/schemas/jsonRpc.json')

const validateJsonRpc = async (
    ctx: Koa.Context,
    next: Function,
) => {
    const basicValidate: Ajv.ValidateFunction = ajv.compile(jsonRpcSchema)
    if (basicValidate(ctx.body)) {
        next()
    } else {
        ctx.type = 'application/json-rpc'
        ctx.body = JsonRpc.genError(null, JsonRpc.Errors.parseError)
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
        contentType === 'application/json-rpc' ||
        contentType === 'application/json' ||
        contentType === 'application/jsonrequest'
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

const createApp = () => {
    const app = new Koa()

    // Set middleware
    app.use(validateMethod)
    app.use(validateHeaders)
    app.use(validateJsonRpc)
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
