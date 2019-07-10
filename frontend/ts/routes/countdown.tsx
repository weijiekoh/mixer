import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'
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
const isDev = config.env === 'local-dev'

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default () => {
    if (getNumUnwithdrawn() === 0) {
        return <Redirect to='/' />
    }

    const [txHash, setTxHash] = useState('')

    const identityStored = getFirstUnwithdrawn()
    const recipientAddress = identityStored.recipientAddress

    const context = useWeb3Context()

    const withdraw = async () => {
        const provider = new ethers.providers.Web3Provider(
            await context.connector.getProvider(config.chain.chainId),
        )

        const recipientBalanceBefore = await provider.getBalance(recipientAddress)
        console.log('The recipient has', ethers.utils.formatEther(recipientBalanceBefore), 'ETH')

        const mixerContract = await getMixerContract(context)

        const broadcasterAddress = mixerContract.address
        const externalNullifier = mixerContract.address

        console.log('Downloading leaves...')

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

        console.log('Downloading circuit...')
        const cirDef = await (await fetch('/build/circuit.json')).json()
        const circuit = genCircuit(cirDef)

        const w = genWitness(
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

        const witnessRoot = extractWitnessRoot(circuit, w)

        if (!circuit.checkWitness(w)) {
            throw {
                code: ErrorCodes.INVALID_WITNESS,
            }
        }

        console.log('Downloading proving key...')
        const provingKey = new Uint8Array(
            await (await fetch('/build/proving_key.bin')).arrayBuffer()
        )

        console.log('Downloading verification key...')
        const verifyingKey = unstringifyBigInts(
            await (await fetch('/build/verification_key.json')).json()
        )

        console.log('Generating proof...')
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

        console.log('Sending JSON-RPC call to the relayer...')
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
            setTxHash(responseJson.result.txHash)
            console.log(responseJson.result.txHash)
            updateWithdrawTxHash(identityStored, responseJson.result.txHash)

            await sleep(4000)

            const recipientBalanceAfter = await provider.getBalance(recipientAddress)
        console.log('The recipient now has', ethers.utils.formatEther(recipientBalanceAfter), 'ETH')
        } else {
            throw responseJson.error
        }
    }
    
    const utcMidnight = new Date()
    utcMidnight.setUTCHours(0, 0, 0, 0)
    utcMidnight.setDate(utcMidnight.getDate() + 1)

    const [currentTime, setCurrentTime] = useState(new Date())

    // update the clock every `interval` ms
    const interval = 5000
    setTimeout(function update(){
        const time = new Date()
        setCurrentTime(time)
        setTimeout(update, interval)
    }, interval)

    const secsLeft = Math.floor((utcMidnight.getTime() - currentTime.getTime()) / 1000)
    const secsMod = secsLeft % 60

    const hoursMod = Math.floor(secsLeft / 3600)
    const minsMod = Math.floor((secsLeft - (hoursMod * 3600))/ 60)

    const timeStr = `${utcMidnight.getDate()} ${months[utcMidnight.getMonth()]} ${utcMidnight.getFullYear()}, ${utcMidnight.toLocaleTimeString()}`

    return (
        <div className='section'>

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
                            will receive {mixAmtEth - operatorFeeEth * 2} ETH shortly
                            after { timeStr }.
                        </h2>

                        { isDev && txHash.length === 0 &&
                            <span
                                onClick={withdraw}
                                className='button is-warning'>
                                Dev only: tell the relayer to withdraw now
                            </span>
                        }

                        { isDev && txHash.length > 0 &&
                            <article className="message is-success">
                                <div className="message-body">
                                    Withdrawal successful. <a
                                        href={"https://etherscan.io/tx/" + txHash}
                                        target="_blank">View on Etherscan.
                                    </a>
                                </div>
                            </article>
                        }

                    </div>
                </div>
            </div>

            <div className='columns'>
                <div className='column is-3 is-offset-3'>
                    <p>
                        To maximise anonymity, we only allow users to
                        submit mix requests after midnight UTC.
                        For example, if you deposit your funds at 3pm UTC
                        on 1 Jan, this page will wait till midnight 2 Jan
                        UTC to mix the funds.
                    </p>
                </div>

                <div className='column is-3 is-offset-1'>
                    <p>
                        Please keep this tab open to automatically mix the
                        funds. If you close this tab, you can reopen it any
                        time, and withdraw it at a click of a button, even
                        after midnight UTC.
                    </p>
                </div>

            </div>

            <br />

            <div className="columns has-text-centered">
                <div className='column is-12'>
                        <h2 className='subtitle'>
                            {hoursMod}h {minsMod}m {secsMod}s left
                        </h2>
                    <h2 className='subtitle'>
                        Please keep this tab open.
                    </h2>
                </div>
            </div>
        </div>
    )
}

