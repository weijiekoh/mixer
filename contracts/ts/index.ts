import * as ethers from 'ethers'

const getContract = (
    name: string,
    signer: ethers.Signer,
    deployedAddresses: object,
) => {
    const abi = require(`../compiled/abis/${name}-abi.json`)

    const contract = new ethers.Contract(
        deployedAddresses[name],
        abi,
        signer,
    )

    return contract
}

export { getContract }
