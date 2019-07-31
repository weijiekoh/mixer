
const mix = async (
    mixerContract,
    signal,
    proof,
    publicSignals,
    recipientAddress,
    feeAmt,
) => {

    return await mixerContract.mix(
        genMixInputs(
            signal,
            proof,
            publicSignals,
            recipientAddress,
            feeAmt,
        ),
    )
}

const genMixInputs = (signal, proof, publicSignals, recipientAddress, feeAmt) => {
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
            publicSignals[4].toString()
        ],
        recipientAddress,
        fee: feeAmt,
    }
}

const areEqualAddresses = (a: string, b: string) => {
    return BigInt(a) === BigInt(b)
}

export {
    genMixInputs,
    areEqualAddresses,
    mix,
}
