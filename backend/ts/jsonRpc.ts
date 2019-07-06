type Id = string | number | null

interface Request {
    readonly jsonrpc: string
    readonly method: string
    readonly params?: any
    readonly id: Id
}

interface ResponseSuccess {
    readonly jsonrpc: string
    readonly result: any
    readonly id: Id
}

interface JsonRpcError {
    readonly code: number
    readonly message: string
    readonly data?: any
}

interface ResponseError {
    readonly jsonrpc: string
    readonly error: JsonRpcError
    readonly id: Id
}

const Errors = {
    parseError: {
        code: -32700, message: 'Parse error',
    },
    invalidRequest: {
        code: -32600, message: 'Invalid Request'
    },
    methodNotFound: {
        code: -32601, message: 'Method not found'
    },
    invalidParams: {
        code: -32602, message: 'Invalid params'
    },
    internalError: {
        code: -32603, message: 'Internal error'
    },
}

type Response = (ResponseSuccess | ResponseError)

const genResponse = (id: Id, result: any): ResponseSuccess => {
    return {
        jsonrpc: '2.0',
        id,
        result
    }
}

const genError = (id: Id, error: JsonRpcError, errorData?: any): ResponseError => {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            ...error,
            ...errorData
        }
    }
}

export {
    Request,
    Response,
    ResponseSuccess,
    ResponseError,
    JsonRpcError,
    Errors,
    genResponse,
    genError,
}
