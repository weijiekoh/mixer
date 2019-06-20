import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useWeb3Context, Connectors } from 'web3-react'

// From Font Awesome
const circleIcon = (className: string) => (
    <svg viewBox='0 0 512 512' className={'circle-icon ' + className}>
        <path d='M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z'/>
    </svg>
)

const renderWidget = (web3Status: any, context, onConnectBtnClick) => {
    if (web3Status === 'NO_WALLET') {
        const walletLearnUrl = 'https://ethereum.org/use/#_3-what-is-a-wallet' +
            '-and-which-one-should-i-use'

        return (
            <p>
                { circleIcon('not-ok') }
                Please install an <a
                    href={walletLearnUrl} target='blank'>
                    Ethereum wallet.
                </a>
            </p>
        )

    } else if (web3Status === 'UNSUPPORTED_NETWORK') {
        return (
            <p>
                { circleIcon('warn') }
                Please connect to the Kovan testnet.
            </p>
        )
    } else if (web3Status === 'LOGGED_OUT') {

        return (
            <a className='button is-link is-rounded'
                role='button'
                onClick={() => {onConnectBtnClick(context)}} >
                Connect wallet
            </a>
        )

    } else {
        return (
            <p>
                <span className='is-family-monospace address'>
                    { circleIcon('ok') }
                    { context.account }
                </span>
            </p>
        )
    }
}

const WalletWidget = () => {
    const context = useWeb3Context()
    const [web3Status, setWeb3Status] = useState('')

    const setConnector = (context) => {
        return context.setConnector('MetaMask', { suppressAndThrowErrors: true })
    }

    useEffect(() => {
        if (context.active) {
            setConnector(context).then(() => {})
            .catch((error: any) => {
                if (error.code === 'UNSUPPORTED_NETWORK') {
                    setWeb3Status(error.code)
                }
            })
        } else {
            setWeb3Status('LOGGED_OUT')
        }
    })

    const onConnectBtnClick = () => {
        // TODO: figure out the ideal state machine behind web3 / metamask
    }

    return (
        <div id='wallet-widget'>
            { renderWidget(web3Status, context, onConnectBtnClick) }
        </div>
    )
}

export default WalletWidget
