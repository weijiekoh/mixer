import { config } from './config'

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve: Function) => setTimeout(resolve, ms))
}

export { config, sleep }
