import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { useWeb3Context } from 'web3-react'
const deployedAddresses = require('../deployedAddresses.json')
const config = require('../exported_config')

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
    None, Pending, Mined, Err,
}

export default () => {
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const operatorFeeEth = config.operatorFeeEth
    const mixAmtEth = config.mixAmtEth
    const mixAmt = ethers.utils.parseEther(mixAmtEth)

    initStorage()

    // TODO: check whether there already is a deposit and disallow the user
    // from making another one
    // Redirect the user to the withdraw page if so

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

        storeDeposit(identity, recipientAddress)

        // Perform the deposit tx
        try {
            setTxStatus(TxStatuses.Pending)

            const minedTx = await deposit(context, identityCommitment, mixAmt)

            updateDepositTxStatus(identity, minedTx.hash)

            setTxStatus(TxStatuses.Mined)
            setErrorMsg('')

        } catch (err) {
            setTxStatus(TxStatuses.Err)

            if (
                err.code === ethers.errors.UNSUPPORTED_OPERATION &&
                err.reason === 'contract not deployed'
            ) {
                setErrorMsg(`The mixer contract was not deployed to the expected address ${deployedAddresses.Mixer}`)
            }
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

    depositBtnDisabled = !recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)

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
                {`You can mix ${mixAmtEth} ETH at a time.`}
            </p>
        <p>
            {`The operator's fee is ${operatorFeeEth} ETH.`}
        </p>
        <p>
            {`You can get back ${mixAmtEth - operatorFeeEth} ETH at midnight, UTC.`}
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
                {`Mix ${mixAmtEth} ETH`}
            </span>
            
            <br />
            <br />

            { txStatus === TxStatuses.Mined &&
                <article className="message is-success">
                  <div className="message-body">
                      Transaction mined.
                  </div>
                  <Redirect to='/countdown' />
                </article>
            }

            { txStatus === TxStatuses.Err &&
                <article className="message is-danger">
                  <div className="message-body">
                    {errorMsg}
                  </div>
              </article>
            }

        </div>
    </div>
        </div>
    </div>
    )
}
