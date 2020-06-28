import React, { useState, Component } from 'react'
import ReactDOM from 'react-dom'
import { Redirect } from 'react-router-dom'
import * as ethers from 'ethers'
import { Buffer } from 'buffer'
import { useWeb3Context } from 'web3-react'
const config = require('../../exported_config')
const deployedAddresses = config.chain.deployedAddresses
import { Erc20ApproveButton, TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import { sleep } from 'mixer-utils'
// @ts-ignore
import cat from '../../img/cat.png'

import {
    initStorage,
    storeDeposit,
    updateDepositTxStatus,
    getNumUnwithdrawn,
} from '../storage'

import { getBalance, getTokenBalance } from '../web3/balance'
import { depositEth, depositTokens, getTokenAllowance, approveTokens } from '../web3/deposit'
import {
    genIdentity,
    genIdentityCommitment,
} from 'libsemaphore'

import {
    mixAmtEth,
    operatorFeeEth,
    mixAmtTokens,
    operatorFeeTokens,
} from '../utils/mixAmts'

const tokenSym = config.tokenSym
const blockExplorerTxPrefix = config.frontend.blockExplorerTxPrefix

const name = 'MicroMix'

const topUpEthMsg =
    <div className="column is-8 is-offset-2">
        <p>
            Please top up your account with at least 0.11
            KETH (0.1 to deposit and 0.01 for gas). You can get KETH
            from a faucet <a target="_blank" 
            href="https://faucet.kovan.network/">here</a> or <a 
            target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
        </p>
    </div>

const topUpDaiMsg =
    <div className="column is-8 is-offset-2">
        <p>
            Please top up your account with at least {mixAmtTokens.toString()} DAI 
            and 0.01 KETH for gas. You can convert KETH to DAI <a
            href="https://cdp.makerdao.com" target="_blank">here</a>, and you can get KETH
            from a faucet <a target="_blank" href="https://faucet.kovan.network/">here</a> or <a target="_blank" href="https://gitter.im/kovan-testnet/faucet">here</a>.
        </p>
    </div>

export default () => {
    const [storageHasBeenInit, setStorageHasBeenInit] = useState(false)
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [erc20ApproveTxStatus, setErc20ApproveTxStatus] = useState(TxStatuses.None)
    const [txHash, setTxHash] = useState('')
    const [recipientAddress, setRecipientAddress] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [enoughEth, setEnoughEth] = useState(true)
    const [enoughEthAndDai, setEnoughEthAndDai] = useState(false)
    const [tokenType, setTokenType] = useState('ETH')
    const [tokenAllowanceNeeded, setTokenAllowanceNeeded] = useState(-1)

    if (!storageHasBeenInit) {
        initStorage()
        setStorageHasBeenInit(true)
    }

    const isEth = tokenType === 'ETH'

    // The operator's fee is equal to the burn fee by default but this isn't
    // enforced by the contract
    let mixAmt: string
    if (isEth) {
        mixAmt = mixAmtEth.toString()
    } else {
        mixAmt = mixAmtTokens.toString()
    }

    const validRecipientAddress= recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)
    const depositBtnDisabled = !validRecipientAddress

    // Check whether there already is a deposit and disallow the user
    // from making another one
    // Redirect the user to the withdraw page if so

    if (getNumUnwithdrawn() > 0) {
          return <Redirect to='/countdown' />
    }

    const context = useWeb3Context()

    const handleTokenApproveBtnClick = async () => {
        setErc20ApproveTxStatus(TxStatuses.Pending)

        const tx = await approveTokens(context, tokenAllowanceNeeded * (10 ** config.tokenDecimals))
        await tx.wait()
        setErc20ApproveTxStatus(TxStatuses.Mined)
    }

    const handleDepositBtnClick = async () => {
        if (!validRecipientAddress) {
            return
        }

        initStorage()

        // generate an Identity and identity commitment
        const identity = genIdentity()
        const identityCommitment = '0x' + genIdentityCommitment(identity).toString(16)

        // Perform the deposit tx
        try {
            setTxStatus(TxStatuses.Pending)

            let tx
            if (isEth) {
                tx = await depositEth(
                    context,
                    identityCommitment,
                    ethers.utils.parseEther(mixAmt),
                )
            } else {
                tx = await depositTokens(
                    context,
                    identityCommitment,
                )
            }

            setTxHash(tx.hash)

            storeDeposit(identity, recipientAddress, tokenType)

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

    const checkBalances = async () => {
        if (mixAmt && context.connector && context.account) {
            const balance = await getBalance(context)
            const minAmt = isEth && mixAmt ? parseFloat(mixAmt) + 0.01 : 0.01
            let enoughEth
            if (balance) {
                enoughEth = balance.gte(ethers.utils.parseEther(minAmt.toString()))
                setEnoughEth(enoughEth)
            }

            if (tokenType === 'DAI') {
                const daiBalance = await getTokenBalance(context)
                const enoughDai = daiBalance >= minAmt
                setEnoughEthAndDai(enoughEth && enoughDai)
            }
        }
    }

    const mixEthInfo = (
        <div>
            <p>
                {`The fee is ${operatorFeeEth} ETH.`}
            </p>
            <p>
                {`The recipient will receive ${mixAmtEth - operatorFeeEth} ETH after midnight, UTC.`}
            </p>
        </div>
    )

    const mixTokensInfo = (
        <div>
            <p>
                {`The fee is ${operatorFeeTokens} ${tokenSym}.`}
            </p>
            <p>
                {`The recipient will receive ${mixAmtTokens - operatorFeeTokens} ${tokenSym} after midnight, UTC.`}
            </p>
        </div>
    )

    const checkTokenAllowance = async () => {
        if (mixAmtTokens && context.connector) {
            const mixAmtTokensFull = mixAmtTokens * 10 ** config.tokenDecimals
            const allowance = await getTokenAllowance(context)

            let x = mixAmtTokensFull - allowance
            if (x < 0) {
                x = 0
            }
            setTokenAllowanceNeeded(x / (10 ** config.tokenDecimals))
        }
    }

    const tokenAllowanceBtn = (
        <div>
            <br />
            <Erc20ApproveButton
                onClick={handleTokenApproveBtnClick}
                txStatus={erc20ApproveTxStatus}
                isDisabled={false}
                label= {`To continue, approve ${tokenAllowanceNeeded} ${tokenType}`}
            />
            <br />
        </div>
    )

    const showMixForm = context.error == null &&
        (
            (!isEth && tokenAllowanceNeeded === 0 && enoughEthAndDai) ||
            (isEth && enoughEth)
        )

    const handleTokenTypeSelect = (e) => {
        const t = e.target.value
        setTokenType(t)
    }

    checkBalances()
    checkTokenAllowance()

    return (
        <div className='columns has-text-centered'>
            <div className='column is-12'>
                <div className='section first-section'>
                    <h2 className='subtitle'>
                        {name} makes your ETH or DAI anonymous.
                        Learn more <a href="https://github.com/weijiekoh/mixer"
                        target="_blank">here</a>.
                    </h2>

                    <div className='sendTo column is-12'>
                        <span>Send</span>
                        <div className="control token-select">
                            <div className="select is-primary">
                                <select 
                                    value={tokenType}
                                    id="token"
                                    onChange={handleTokenTypeSelect}
                                >
                                    <option value="ETH">{mixAmtEth.toString()} ETH</option>
                                    <option value="DAI">{mixAmtTokens.toString()} DAI</option>
                                </select>
                            </div>
                        </div>
                        <span>to</span>
                    </div>

                    { showMixForm &&
                        <div className='column is-8 is-offset-2'>
                            <input
                                spellCheck={false}
                                className="input eth_address"
                                type="text"
                                placeholder="0x........" 
                                value={recipientAddress}
                                onChange={(e) => {
                                    setRecipientAddress(e.target.value)
                                }}
                            />

                            <br />

                        </div>
                    }

                    { (context.error != null && context.error['code'] === 'UNSUPPORTED_NETWORK') ?
                        <p>
                            Please connect to
                            the {config.frontend.supportedNetworkName} Ethereum
                            network.
                        </p>
                        :
                        <div className='column is-12'>
                            { isEth && mixEthInfo }
                            { !isEth && mixTokensInfo }

                            { isEth && !enoughEth && topUpEthMsg }
                            { !isEth && !enoughEthAndDai && topUpDaiMsg }

                            { !isEth && enoughEthAndDai && tokenAllowanceNeeded > 0 && tokenAllowanceBtn }
                        </div>
                    }

                </div>

                { showMixForm &&
                    <div className='column is-12'>
                        <TxButton
                            onClick={handleDepositBtnClick}
                            txStatus={txStatus}
                            isDisabled={depositBtnDisabled}
                            label={`Mix ${mixAmt} ${tokenType}`}
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
                            
                        { txStatus === TxStatuses.Mined &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Transaction mined.
                                </div>
                                <Redirect to='/countdown' />
                            </article>
                        }

                        { txStatus === TxStatuses.Err &&
                            <div>
                                <br />
                                <article className="message is-danger">
                                    <div className="message-body">
                                        {errorMsg}
                                    </div>
                                </article>
                            </div>
                        }
                    </div>
                }
                <div className='column is-4 is-offset-4 is-10-mobile is-offset-1-mobile'>
                    <img src={cat} />
                </div>
            </div>
        </div>
    )
}
