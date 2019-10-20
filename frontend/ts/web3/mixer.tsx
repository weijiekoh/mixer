import * as ethers from 'ethers'
const mixerAbi = require('../../abis/Mixer-abi.json')
const semaphoreAbi = require('../../abis/Semaphore-abi.json')
const relayerRegistryAbi = require('../../abis/RelayerRegistry-abi.json')
const tokenAbi = require('../../abis/ERC20-abi.json')
const config = require('../../exported_config')
const deployedAddresses = config.chain.deployedAddresses

// It's not trivial to generalise these functions as Parcel won't let you
// dynamically require JSON files

const getRelayerRegistryContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.RelayerRegistry,
        relayerRegistryAbi,
        signer,
    )
}

const getMixerContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.Mixer,
        mixerAbi,
        signer,
    )
}

const getTokenMixerContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.TokenMixer,
        mixerAbi,
        signer,
    )
}

const getSemaphoreContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.Semaphore,
        semaphoreAbi,
        signer,
    )
}

const getTokenSemaphoreContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.TokenSemaphore,
        semaphoreAbi,
        signer,
    )
}

const getTokenContract = async (context) => {
    const provider = new ethers.providers.Web3Provider(
        await context.connector.getProvider(config.chain.chainId),
    )
    const signer = provider.getSigner()

    return new ethers.Contract(
        deployedAddresses.Token,
        tokenAbi,
        signer,
    )
}

export {
    getRelayerRegistryContract,
    getMixerContract,
    getSemaphoreContract,
    getTokenMixerContract,
    getTokenSemaphoreContract,
    getTokenContract,
}
