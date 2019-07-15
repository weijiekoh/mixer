import * as ethers from 'ethers'
import { config } from 'mixer-config'

const privateKeys = require(config.get('chain.privateKeysPath'))

const genAccounts = () => {
    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

export { genAccounts }
