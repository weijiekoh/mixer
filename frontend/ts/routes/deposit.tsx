import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { Buffer } from 'buffer'
import { useWeb3Context } from 'web3-react'
const config = require('../exported_config')
const deployedAddresses = config.chain.deployedAddresses
import { TxButton, TxStatuses } from '../components/txButton'

import {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
    getNumUnwithdrawn,
} from '../storage'

import { deposit } from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'mixer-crypto'

export default () => {
    initStorage()
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const operatorFeeEth = config.operatorFeeEth
    const mixAmtEth = config.mixAmtEth
    const mixAmt = ethers.utils.parseEther(mixAmtEth)

    const validRecipientAddress= !recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)
    const depositBtnDisabled = validRecipientAddress

    // Check whether there already is a deposit and disallow the user
    // from making another one
    // Redirect the user to the withdraw page if so

    if (getNumUnwithdrawn() > 0) {
          return <Redirect to='/countdown' />
    }

    const context = useWeb3Context()

    const handleDepositBtnClick = async () => {
        if (validRecipientAddress) {
            return
        }

        initStorage()

        // generate an Identity
        const identity = genIdentity()
        const keypair = identity.keypair
        const pubKey = keypair.pubKey
        const identityNullifier = identity.identityNullifier

        const identityCommitment = '0x' + genIdentityCommitment(identityNullifier, pubKey).toString(16)

        // Perform the deposit tx
        try {
            setTxStatus(TxStatuses.Pending)

            const minedTx = await deposit(context, identityCommitment, mixAmt)
            const receipt = await minedTx.wait()


            storeDeposit(identity, recipientAddress)
            updateDepositTxStatus(identity, minedTx.hash)
            setTxStatus(TxStatuses.Mined)

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
            {`The fee is ${operatorFeeEth * 2} ETH.`}
        </p>
        <p>
            {`You can get back ${mixAmtEth - operatorFeeEth * 2} ETH at midnight, UTC.`}
        </p>
        </div>

        <div className='column is-8 is-offset-2'>
            <p>Recipient's address:</p>
            <br />
            <input
                spellCheck={false}
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
            <TxButton
                onClick={handleDepositBtnClick}
                txStatus={txStatus}
                isDisabled={depositBtnDisabled}
                label={`Mix ${mixAmtEth} ETH`}
            />
            
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
