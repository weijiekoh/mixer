import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { Buffer } from 'buffer'
import { useWeb3Context } from 'web3-react'
const config = require('../exported_config')
const deployedAddresses = config.chain.deployedAddresses
import { TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import { sleep } from 'mixer-utils'

import {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
    getNumUnwithdrawn,
} from '../storage'

import { getBalance } from '../web3/balance'
import { deposit } from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'mixer-crypto'
import {
    mixAmtEth,
    operatorFeeEth,
} from '../utils/ethAmts'

const blockExplorerTxPrefix = config.frontend.blockExplorerTxPrefix

const name = 'MicroMix'

export default () => {
    initStorage()
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [txHash, setTxHash] = useState('')
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [enoughEth, setEnoughEth] = useState(true)

    // The operator's fee is equal to the burn fee by default but this isn't
    // enforced by the contract
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

            const tx = await deposit(context, identityCommitment, mixAmt)

            setTxHash(tx.hash)

            storeDeposit(identity, recipientAddress)

            if (config.env === 'local-dev') {
                await sleep(3000)
            }

            const receipt = await tx.wait()

            updateDepositTxStatus(identity, tx.hash)
            setTxStatus(TxStatuses.Mined)

        } catch (err) {
            console.log(err)
            setTxStatus(TxStatuses.Err)

            if (
                err.code === ethers.errors.UNSUPPORTED_OPERATION &&
                err.reason === 'contract not deployed'
            ) {
                setErrorMsg(`The mixer contract was not deployed to the expected ` +
                    `address ${deployedAddresses.Mixer}`)
            } else {
                setErrorMsg('An error with the transaction occurred.')
            }
        }
    }

    getBalance(context).then((balance) => {
        if (balance) {
            const enough = balance.gte(ethers.utils.parseEther('0.11'))
            setEnoughEth(enough)
        }
    })

    return (
        <div className='columns has-text-centered'>
            <div className='column is-12'>
                <div className='section first-section'>
                    <h2 className='subtitle'>
                        {name} makes your Kovan ETH anonymous.
                    </h2>

                    <div className='column is-8 is-offset-2'>
                        <p>
                            {name} is an Ethereum mixer based on
                            zero-knowledge proofs.
                            It is highly experimental, likely insecure,
                            and not yet audited. Do not use it to mix real
                            funds yet. We recommend that you use desktop
                            Chrome, Firefox, or Brave with <a
                                href="https://metamask.io">MetaMask</a> for best
        results. <br /><br />Click <a
                                href="https://github.com/weijiekoh/mixer"
                                target="_blank">here</a> for more information about {name}.
                        </p>
                    </div>
                </div>

                <div className='section'>
                    <p>
                        {`You can mix ${mixAmtEth} ETH at a time.`}
                    </p>
                <p>
                    {`The fee is ${operatorFeeEth} ETH.`}
                </p>
                <p>
                    {`You can get back ${mixAmtEth - operatorFeeEth} ETH at midnight, UTC.`}
                </p>
            </div>

            { !enoughEth &&
                <p>
                    To continue, please top up your account with at least 0.11
                    KETH (0.1 to deposit and 0.01 for gas). You can get KETH
                    from a faucet <a target="_blank" href="https://faucet.kovan.network/">here</a> or <a target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
                </p>
            }

            { (context.error != null && context.error.code === 'UNSUPPORTED_NETWORK') &&
                <p>
                    To continue, please connect to the correct Ethereum network.
                </p>
            }
            { enoughEth && context.error == null &&
                <div>
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

                        { txHash.length > 0 &&
                            <div>
                                <br />
                                <TxHashMessage 
                                    mixSuccessful={false}
                                    txHash={txHash}
                                    txStatus={TxStatuses.Pending} />
                            </div>
                        }
                            
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
            }

            </div>
        </div>
    )
}
