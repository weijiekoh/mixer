import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { useWeb3Context } from 'web3-react'

import {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
} from '../storage'

import { deposit } from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'mixer-crypto'

enum TxStatuses {
    None, Pending, Mined,
}

export default () => {
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [recipientAddress, setRecipientAddress] = useState('')
    initStorage()

    const handleDepositBtnClick = async (context: any) => {
        if (depositBtnDisabled) {
            return
        }

        // generate an Identity
        const identity = genIdentity()
        const keypair = identity.keypair
        const pubKey = keypair.pubKey
        const identityNullifier = identity.identityNullifier

        const identityCommitment = '0x' + genIdentityCommitment(identityNullifier, pubKey).toString(16)
        const mixAmt = ethers.utils.parseEther('0.1')

        storeDeposit(identity, recipientAddress)

        // Perform the deposit tx
        try {
            setTxStatus(TxStatuses.Pending)

            const minedTx = await deposit(context, identityCommitment, mixAmt)

            updateDepositTxStatus(identity, minedTx.hash)

            setTxStatus(TxStatuses.Mined)

        } catch (err) {
            console.error('Error', err)
            setTxStatus(TxStatuses.None)
        }
    }

    const context = useWeb3Context()
    let depositBtnClass = 'button is-large '
    let depositBtnDisabled = false

    // Change the appearance of the deposit button based on the transaction
    if (txStatus === TxStatuses.None) {
        depositBtnClass += 'is-primary'

    } else if (txStatus === TxStatuses.Pending) {
        depositBtnClass += 'is-loading is-primary'
        depositBtnDisabled = true

    } else if (txStatus === TxStatuses.Mined) {
        depositBtnDisabled = true
    }

    depositBtnDisabled = !recipientAddress.match(/^0x[a-fA-F0-9]{40}$/))

    return (
        <div className='section'>
            <div className='columns has-text-centered'>
                <div className='column is-12'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            MultiMix (working name) helps you hide your bags.
                        </h2>
        </div>
        <div className='section'>
            <p>
                You can mix 0.1 ETH at a time.
            </p>
        <p>
            The operator's fee is 1%.
        </p>
        <p>
            You can get back 0.099 ETH at midnight, UTC.
        </p>
        </div>

        <div className='column is-8 is-offset-2'>
            <p>Recipient's address:</p>
            <br />
            <input
                className="input eth_address"
                type="text"
                placeholder="Recipient's ETH address" 
                value={recipientAddress}
                onChange={(e) => {
                    setRecipientAddress(e.target.value)
                }}
            />
        </div>

        <div className='section'>
            <span
                onClick={() => {handleDepositBtnClick(context)}}
                disabled={depositBtnDisabled}
                href='/countdown'
                className={depositBtnClass}>
                Mix 0.1 ETH
            </span>

            { txStatus === TxStatuses.Mined &&
                <div>
                    <p>Transaction mined.</p>
                    <Redirect to='/countdown' />
                </div
            }

        </div>
    </div>
        </div>
    </div>
    )
}
