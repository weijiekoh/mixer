import { config } from './config'
import * as errors from './errors'

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve: Function) => setTimeout(resolve, ms))
}

export { config, sleep, errors }
