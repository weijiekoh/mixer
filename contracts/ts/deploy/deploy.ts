import * as argparse from 'argparse' 
import * as path from 'path'
import * as etherlime from 'etherlime-lib'
import { config } from 'mixer-utils'
import { generateAccounts } from '../accounts'

const main = async () => {
    const accounts = generateAccounts()
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
    const MiMC = require(path.join(__dirname, '../../',  compiledContracts, 'MiMC.json'))
    console.log('Deploying MiMC')
    const mimcContract = await deployer.deploy(MiMC, {})
}

if (require.main === module) {
    main()
}
