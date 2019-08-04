import * as ethers from 'ethers'

const mix = async (
    relayerRegistryContract,
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
    relayerAddress,
) => {
    const depositProof = genDepositProof(
        signal,
        proof,
        publicSignals,
        recipientAddress,
        feeAmt,
    )
    const iface = new ethers.utils.Interface(mixerContract.interface.abi)
    const callData = iface.functions.mix.encode([depositProof, relayerAddress])

    return relayerRegistryContract.relayCall(
        mixerContract.contractAddress,
        callData,
    )

    //return await mixerContract.mix(
        //genDepositProof(
            //signal,
            //proof,
            //publicSignals,
            //recipientAddress,
            //feeAmt,
        //),
    //)
}

const genDepositProof = (
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
) => {
    return {
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
}

const areEqualAddresses = (a: string, b: string) => {
    return BigInt(a) === BigInt(b)
}

export {
    genDepositProof,
    areEqualAddresses,
    mix,
}
