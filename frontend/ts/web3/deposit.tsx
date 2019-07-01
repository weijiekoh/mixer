import * as ethers from 'ethers'
const abi = [
  {
    "constant": true,
    "inputs": [
      {
        "name": "in_xL",
        "type": "uint256"
      },
      {
        "name": "in_xR",
        "type": "uint256"
      },
      {
        "name": "in_k",
        "type": "uint256"
      }
    ],
    "name": "MiMCSponge",
    "outputs": [
      {
        "name": "xL",
        "type": "uint256"
      },
      {
        "name": "xR",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "pure",
    "type": "function"
  }
]
const deposit = async (context: any) => {
    const library = context.library
    const connector = context.connector
    if (library && connector) {
        const provider = new ethers.providers.Web3Provider(await connector.getProvider(1234))

        console.log('provider:', provider)
        const mimcContract = new ethers.Contract(
            '0x8cdaf0cd259887258bc13a92c0a6da92698644c0',
            abi,
            provider,
        )
        console.log(mimcContract)
        const val = await mimcContract.MiMCSponge('0x4', '0x5', '0x6')
        console.log(val)
    }
}

export { deposit }
