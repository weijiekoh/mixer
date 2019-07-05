import * as ethers from 'ethers'
const mixerAbi = require('../abis/Mixer-abi.json')
const semaphoreAbi = require('../abis/Semaphore-abi.json')
const deployedAddresses = require('../deployedAddresses.json')
const config = require('../exported_config')

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

export { getMixerContract, getSemaphoreContract }
