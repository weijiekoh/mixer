import * as ethers from 'ethers'
import { config } from 'mixer-utils'

const generateAccounts = () => {
    const privateKeys = config.get('chain.privateKeys')

    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

export { generateAccounts }
