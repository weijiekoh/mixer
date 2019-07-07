import * as Koa from 'koa';
import * as JsonRpc from '../jsonRpc'
import echo from './echo'

const routes = {
    mixer_echo: echo,
}

const handle = (reqData: JsonRpc.Request) => {
    const result = routes[reqData.method](reqData.params)

    return JsonRpc.genResponse(reqData.id, result)
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
