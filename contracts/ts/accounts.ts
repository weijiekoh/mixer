import * as ethers from 'ethers'
const privateKeys = require('../.privateKeys.json')

const genAccounts = () => {
    return privateKeys.map((pk: string) => {
        return new ethers.Wallet(pk)
    })
}

export { genAccounts }
