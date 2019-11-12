import * as ethers from 'ethers'
import { genDepositProof } from './utils'
import { SurrogethClient } from 'surrogeth-client'
import {
    getRelayerForwarderContract,
    getERC20RelayerForwarderContract,
    getMixerContract,
    getTokenMixerContract,
} from './mixer'
const config = require('../../exported_config')
const deployedAddresses = config.chain.deployedAddresses

// Returns an instance of a Surrogeth client using config params from
// `mixer-config`
const genSurrogethClient = (provider) => {
    const protocol = config.surrogeth.client.protocol
    if (protocol) {
        return new SurrogethClient(
            provider,
            config.surrogeth.client.network,
            config.chain.deployedAddresses.RelayerReputation,
            config.surrogeth.client.protocol,
        )
    } else {
        return new SurrogethClient(
            provider,
            config.surrogeth.client.network,
            config.chain.deployedAddresses.RelayerReputation,
        )
    }
}

// Returns the first relayer from Surrogeth
//const getRelayer = async (_) => {
const getRelayer = async (context) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const surrogeth = genSurrogethClient(provider)

        const relayers = await surrogeth.getRelayers(
            1,
            new Set([]),
            new Set(['ip']),
        )

        return relayers[0]
    }
    //return {
        //locator: 'https://micromixrelayer.herokuapp.com',
        //locatorType: 'ip',
        //address: '0x5E8b2E54A723eA152fD022cEa531C789DA07D289',
    //}
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
        const callData = iface.functions.mix.encode([
            depositProof,
            relayerForwarderContract.address,
        ])

        const rfIface = new ethers.utils.Interface(relayerForwarderContract.interface.abi)
        const rfCallData = rfIface.functions.relayCall.encode([deployedAddresses.Mixer, callData])

        const surrogeth = genSurrogethClient(provider)

        // TODO: should be the forwarder's address and rfcalldata until
        // surrogeth-client does this upstream
        return surrogeth.submitTx(
            {
                to: deployedAddresses.RelayerForwarder, // should be the forwarder
                value: 0,
                data: rfCallData, // should be rfCallData
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
    tokenAddress,
) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(
            await connector.getProvider(config.chain.chainId),
        )
        const signer = provider.getSigner()
        const tokenMixerContract = await getTokenMixerContract(context)
        const erc20RelayerForwarderContract = await getERC20RelayerForwarderContract(context)

        const depositProof = genDepositProof(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        )

        const iface = new ethers.utils.Interface(tokenMixerContract.interface.abi)
        const callData = iface.functions.mixERC20.encode([
            depositProof,
            erc20RelayerForwarderContract.address,
        ])

        const rfIface = new ethers.utils.Interface(erc20RelayerForwarderContract.interface.abi)
        const rfCallData = rfIface.functions.relayCall.encode([
            deployedAddresses.TokenMixer,
            callData,
            tokenAddress,
        ])

        const surrogeth = genSurrogethClient(provider)

        return surrogeth.submitERC20Tx(
            {
                token: deployedAddresses.Token,
                to: deployedAddresses.ERC20RelayerForwarder,
                value: 0,
                data: rfCallData,
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
