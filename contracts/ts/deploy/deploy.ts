import * as ethers from 'ethers'
import * as argparse from 'argparse' 
import * as fs from 'fs' 
import * as path from 'path'
import * as etherlime from 'etherlime-lib'
import { config } from 'mixer-config'
import { genAccounts } from '../accounts'

const deploySemaphore = (deployer, Semaphore, libraries) => {
    return deployer.deploy(
        Semaphore,
        libraries,
        20,
        0,
        12312,
        1000,
    )
}

const _deployMixer = (
    deployer,
    Mixer,
    semaphoreContractAddress,
    mixAmtEth,
    tokenAddress,
) => {
    return deployer.deploy(Mixer,
        {},
        semaphoreContractAddress,
        mixAmtEth,
        tokenAddress,
    )
}

const deployEthMixer = (
    deployer,
    Mixer,
    semaphoreContractAddress,
    mixAmtEth,
) => {
    return _deployMixer(
        deployer,
        Mixer,
        semaphoreContractAddress, 
        mixAmtEth,
        '0x0000000000000000000000000000000000000000',
    )
}

const deployTokenMixer = _deployMixer

const deployToken = async (
    deployer: any,
    compiledContracts: string,
) => {
    const ERC20Mintable = require(path.join(compiledContracts, 'ERC20Mintable.json'))
    const tokenContract = await deployer.deploy(ERC20Mintable, {})

    return tokenContract
}

const deployAllContracts = async (
    deployer,
    compiledContracts,
    mixAmtEth,
    mixAmtTokens,
) => {
    const contractsPath = path.join(
        __dirname,
        '../..',
        compiledContracts,
    )

    // Deploy token if it's not specified in config. This should be the case for local-dev.yaml
    // In Kovan, the DAI address is 0xc4375b7de8af5a38a93548eb8453a498222c4ff2
    let tokenAddress = config.chain.deployedAddresses.Token

    if (!tokenAddress) {
        console.log('Deploying token')
        const tokenContract = await deployToken(deployer, contractsPath)
        tokenAddress = tokenContract.contractAddress
    }

    const MiMC = require(path.join(contractsPath, 'MiMC.json'))
    const Semaphore = require(path.join(contractsPath, 'Semaphore.json'))
    const Mixer = require(path.join(contractsPath, 'Mixer.json'))
    const RelayerRegistry = require(path.join(contractsPath, 'RelayerRegistry.json'))

    console.log('Deploying MiMC')
    const mimcContract = await deployer.deploy(MiMC, {})

    const libraries = {
        MiMC: mimcContract.contractAddress,
    }

    console.log('Deploying Semaphore')
    const semaphoreContract = await deploySemaphore(
        deployer,
        Semaphore,
        libraries,
    )

    console.log('Deploying the ETH Mixer')
    const mixerContract = await deployEthMixer(
        deployer,
        Mixer,
        semaphoreContract.contractAddress,
        mixAmtEth,
    )

    console.log('Transferring ownership of Semaphore to the ETH Mixer')
    let tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Semaphore contract')
    await mixerContract.setSemaphoreExternalNulllifier()
    await tx.wait()

    console.log('Deploying Semaphore for the Token Mixer')
    const tokenSemaphoreContract = await deploySemaphore(
        deployer,
        Semaphore,
        libraries,
    )

    console.log('Deploying the Token Mixer')
    const tokenMixerContract = await deployTokenMixer(
        deployer,
        Mixer,
        tokenSemaphoreContract.contractAddress,
        mixAmtTokens,
        tokenAddress,
    )

    console.log('Transferring ownership of Token Semaphore to the Token Mixer')
    tx = await tokenSemaphoreContract.transferOwnership(tokenMixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Token Semaphore contract')
    tx = await tokenMixerContract.setSemaphoreExternalNulllifier()
    await tx.wait()

    console.log('Deploying Relayer Registry')
    const relayerRegistryContract = await deployer.deploy(RelayerRegistry, {})

    return {
        mimcContract,
        semaphoreContract,
        mixerContract,
        relayerRegistryContract,
        tokenSemaphoreContract,
        tokenMixerContract,
        tokenAddress,
    }

}

const main = async () => {
    const accounts = genAccounts()
    const admin = accounts[0]

    console.log('Using account', admin.address)

    const parser = new argparse.ArgumentParser({ 
        description: 'Deploy all contracts to an Ethereum network of your choice'
    })

    parser.addArgument(
        ['-c', '--compiled'],
        {
            help: 'The directory containing the compiled Solidity files',
            required: true
        }
    )

    parser.addArgument(
        ['-o', '--output'],
        {
            help: 'The filepath to save the addresses of the deployed contracts',
            required: true
        }
    )

    const args = parser.parseArgs()
    const compiledContracts = args.compiled
    const outputAddressFile = args.output

    const deployer = new etherlime.JSONRPCPrivateKeyDeployer(
        admin.privateKey,
        config.get('chain.url'),
        {
            chainId: config.get('chain.chainId'),
        },
    )

    const {
        mimcContract,
        semaphoreContract,
        mixerContract,
        relayerRegistryContract,
        tokenAddress,
        tokenSemaphoreContract,
        tokenMixerContract,
    } = await deployAllContracts(
        deployer,
        compiledContracts,
        ethers.utils.parseEther(config.mixAmtEth),
        ethers.utils.parseEther(config.mixAmtTokens),
    )

    const addresses = {
        MiMC: mimcContract.contractAddress,
        Semaphore: semaphoreContract.contractAddress,
        Mixer: mixerContract.contractAddress,
        TokenMixer: tokenMixerContract.contractAddress,
        TokenSemaphore: tokenSemaphoreContract.contractAddress,
        RelayerRegistry: relayerRegistryContract.contractAddress,
        Token: tokenAddress,
    }

    const addressJsonPath = path.join(__dirname, '../..', outputAddressFile)
    fs.writeFileSync(
        addressJsonPath,
        JSON.stringify(addresses),
    )

    console.log(addresses)
}

if (require.main === module) {
    try {
        main()
    } catch (err) {
        console.error(err)
    }
}

export {
    deployToken,
    deployAllContracts,
}
