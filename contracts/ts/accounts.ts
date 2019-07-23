import * as ethers from 'ethers'
import { config } from 'mixer-config'

const privateKeys = require(config.get('chain.privateKeysPath'))

const genAccounts = () => {
    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

const genTestAccounts = (num: number, mnemonic: string) => {
    let accounts: ethers.Wallet[] = []

    for (let i=0; i<num; i++) {
        const path = `m/44'/60'/${i}'/0/0`
        const wallet = ethers.Wallet.fromMnemonic(mnemonic, path)
        accounts.push(wallet)
    }

    return accounts
}

export { genAccounts, genTestAccounts }
