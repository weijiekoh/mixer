import { config } from './index'

if (require.main === module) {
    let c = JSON.parse(JSON.stringify(config))
    if (c.chain.privateKeys) {
        delete c.chain.privateKeys
    }
    console.log(JSON.stringify(config))
}
