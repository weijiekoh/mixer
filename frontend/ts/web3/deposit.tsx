import * as ethers from 'ethers'
const config = require('../../exported_config')
import {
    getMixerContract,
    getTokenMixerContract,
    getTokenContract,
} from './mixer'

/*
 * Perform a web3 transaction to make a deposit
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 * @param mixAmt The amount to mix
 */
const depositEth = async (
    context: any,
    identityCommitment: string,
    mixAmt: ethers.utils.BigNumber,
) => {

    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()

        const mixerContract = await getMixerContract(context)

        const tx = await mixerContract.deposit(identityCommitment, { value: mixAmt, gasLimit: 8000000 })
        return tx
    }
}

const depositTokens = async(
    context: any,
    identityCommitment: string,
) => {

    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()

        const mixerContract = await getTokenMixerContract(context)

        const tx = await mixerContract.depositERC20(identityCommitment, { gasLimit: 8000000 })

        return tx
    }
}

const getTokenAllowance = async (
    context: any,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()

        const tokenContract = await getTokenContract(context)
        const tokenMixerAddress = config.chain.deployedAddresses.TokenMixer

        const tx = await tokenContract.allowance(context.account, tokenMixerAddress)
        return tx
    }
}

/*
 * Perform a web3 transaction to the ERC20 contract's approve function
 * @param context The web3-react context
 * @param numTokens The amount of tokens. This should be multiplied by 10 ^
 *                  token.decimals before passing it to this function.
 */
const approveTokens = async (
    context: any,
    numTokens: number,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()

        const tokenContract = await getTokenContract(context)
        const tokenMixerAddress = config.chain.deployedAddresses.TokenMixer

        const tx = await tokenContract.approve(tokenMixerAddress, numTokens.toString())

        return tx
    }
}

export { depositEth, depositTokens, getTokenAllowance, approveTokens }
