import * as ethers from 'ethers'
import { getRelayerForwarderContract, getMixerContract, getTokenMixerContract } from './mixer'
import { genDepositProof } from './utils'
const config = require('../../exported_config')
const deployedAddresses = config.chain.deployedAddresses

/*
 * Perform a web3 transaction to make quick withdrawal of ETH
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdrawEth = async (
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()
        const mixerContract = await getMixerContract(context)
        const relayerForwarderContract = await getRelayerForwarderContract(context)

        const depositProof = genDepositProof(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        )

        const iface = new ethers.utils.Interface(mixerContract.interface.abi)
        const callData = iface.functions.mix.encode([depositProof, broadcasterAddress])

        return relayerForwarderContract.relayCall(
            deployedAddresses.Mixer,
            callData,
            { gasLimit: 500000 },
        )
    }
}

/*
 * Perform a web3 transaction to make quick withdrawal of tokens
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdrawTokens = async (
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    broadcasterAddress,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()
        const mixerContract = await getTokenMixerContract(context)
        const relayerForwarderContract = await getRelayerForwarderContract(context)

        const depositProof = genDepositProof(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        )

        const iface = new ethers.utils.Interface(mixerContract.interface.abi)
        const callData = iface.functions.mixERC20.encode([depositProof, broadcasterAddress])

        return relayerForwarderContract.relayCall(
            deployedAddresses.TokenMixer,
            callData,
            { gasLimit: 500000 },
        )
    }
}

export { quickWithdrawEth, quickWithdrawTokens }
