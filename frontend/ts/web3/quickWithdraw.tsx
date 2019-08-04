import * as ethers from 'ethers'
const mixerAbi = require('../abis/Mixer-abi.json')
import { getRelayerRegistryContract, getMixerContract } from './mixer'
const config = require('../exported_config')
const deployedAddresses = config.chain.deployedAddresses

/*
 * Perform a web3 transaction to make quick withdrawal
 * @param context The web3-react context
 * @param identityCommitment A hex string of the user's identity commitment
 */
const quickWithdraw = async (
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
        const relayerRegistryContract = await getRelayerRegistryContract(context)

        const depositProof = {
            signal,
            a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
            b: [ 
                [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
                [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ],
            ],
            c: [ proof.pi_c[0].toString(), proof.pi_c[1].toString() ],
            input: [
                publicSignals[0].toString(),
                publicSignals[1].toString(),
                publicSignals[2].toString(),
                publicSignals[3].toString(),
            ],
            recipientAddress,
            fee: feeAmt,
        }

        const iface = new ethers.utils.Interface(mixerContract.interface.abi)
        const callData = iface.functions.mix.encode([depositProof, broadcasterAddress])

        return relayerRegistryContract.relayCall(
            deployedAddresses.Mixer,
            callData,
            { gasLimit: 8000000 },
        )
    }
}

export { quickWithdraw }
