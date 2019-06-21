import { ethers } from 'ethers'

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

// 0. no web3
// 1. logged out
// 2. wrong network
// 3. ok
// 4. different account
/*

0 is alone
1, 2, 3 in a ring

*/

const WalletWidget = () => {
    const context = useWeb3Context()
    const [web3Status, setWeb3Status] = useState('none')
    let library
    if (window.hasOwnProperty('ethereum')) {
        // @ts-ignore
        library = new ethers.providers.Web3Provider(window.ethereum)
    } else {
        setWeb3Status('no web3')
    }

    const checkIfConnected = () => {
        if (library) {
            library.listAccounts().then((accounts: any[]) => {
                if (accounts.length > 0 && 
                    web3Status !== 'ok' &&
                    web3Status !== 'unsupported network') {
                    setConnector()
                }
            })
        }
    }

    checkIfConnected()

    useEffect(() => {
        //checkIfConnected()
    })

    if (context.active && web3Status !== 'ok') {
        setWeb3Status('ok')
    } else if (!context.active && web3Status !== 'logged out' && web3Status !== 'unsupported network') {
        setWeb3Status('logged out')
    }

    const onConnectBtnClick = () => {
        if (!context.active) {
            setConnector()
        }
    }

    const setConnector = () => {
        context.setConnector('MetaMask', { suppressAndThrowErrors: true }).then(() => {
            setWeb3Status('ok')
        }).catch((error: any) => {
            console.log(error.code === 'UNSUPPORTED_NETWORK', context)
            if (error.code === 'UNSUPPORTED_NETWORK') {
                setWeb3Status('unsupported network')
            }
        })
    }

    console.log(context, web3Status)

    return (
        <div>
            <p>{web3Status}</p>
            {
                !context.active &&
                web3Status !== 'unsupported network' &&
                <a className='button is-link is-rounded'
                    role='button'
                    onClick={() => {onConnectBtnClick()}} >
                    Connect wallet
                </a>
            }
        </div>
    )
    //const [web3Status, setWeb3Status] = useState('')

    //const setConnector = (context) => {
        //return context.setConnector('MetaMask', { suppressAndThrowErrors: true })
    //}

    //useEffect(() => {
        //if (context.active) {
            //setConnector(context).then(() => {})
            //.catch((error: any) => {
                //if (error.code === 'UNSUPPORTED_NETWORK') {
                    //setWeb3Status(error.code)
                //}
            //})
        //} else {
            //setWeb3Status('LOGGED_OUT')
        //}
    //})

    //const onConnectBtnClick = () => {
        //// TODO: figure out the ideal state machine behind web3 / metamask
    //}

    //return (
        //<div id='wallet-widget'>
            //{ renderWidget(web3Status, context, onConnectBtnClick) }
        //</div>
    //)
}

export default WalletWidget
