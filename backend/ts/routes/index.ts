import * as Koa from 'koa';
import * as JsonRpc from '../jsonRpc'
import * as Ajv from 'ajv'
import echoRoute from './echo'
import { mixEthRoute, mixTokensRoute } from './mix'
import backendStatusRoute from './status'
import { config } from 'mixer-config'

interface Route {
    reqValidator: Ajv.ValidateFunction
    route(bodyData: JsonRpc.Request): Promise<JsonRpc.Response> 
}

// Define routes here
const routes = {
    mixer_mix_eth: mixEthRoute,
    mixer_mix_tokens: mixTokensRoute,
    //mixer_status: backendStatusRoute,
}

// Dev-only routes for testing
if (config.get('env') !== 'production') {
    routes['mixer_echo'] = echoRoute
}

// Invoke the route
const handle = async (reqData: JsonRpc.Request) => {
    try {
        const route = routes[reqData.method]

        if (route.reqValidator(reqData.params)) {
            const result = await route.route(reqData.params)

            return JsonRpc.genSuccessResponse(reqData.id, result)
        } else {

            return JsonRpc.genErrorResponse(
                reqData.id, 
                JsonRpc.Errors.invalidParams.code,
                JsonRpc.Errors.invalidParams.message,
            )
        }
    } catch (err) {

        return JsonRpc.genErrorResponse(
            reqData.id,
            err.code,
            err.message,
            err.data,
        )
    }
}

const router = async (
    ctx: Koa.Context,
    _: Function,
) => {
    // Assume that ctx.body is already valid JSON and that it has already been
    // validated in a previous middleware layer
    const reqData = JSON.parse(ctx.request.rawBody)

    let resData

    // Check whether the request is a batch or single request
    if (Array.isArray(reqData)) {
        resData = await Promise.all(
            reqData.map((data: any) => {
                return handle(data)
            })
        )
    } else {
        resData = await handle(reqData)
    }

    ctx.type = 'application/json-rpc'
    ctx.body = resData
}

export { router }
