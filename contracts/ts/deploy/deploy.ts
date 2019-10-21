require('module-alias/register')
import * as ethers from 'ethers'
import * as argparse from 'argparse' 
import * as fs from 'fs' 
import * as path from 'path'
import * as etherlime from 'etherlime-lib'
import { config } from 'mixer-config'
import { genAccounts } from '../accounts'

const ERC20Mintable = require('@mixer-contracts/compiled/ERC20Mintable.json')
const RelayerForwarder = require('@mixer-contracts/compiled/RelayerForwarder.json')
const RelayerReputation = require('@mixer-contracts/compiled/RelayerReputation.json')

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
    mixAmtTokens,
    tokenAddress,
) => {

    return deployer.deploy(
        Mixer,
        {},
        semaphoreContractAddress,
        mixAmtTokens.toString(),
        tokenAddress,
    )
}

const deployTokenMixer = _deployMixer

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

const deployRF = (
    deployer: any,
    num: number,
    denom: number,
) => {
    return deployer.deploy(
        RelayerForwarder,
        {},
        num,
        denom,
    )
}

const deployRR = (
    deployer: any,
    rfAddress: string,
) => {
    return deployer.deploy(
        RelayerReputation,
        {},
        rfAddress,
    )
}

const deployToken = async (
    deployer: any,
) => {
    const tokenContract = await deployer.deploy(
        ERC20Mintable,
        {},
        'Token',
        'TKN',
        18,
    )

    return tokenContract
}

const deployAllContracts = async (
    deployer,
    mixAmtEth,
    mixAmtTokens,
    adminAddress,
) => {
    // Deploy token if it's not specified in config. This should be the case for local-dev.yaml
    // In Kovan, the DAI address is 0xc4375b7de8af5a38a93548eb8453a498222c4ff2
    let tokenAddress = config.chain.deployedAddresses.Token
    let tokenContract
    let tokenDecimals = config.get('tokenDecimals')

    // Deploy RelayerReputation if it's not specified in config. This should be
    // the case for local-dev.yaml.
    // In Kovan, the RR address is ___
    let rrAddress = config.chain.deployedAddresses.RelayerReputation
    let relayerReputationContract

    let rfAddress = config.chain.deployedAddresses.RelayerForwarder
    let relayerForwarderContract

    if (config.env !== 'local-dev') {
        console.log('Using existing token contract at', tokenAddress)
        tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20Mintable.abi,
            deployer.signer,
        )

        console.log('Using existing RelayerReputation contract at', rrAddress)
        relayerReputationContract = new ethers.Contract(
            rrAddress,
            RelayerReputation.abi,
            deployer.signer,
        )

        console.log('Using existing RelayerForwarder contract at', rrAddress)
        relayerForwarderContract = new ethers.Contract(
            rfAddress,
            RelayerForwarder.abi,
            deployer.signer,
        )
    } else {
        const num = config.surrogeth.surrogethd.burnRegistry.RelayerForwarder.burnNum
        const denom = config.surrogeth.surrogethd.burnRegistry.RelayerForwarder.burnDenom

        console.log('Deploying token')
        tokenContract = await deployToken(deployer)
        tokenAddress = tokenContract.address

        console.log('Deploying RelayerForwarder')
        relayerForwarderContract = await deployRF(deployer, num, denom)
        rfAddress = relayerForwarderContract.contractAddress ? relayerForwarderContract.contractAddress : relayerForwarderContract.address

        console.log('Deploying RelayerReputation')
        relayerReputationContract = await deployRR(deployer, rfAddress)
        rrAddress = relayerReputationContract.contractAddress ? relayerReputationContract.contractAddress : relayerReputationContract.address

        console.log('Setting the RelayerReputation address in RelayerForwarder')
        await relayerForwarderContract.setReputation(rrAddress)

        console.log('Setting a relayer locator')

        await relayerReputationContract.setRelayerLocator(
            config.surrogeth.surrogethd.relayerAddress,
            config.surrogeth.surrogethd.locator.url,
            config.surrogeth.surrogethd.locator.type,
        )
    }

    tokenAddress = tokenContract.contractAddress ? tokenContract.contractAddress : tokenContract.address

    const MiMC = require('@mixer-contracts/compiled/MiMC.json')
    const Semaphore = require('@mixer-contracts/compiled/Semaphore.json')
    const Mixer = require('@mixer-contracts/compiled/Mixer.json')

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
    tx = await mixerContract.setSemaphoreExternalNulllifier({ gasLimit: 100000 })
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
        mixAmtTokens * (10 ** tokenDecimals),
        tokenAddress,
    )

    console.log('Transferring ownership of Token Semaphore to the Token Mixer')
    tx = await tokenSemaphoreContract.transferOwnership(tokenMixerContract.contractAddress)
    await tx.wait()

    console.log('Setting the external nullifier of the Token Semaphore contract')
    tx = await tokenMixerContract.setSemaphoreExternalNulllifier({ gasLimit: 100000 })
    await tx.wait()

    if (config.env === 'local-dev') {
        console.log('Minting tokens')
        await tokenContract.mint(adminAddress, '100000000000000000000000000')
    }

    return {
        mimcContract,
        semaphoreContract,
        mixerContract,
        relayerForwarderContract,
        relayerReputationContract,
        tokenSemaphoreContract,
        tokenMixerContract,
        tokenContract,
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
        ['-o', '--output'],
        {
            help: 'The filepath to save the addresses of the deployed contracts',
            required: true
        }
    )

    const args = parser.parseArgs()
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
        relayerReputationContract,
        relayerForwarderContract,
        tokenContract,
        tokenSemaphoreContract,
        tokenMixerContract,
    } = await deployAllContracts(
        deployer,
        ethers.utils.parseEther(config.mixAmtEth.toString()),
        config.mixAmtTokens,
        admin.address,
    )

    const addresses = {
        MiMC: mimcContract.contractAddress,
        Semaphore: semaphoreContract.contractAddress,
        Mixer: mixerContract.contractAddress,
        TokenMixer: tokenMixerContract.contractAddress,
        TokenSemaphore: tokenSemaphoreContract.contractAddress,
        RelayerForwarder: relayerForwarderContract.contractAddress,
        RelayerReputation: relayerReputationContract.contractAddress,
        Token: tokenContract.contractAddress ? tokenContract.contractAddress : tokenContract.address,
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
