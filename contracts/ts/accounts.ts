import * as ethers from 'ethers'
import { config } from 'mixer-config'

let privateKeys

if (config.get('env') === 'local-dev') {
    privateKeys = require('../privateKeys.json')
} else {
    privateKeys = require(config.get('chain.privateKeysPath'))
}

const genAccounts = () => {
    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

export { genAccounts }
