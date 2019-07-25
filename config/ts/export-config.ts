import { config } from './index'

if (require.main === module) {
    let c = JSON.parse(JSON.stringify(config))
    if (c.chain.privateKeys) {
        delete c.chain.privateKeys
    }
    if (c.backend.hotWalletPrivKey) {
        delete c.backend.hotWalletPrivKey
    }
    console.log(JSON.stringify(config))
}
