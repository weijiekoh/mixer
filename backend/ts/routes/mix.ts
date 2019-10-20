require('module-alias/register')
import * as fs from 'fs'
import * as ethers from 'ethers'
import * as errors from '../errors'
import { config } from 'mixer-config'
import { getContract } from 'mixer-contracts'
import {
    verifyProof,
    unstringifyBigInts,
    genMixerSignal,
    keccak256HexToBigInt,
} from 'libsemaphore'
import * as Locker from 'node-etcd-lock'
import { genValidator } from './utils'
const deployedAddresses = config.get('chain.deployedAddresses')
const relayerAddress = config.get('backend.relayerAddress')

const hotWalletPrivKey = JSON.parse(
    fs.readFileSync(config.get('backend.hotWalletPrivKeyPath'), 'utf-8')
).privateKey

const verificationKey = require('@mixer-backend/verification_key.json')

interface DepositProof {
    signal: string
    a: string[]
    b: string[][]
    c: string[]
    input: string[]
    recipientAddress: string
    fee: string
}

const areEqualAddresses = (a: string, b: string) => {
    return BigInt(a) === BigInt(b)
}

// This operator accepts a fee that is large enough
const operatorFeeWei = ethers.utils.parseUnits(config.get('feeAmtEth').toString(), 'ether')
const operatorFeeTokens = config.get('feeAmtTokens')

const _mixRoute = (forTokens: boolean) => async (
    depositProof: DepositProof,
) => {
    const publicInputs = depositProof.input.map(BigInt)

    // verify the fee
    let enoughFees
    if (forTokens) {
        const fee = ethers.utils.bigNumberify(depositProof.fee)
        enoughFees = fee.gte(operatorFeeTokens)
    } else {
        const fee = ethers.utils.parseUnits(BigInt(depositProof.fee).toString(), 'wei')
        enoughFees = fee.gte(operatorFeeWei)
    }

    const insufficientFeeError = forTokens ?
        'BACKEND_MIX_INSUFFICIENT_TOKEN_FEE'
        :
        'BACKEND_MIX_INSUFFICIENT_ETH_FEE'

    if (!enoughFees) {
        const errorMsg = 'the fee is to low'
        throw {
            code: errors.errorCodes[insufficientFeeError],
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames[insufficientFeeError],
                errorMsg,
            )
        }
    }

    const mixerContractAddress = forTokens ? deployedAddresses.TokenMixer : deployedAddresses.Mixer

    // verify the external nullifier
    if (!areEqualAddresses(mixerContractAddress, depositProof.input[3])) {
        const errorMsg = 'the external nullifier in the input is invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_EXTERNAL_NULLIFIER_INVALID,
                errorMsg,
            )
        }
    }

    // verify the signal off-chain
    const signal = genMixerSignal(
        depositProof.recipientAddress,
        relayerAddress,
        depositProof.fee,
    )

    const signalHash = keccak256HexToBigInt(signal)

    const signalHashInvalid = '0x' + signalHash.toString(16) !== depositProof.input[2]
    const signalInvalid = depositProof.signal.toLowerCase() !== signal.toLowerCase()

    if (signalHashInvalid && !signalInvalid) {
        const errorMsg = 'the signal hash in the input is invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_SIGNAL_HASH_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_SIGNAL_HASH_INVALID,
                errorMsg,
            )
        }
    }

    if (!signalHashInvalid && signalInvalid) {
        const errorMsg = 'the signal param is invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_SIGNAL_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_SIGNAL_INVALID,
                errorMsg,
            )
        }
    }

    if (signalHashInvalid && signalInvalid) {
        const errorMsg = 'both the signal param and signal hash are invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_SIGNAL_AND_SIGNAL_HASH_INVALID,
                errorMsg,
            )
        }
    }

    // convert proof and public inputs to bigInts
    // this is only for the off-chain verification
    // be careful with the ordering of depositProof.b
    const proof = {
        pi_a: [...depositProof.a.map(BigInt), BigInt(1)],
        pi_b: [
            [
                BigInt(depositProof.b[0][1]),
                BigInt(depositProof.b[0][0]),
            ],
            [
                BigInt(depositProof.b[1][1]),
                BigInt(depositProof.b[1][0]),
            ],
            [1, 0].map(BigInt),
        ],
        pi_c: [...depositProof.c.map(BigInt), BigInt(1)],
    }

    // verify the snark off-chain
    const isValid = verifyProof(
        unstringifyBigInts(verificationKey),
        proof,
        publicInputs,
    )

    if (!isValid) {
        const errorMsg = 'the snark proof is invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_PROOF_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_PROOF_INVALID,
                errorMsg,
            )
        }
    }

    const provider = new ethers.providers.JsonRpcProvider(
        config.get('chain.url'),
        config.get('chain.chainId'),
    )

    const signer = new ethers.Wallet(
        hotWalletPrivKey,
        provider,
    )

    // TODO: check whether the contract has been deployed
    // Best to do this on server startup
    
    const mixerContract = getContract(
        'Mixer',
        signer,
        deployedAddresses,
    )

    let semaphoreContractName = forTokens ? 'TokenSemaphore' : 'Semaphore'
    const semaphoreContract = getContract(
        semaphoreContractName,
        signer,
        deployedAddresses,
        'Semaphore',
    )

    const relayerRegistryContract = getContract(
        'RelayerRegistry',
        signer,
        deployedAddresses,
    )

    const etcdAddress = config.get('backend.etcd.host') + ':' +
        config.get('backend.etcd.port')

    // TODO: handle the case if etcd isn't working
    const locker = new Locker({
        address: etcdAddress,
    })

    // Acquire a lock on the hot wallet address
    const lock = await locker.lock(
        signer.address,
        config.get('backend.etcd.lockTime'),
    )

    // Use the preBroadcastCheck view function to checks some inputs
    const preBroadcastChecked = await semaphoreContract.preBroadcastCheck(
        depositProof.a,
        depositProof.b,
        depositProof.c,
        depositProof.input,
        '0x' + signalHash.toString(16),
    )

    if (!preBroadcastChecked) {

        // Release the lock
        await lock.unlock()

        const errorMsg = 'the proof is invalid according to pre-broadcast checks'
        throw {
            code: errors.errorCodes.BACKEND_MIX_PROOF_PRE_BROADCAST_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_PROOF_PRE_BROADCAST_INVALID,
                errorMsg,
            )
        }
    }

    // Get the latest nonce
    const nonce = await provider.getTransactionCount(signer.address, 'pending')

    const mixerIface = new ethers.utils.Interface(mixerContract.interface.abi)
    let mixCallData

    if (forTokens) {
        mixCallData = mixerIface.functions.mixERC20.encode([depositProof, relayerAddress])
    } else {
        mixCallData = mixerIface.functions.mix.encode([depositProof, relayerAddress])
    }

    const relayerRegistryIface = new ethers.utils.Interface(relayerRegistryContract.interface.abi)
    const relayCallData = relayerRegistryIface.functions.relayCall.encode(
        [
            mixerContractAddress,
            mixCallData
        ],
    )

    const unsignedTx = {
        to: mixerContractAddress,
        value: 0,
        data: mixCallData,
        nonce,
        gasPrice: ethers.utils.parseUnits('20', 'gwei'),
        gasLimit: config.get('chain.mix.gasLimit'),
    }
    //const unsignedTx = {
        //to: relayerRegistryContract.address,
        //value: 0,
        //data: relayCallData,
        //nonce,
        //gasPrice: ethers.utils.parseUnits('20', 'gwei'),
        //gasLimit: config.get('chain.mix.gasLimit'),
    //}

    // Sign the transaction
    const signedData = await signer.sign(unsignedTx)

    // Send the transaction but don't wait for it to be mined
    const tx = provider.sendTransaction(signedData)

    // Release the lock so other running instances of this function can
    // get the nonce and send their own tx
    await lock.unlock()

    tx.then((_) => {
        // TODO: figure out what to do for successful txes - if even necessary
    })

    tx.catch((_) => {
        // TODO: figure out what to do for failed txes - if even necessary
    })

    const txHash = ethers.utils.keccak256(signedData)

    return {
        txHash,
    }
}


const mixEthRoute = {
    route: _mixRoute(false),
    reqValidator: genValidator('mix'),
}

const mixTokensRoute = {
    route: _mixRoute(true),
    reqValidator: genValidator('mix'),
}

export { 
    mixEthRoute,
    mixTokensRoute,
}
