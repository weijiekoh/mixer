import axios from 'axios'
import * as snarkjs from 'snarkjs'
import * as JsonRpc from '../jsonRpc'
import { config } from 'mixer-utils'

const PORT = config.get('backend.port')
const HOST = config.get('backend.host') + ':' + PORT.toString()

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const hexify = (n: BigInt) => {
    return '0x' + n.toString(16)
}

const genMixParams = (
    signal: string,
    proof: any,
    recipientAddress: string,
    fee: BigInt,
    publicSignals: BigInt[],
) => {
    return {
        signal,
        a: proof.pi_a.slice(0, 2).map(hexify),
        b: [
            [
                hexify(proof.pi_b[0][1]),
                hexify(proof.pi_b[0][0]),
            ],
            [
                hexify(proof.pi_b[1][1]),
                hexify(proof.pi_b[1][0]),
            ],
        ],
        c: proof.pi_c.slice(0, 2).map(hexify),
        input: publicSignals.map(hexify),
        recipientAddress: recipientAddress,
        fee: hexify(fee),
    }
}

const post = (id: JsonRpc.Id, method: string, params: any) => {
    return axios.post(
        HOST,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        OPTS,
    )
}

export {
    post,
    genMixParams,
}
