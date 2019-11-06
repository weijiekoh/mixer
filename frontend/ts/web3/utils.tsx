const genDepositProof = (
    signal,
    proof,
    publicSignals,
    recipientAddress,
    fee,
) => {
    return {
        signal,
        a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
        b: [ 
            [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
            [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ],
        ],
        c: [ proof.pi_c[0].toString(), proof.pi_c[1].toString() ],
        input: publicSignals.map((x) => x.toString()),
        recipientAddress,
        fee: fee.toString(),
    }
}

export { genDepositProof }
