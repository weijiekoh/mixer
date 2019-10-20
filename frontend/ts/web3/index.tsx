import { Connectors } from 'web3-react'
const { InjectedConnector } = Connectors
const config = require('../../exported_config')

const MetaMask = new InjectedConnector({
    supportedNetworks: [config.frontend.supportedNetwork]
})

export default { MetaMask }
