require('module-alias/register')
import * as ethers from 'ethers'
import { config, errors } from 'mixer-utils'
import { getContract } from 'mixer-contracts'
import {
    verifyProof,
    bigInt,
    unstringifyBigInts,
    genSignalAndSignalHash,
} from 'mixer-crypto'
import * as Locker from 'node-etcd-lock'
import { genValidator } from './utils'
const deployedAddresses = require('../deployedAddresses.json')

const verificationKey = require('@mixer-backend/verification_key.json')

//struct DepositProof {
    //bytes32 signal;
    //uint[2] a;
    //uint[2][2] b;
    //uint[2] c;
    //uint[5] input;
    //address recipientAddress;
    //uint256 fee;
//}

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
    return a.toLowerCase() === b.toLowerCase()
}

const mix = async (depositProof: DepositProof) => {
    const publicInputs = depositProof.input.map(bigInt)

    // verify the external nullifier
    if (!areEqualAddresses(deployedAddresses.Mixer, depositProof.input[3])) {
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

    // verify the broadcaster's address
    if (!areEqualAddresses(deployedAddresses.Mixer, depositProof.input[4])) {
        const errorMsg = 'the broadcaster\'s address in the input is invalid'
        throw {
            code: errors.errorCodes.BACKEND_MIX_BROADCASTER_ADDRESS_INVALID,
            message: errorMsg,
            data: errors.genError(
                errors.MixerErrorNames.BACKEND_MIX_BROADCASTER_ADDRESS_INVALID,
                errorMsg,
            )
        }
    }

    // verify the signal off-chain
    const { signalHash, signal } = genSignalAndSignalHash(
        depositProof.recipientAddress,
        deployedAddresses.Mixer,
        depositProof.fee,
    )

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
        pi_a: [...depositProof.a.map(bigInt), bigInt(1)],
        pi_b: [
            [
                bigInt(depositProof.b[0][1]),
                bigInt(depositProof.b[0][0]),
            ],
            [
                bigInt(depositProof.b[1][1]),
                bigInt(depositProof.b[1][0]),
            ],
            [1, 0].map(bigInt),
        ],
        pi_c: [...depositProof.c.map(bigInt), bigInt(1)],
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

    // TODO: check whether the contract has been deployed
    
    const provider = new ethers.providers.JsonRpcProvider(
        config.get('chain.url'),
        config.get('chain.chainId'),
    )

    const signer = new ethers.Wallet(
        config.get('backend.hotWalletPrivKey'),
        provider,
    )

    const mixerContract = getContract(
        'Mixer',
        signer,
        deployedAddresses,
    )

    const semaphoreContract = getContract(
        'Semaphore',
        signer,
        deployedAddresses,
    )

    const etcdAddress = config.get('backend.etcd.host') + ':' +
        config.get('backend.etcd.port')

    // TODO: handle error where etcd isn't running
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
    const nonce = await provider.getTransactionCount(signer.address)

    const iface = new ethers.utils.Interface(mixerContract.interface.abi)
    const funcInterface = iface.functions.mix
    const callData = funcInterface.encode([depositProof])

    const unsignedTx = {
        to: mixerContract.address,
        value: 0,
        data: callData,
        nonce,
        gasLimit: config.get('chain.mix.gasLimit'),
    }

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

const mixRoute = {
    route: mix,
    reqValidator: genValidator('mix'),
}

export default mixRoute
