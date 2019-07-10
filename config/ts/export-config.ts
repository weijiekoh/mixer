import { config } from './index'

if (require.main === module) {
    let c = JSON.parse(JSON.stringify(config))
    delete c.chain.privateKeys
    console.log(JSON.stringify(config))
}
