import * as ethers from 'ethers'
import { genDepositProof } from './utils'
import { SurrogethClient } from 'surrogeth-client'
import { getRelayerForwarderContract, getMixerContract, getTokenMixerContract } from './mixer'
const config = require('../../exported_config')
const deployedAddresses = config.chain.deployedAddresses

// Returns an instance of a Surrogeth client using config params from
// `mixer-config`
const genSurrogethClient = (provider) => {
    return new SurrogethClient(
        provider,
        config.surrogeth.client.network,
        config.chain.deployedAddresses.RelayerReputation,
    )
}

// Returns the first relayer from Surrogeth
const getRelayer = async (_) => {
//const getRelayer = async (context) => {
    //const library = context.library
    //const connector = context.connector
    //if (library && connector) {
        //const provider = new ethers.providers.Web3Provider(
            //await connector.getProvider(config.chain.chainId),
        //)
        //const surrogeth = genSurrogethClient(provider)

        //const relayers = await surrogeth.getRelayers(
            //1,
            //new Set([]),
            //new Set(['ip']),
        //)

        //return relayers[0]
    //}
    return {
        locator: 'https://micromixrelayer.herokuapp.com/',
        locatorType: 'ip',
        address: '0x5E8b2E54A723eA152fD022cEa531C789DA07D289',
    }
}

const relayMixEth = async (
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayer,
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
        const callData = iface.functions.mix.encode([depositProof, relayer.address])

        const rfIface = new ethers.utils.Interface(relayerForwarderContract.interface.abi)
        const rfCallData = rfIface.functions.relayCall.encode([deployedAddresses.Mixer, callData])

        const surrogeth = genSurrogethClient(provider)

        console.log('Using relayer:', relayer)

        return surrogeth.submitTx(
            {
                to: deployedAddresses.Mixer,
                value: 0,
                data: callData,
            },
            relayer,
        )
    }
}

const relayMixTokens = async (
    context: any,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayer,
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
        const callData = iface.functions.mixERC20.encode([depositProof, relayer.address])

        const rfIface = new ethers.utils.Interface(relayerForwarderContract.interface.abi)
        const rfCallData = rfIface.functions.relayCall.encode([deployedAddresses.TokenMixer, callData])

        const surrogeth = genSurrogethClient(provider)

        console.log('Using relayer:', relayer)

        return surrogeth.submitTx(
            {
                to: deployedAddresses.TokenMixer,
                value: 0,
                data: callData,
            },
            relayer,
        )
    }
}

export {
    relayMixEth,
    relayMixTokens,
    getRelayer,
}
