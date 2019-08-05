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
    mixAmt,
    tokenAddress,
) => {
    return deployer.deploy(Mixer,
        {},
        semaphoreContractAddress,
        mixAmt,
        tokenAddress,
    )
}

const deployEthMixer = (
    deployer,
    Mixer,
    semaphoreContractAddress,
) => {
    return _deployMixer(
        deployer,
        Mixer,
        semaphoreContractAddress, 
        ethers.utils.parseEther(config.mixAmtEth),
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

const deployAllContractsForTokenMixer = async (
    deployer: any,
    compiledContracts: string,
    mixAmt: number,
    tokenAddress: string,
) => {
    const MiMC = require(path.join(compiledContracts, 'MiMC.json'))
    const Semaphore = require(path.join(compiledContracts, 'Semaphore.json'))
    const Mixer = require(path.join(compiledContracts, 'Mixer.json'))
    const RelayerRegistry = require(path.join(compiledContracts, 'RelayerRegistry.json'))

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

    console.log('Deploying the Token Mixer')
    const mixerContract = await deployTokenMixer(
        deployer,
        Mixer,
        semaphoreContract.contractAddress,
        mixAmt,
        tokenAddress,
    )

    console.log('Transferring ownership of Semaphore to the Token Mixer')
    const tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Semaphore contract')
    await mixerContract.setSemaphoreExternalNulllifier()
    await tx.wait()

    console.log('Deploying Relayer Registry')
    const relayerRegistryContract = await deployer.deploy(RelayerRegistry, {})

    return {
        mimcContract,
        semaphoreContract,
        mixerContract,
        relayerRegistryContract,
    }
}

const deployAllContractsForEthMixer = async (deployer: any, compiledContracts: string) => {
    const MiMC = require(path.join(compiledContracts, 'MiMC.json'))
    const MultipleMerkleTree = require(path.join(compiledContracts, 'MultipleMerkleTree.json'))
    const Semaphore = require(path.join(compiledContracts, 'Semaphore.json'))
    const Mixer = require(path.join(compiledContracts, 'Mixer.json'))
    const RelayerRegistry = require(path.join(compiledContracts, 'RelayerRegistry.json'))

    console.log('Deploying MiMC')
    const mimcContract = await deployer.deploy(MiMC, {})

    const libraries = {
        MiMC: mimcContract.contractAddress,
    }

    console.log('Deploying MultipleMerkleTree')
    const multipleMerkleTreeContract = await deployer.deploy(
        MultipleMerkleTree,
        libraries,
    )

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
    )

    console.log('Transferring ownership of Semaphore to the ETH Mixer')
    const tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Semaphore contract')
    await mixerContract.setSemaphoreExternalNulllifier()
    await tx.wait()

    console.log('Deploying Relayer Registry')
    const relayerRegistryContract = await deployer.deploy(RelayerRegistry, {})

    return {
        mimcContract,
        multipleMerkleTreeContract,
        semaphoreContract,
        mixerContract,
        relayerRegistryContract
    }
}

const main = async () => {
    const accounts = genAccounts()
    const admin = accounts[0]

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

    const contractsPath = path.join(
        __dirname,
        '../..',
        compiledContracts,
    )
    console.log(contractsPath)

    const {
        mimcContract,
        multipleMerkleTreeContract,
        semaphoreContract,
        mixerContract,
        relayerRegistryContract,
    } 
    = await deployAllContractsForEthMixer(deployer, contractsPath)

    const addresses = {
        MiMC: mimcContract.contractAddress,
        MultipleMerkleTree: multipleMerkleTreeContract.contractAddress,
        Semaphore: semaphoreContract.contractAddress,
        Mixer: mixerContract.contractAddress,
        RelayerRegistry: relayerRegistryContract.contractAddress,
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
    deployAllContractsForTokenMixer,
    deployAllContractsForEthMixer,
}
