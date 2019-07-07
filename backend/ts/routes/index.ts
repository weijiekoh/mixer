import * as Koa from 'koa';
import * as JsonRpc from '../jsonRpc'
import echo from './echo'
import { config } from 'mixer-utils'

// Define routes here
const routes = {
}

// Dev-only routes for testing
if (config.get('env') !== 'production') {
    routes['mixer_echo'] = echo
}

// Invoke the route
const handle = (reqData: JsonRpc.Request) => {
    try {
        const result = routes[reqData.method](reqData.params)
        return JsonRpc.genSuccessResponse(reqData.id, result)

    } catch (err) {
        return JsonRpc.genErrorResponse(reqData.id, err)
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
        resData = handle(reqData)
    }

    ctx.type = 'application/json-rpc'
    ctx.body = resData
}

export { router }
