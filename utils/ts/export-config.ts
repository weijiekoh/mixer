import * as config from './config'

if (require.main === module) {
    let c = config.config
    delete c.chain.privateKeys
    console.log(JSON.stringify(config.config))
}
