import * as ethers from 'ethers'
import * as argparse from 'argparse' 
import * as fs from 'fs' 
import * as path from 'path'
import * as etherlime from 'etherlime-lib'
import { config } from 'mixer-config'
import { genAccounts } from '../accounts'

const deploy = async (deployer: any, compiledContracts: string) => {
    const MiMC = require(path.join(compiledContracts, 'MiMC.json'))
    const MultipleMerkleTree = require(path.join(compiledContracts, 'MultipleMerkleTree.json'))
    const Semaphore = require(path.join(compiledContracts, 'Semaphore.json'))
    const Mixer = require(path.join(compiledContracts, 'Mixer.json'))

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
    const semaphoreContract = await deployer.deploy(
        Semaphore,
        libraries,
        20,
        0,
        12312,
        1000,
    )

    console.log('Deploying Mixer')
    const mixerContract = await deployer.deploy(Mixer,
        {},
        semaphoreContract.contractAddress,
        ethers.utils.parseEther(config.mixAmtEth),
        ethers.utils.parseEther(config.burnFeeEth),
    )

    console.log('Transferring ownership of Semaphore to Mixer')
    // @ts-ignore
    const tx = await semaphoreContract.transferOwnership(mixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Semaphore contract')
    // @ts-ignore
    await mixerContract.setSemaphoreExternalNulllifier()
    await tx.wait()

    return {
        mimcContract,
        multipleMerkleTreeContract,
        semaphoreContract,
        mixerContract,
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
        mixerContract, } 
    = await deploy(deployer, contractsPath)

    const addresses = {
        MiMC: mimcContract.contractAddress,
        MultipleMerkleTree: multipleMerkleTreeContract.contractAddress,
        Semaphore: semaphoreContract.contractAddress,
        Mixer: mixerContract.contractAddress,
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

export { deploy }
