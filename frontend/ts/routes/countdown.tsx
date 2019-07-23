import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'
import { useTimer } from 'react-timer-hook'
import * as ethers from 'ethers'
import { useWeb3Context } from 'web3-react'
import { Redirect } from 'react-router-dom'
import { getMixerContract } from '../web3/mixer'
import { genMixParams, sleep } from 'mixer-utils'
import { 
    genMsg,
    signMsg,
    genPubKey,
    genTree,
    genWitness,
    genCircuit,
    genPathElementsAndIndex,
    genIdentityCommitment,
    genSignalAndSignalHash,
    genPublicSignals,
    verifySignature,
    unstringifyBigInts,
    extractWitnessRoot,
    genProof,
    verifyProof,
} from 'mixer-crypto'

import {
    getItems,
    getNumItems,
    updateWithdrawTxHash,
    getNumUnwithdrawn,
    getFirstUnwithdrawn,
} from '../storage'

import { ErrorCodes } from '../errors'

import {
    mixAmtEth,
    operatorFeeEth,
    feeAmtWei,
} from '../utils/ethAmts'

const config = require('../exported_config')

const blockExplorerTxPrefix = config.frontend.blockExplorerTxPrefix
const endsAtMidnight = config.frontend.countdown.endsAtUtcMidnight
const endsAfterSecs = config.frontend.countdown.endsAfterSecs

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default () => {
    if (getNumUnwithdrawn() === 0) {
        return <Redirect to='/' />
    }

    const [txHash, setTxHash] = useState('')
    const [firstLoadTime, setFirstLoadTime] = useState(new Date())
    const [withdrawStarted, setWithdrawStarted] = useState(false)
    const [countdownDone, setCountdownDone] = useState(false)
    const [proofGenProgress, setProofGenProgress] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [withdrawBtnClicked, setWithdrawBtnClicked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const progress = (line: string) => {
        setProofGenProgress(line)
    }

    const identityStored = getFirstUnwithdrawn()
    const recipientAddress = identityStored.recipientAddress

    const context = useWeb3Context()

    const withdraw = async (context) => {
        if (!context.connector) {
            return
        }
        const provider = new ethers.providers.Web3Provider(
            await context.connector.getProvider(config.chain.chainId),
        )

        const recipientBalanceBefore = await provider.getBalance(recipientAddress)
        console.log('The recipient has', ethers.utils.formatEther(recipientBalanceBefore), 'ETH')

        const mixerContract = await getMixerContract(context)

        const broadcasterAddress = mixerContract.address
        const externalNullifier = mixerContract.address

        progress('Downloading leaves...')

        const leaves = await mixerContract.getLeaves()

        const tree = await genTree(leaves)

        const pubKey = genPubKey(identityStored.privKey)

        const identityCommitment = genIdentityCommitment(
            identityStored.identityNullifier,
            pubKey,
        )

        const { identityPathElements, identityPathIndex } = await genPathElementsAndIndex(
            tree,
            identityCommitment,
        )

        const { signalHash, signal } = genSignalAndSignalHash(
            recipientAddress, broadcasterAddress, feeAmtWei,
        )

        const msg = genMsg(
            externalNullifier,
            signalHash, 
            broadcasterAddress,
        )

        const signature = signMsg(identityStored.privKey, msg)
        const validSig = verifySignature(msg, signature, pubKey)
        if (!validSig) {
            throw {
                code: ErrorCodes.INVALID_SIG,
            }
        }

        progress('Downloading circuit...')
        const cirDef = await (await fetch(config.frontend.snarks.paths.circuit)).json()
        const circuit = genCircuit(cirDef)

        let w
        try {
            w = genWitness(
                circuit,
                pubKey,
                signature,
                signalHash,
                externalNullifier,
                identityStored.identityNullifier,
                identityPathElements,
                identityPathIndex,
                broadcasterAddress,
            )
        } catch (err) {
            setErrorMsg('Error: could not calculate witness')
        }

        const witnessRoot = extractWitnessRoot(circuit, w)

        if (!circuit.checkWitness(w)) {
            throw {
                code: ErrorCodes.INVALID_WITNESS,
            }
        }

        progress('Downloading proving key...')
        const provingKey = new Uint8Array(
            await (await fetch(config.frontend.snarks.paths.provingKey)).arrayBuffer()
        )

        progress('Downloading verification key...')
        const verifyingKey = unstringifyBigInts(
            await (await fetch(config.frontend.snarks.paths.verificationKey)).json()
        )

        progress('Generating proof...')
        const proof = await genProof(w, provingKey.buffer)

        const publicSignals = genPublicSignals(w, circuit)

        const isVerified = verifyProof(verifyingKey, proof, publicSignals)

        if (!isVerified) {
            throw {
                code: ErrorCodes.INVALID_PROOF,
            }
        }

        const params = genMixParams(
            signal,
            proof,
            recipientAddress,
            BigInt(feeAmtWei.toString()),
            publicSignals,
        )

        const request = {
            jsonrpc: '2.0',
            id: (new Date()).getTime(),
            method: 'mixer_mix',
            params,
        }

        progress('Sending JSON-RPC call to the relayer...')
        console.log(request)

        const response = await fetch(
            '/api',
            {
                method: 'POST',
                body: JSON.stringify(request),
                headers: {
                    'Content-Type': 'application/json',
                }
            },
        )

        const responseJson = await response.json()
        if (responseJson.result) {
            progress('')
            setTxHash(responseJson.result.txHash)
            console.log(responseJson.result.txHash)
            updateWithdrawTxHash(identityStored, responseJson.result.txHash)

            await sleep(4000)

            const recipientBalanceAfter = await provider.getBalance(recipientAddress)
            console.log('The recipient now has', ethers.utils.formatEther(recipientBalanceAfter), 'ETH')
        } else {
            setErrorMsg('Error: ' + responseJson.error.message)
            throw responseJson.error
        }
    }
    
    let expiryTimestamp = new Date(identityStored.timestamp)
    expiryTimestamp.setUTCHours(0, 0, 0, 0)
    expiryTimestamp.setDate(expiryTimestamp.getDate() + 1)


    // Whether the current time is greater than the expiry timestamp (i.e.
    // UTC midnight 
    const midnightOver = firstLoadTime > expiryTimestamp

    // Dev only
    if (!endsAtMidnight && !midnightOver) {
        expiryTimestamp = new Date()
        expiryTimestamp.setSeconds(
            expiryTimestamp.getSeconds() + endsAfterSecs
        )
    }

    const timeStr = `${expiryTimestamp.getDate()} ${months[expiryTimestamp.getMonth()]} ` +
        `${expiryTimestamp.getFullYear()}, ${expiryTimestamp.toLocaleTimeString()}`

    const timer = useTimer({
        expiryTimestamp,
        onExpire: () => {
            if (!countdownDone) {
                setCountdownDone(true)
            }
        }
    })

    if (!withdrawStarted &&
        countdownDone &&
        context &&
        !midnightOver &&
        timer.days + timer.hours + timer.minutes + timer.seconds === 0
    ) {
        setWithdrawStarted(true)
        withdraw(context)
    }

    const withdrawBtn = (
        <span
            onClick={() => {
                setWithdrawBtnClicked(true)
                if (showAdvanced) {
                    setShowAdvanced(false)
                }
                if (!withdrawStarted) {
                    setWithdrawStarted(true)
                    withdraw(context)
                }
            }}
            className='button is-warning'>
            Mix {mixAmtEth} ETH now
        </span>
    )

    return (
        <div className='section first-section'>
            <div className='columns has-text-centered'>
                <div className='column is-8 is-offset-2'>
                    <div className='section'>
                        <h2 className='subtitle'>
                            The address:
                            <br />
                            <br />
                            <pre>
                                {recipientAddress} 
                            </pre>
                            <br />
                            can receive {mixAmtEth - operatorFeeEth * 2} ETH 
                            { countdownDone || midnightOver || withdrawBtnClicked ?
                                <span>
                                    { (txHash.length === 0 && midnightOver) ?
                                        <span>.</span>
                                        :
                                        <span>
                                            {' '} soon.
                                        </span>
                                    }
                                  { proofGenProgress.length > 0 && 
                                      <div className="has-text-left">
                                          <br />
                                          <pre>
                                              {proofGenProgress}
                                          </pre>
                                      </div>
                                  }
                                </span>
                                :
                                <span>
                                    {' '} shortly after { timeStr } local time.
                                </span>
                            }
                        </h2>

                        { txHash.length === 0 && midnightOver && !withdrawStarted &&
                            withdrawBtn
                        }

                        { txHash.length > 0 &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Mix successful. <a
                                        href={blockExplorerTxPrefix + txHash}
                                        target="_blank">View on Etherscan.
                                    </a>
                                </div>
                            </article>
                        }

                    </div>
                </div>

            </div>

            { errorMsg.length > 0 &&
                <article className="message is-danger">
                    <div className="message-body">
                        {errorMsg}
                    </div>
                </article>
            }


            { !(txHash.length === 0 && midnightOver) &&
                <div className='columns'>
                    <div className='column is-6 is-offset-3'>
                        <p>
                            To mix your funds with optimal anonymity, leave
                            this page open till after midnight UTC.
                            For example, if you deposit your funds at 3pm UTC
                            on 1 Jan, this page will wait till midnight 2 Jan
                            UTC to mix the funds.
                            If you close this page, you can reopen it any
                            time, and withdraw it at a click of a button, even
                            after midnight UTC.
                        </p>
                    </div>

                </div>
            }

            <br />

            { !(txHash.length === 0 && midnightOver && !withdrawStarted) &&
                !withdrawBtnClicked &&
                !withdrawStarted &&
                <div>
                    <div className="columns has-text-centered">
                        <div className='column is-12'>
                                <h2 className='subtitle'>
                                    {timer.hours}h {timer.minutes}m {timer.seconds}s left
                                </h2>
                            <h2 className='subtitle'>
                                Please keep this tab open.
                            </h2>
                        </div>
                    </div>

                    <div className="columns has-text-centered">
                        <div className='column is-12'>
                            <p className='subtitle advanced' onClick={
                                () => {
                                    setShowAdvanced(!showAdvanced)
                                }
                            }>
                                Advanced options 
                                <span 
                                    className={
                                        showAdvanced ? "chevron-up" : "chevron-down"
                                    }>
                                </span>
                            </p>

                            { showAdvanced &&
                                <article className="message is-info">
                                    <div className="message-body">
                                        <p>
                                            If you'd like, you may request to
                                            mix your funds now. Note that if
                                            you so now, may not have as much
                                            anonymity than if you were to wait
                                            till after midnight UTC or later.
                                        </p>
                                    </div>

                                    {withdrawBtn}

                                    <br />
                                    <br />
                                </article>
                            }
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}

