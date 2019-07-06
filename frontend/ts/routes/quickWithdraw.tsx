import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'
import { useWeb3Context } from 'web3-react'
import * as snarkjs from 'snarkjs'
import * as ethers from 'ethers'
import { utils } from 'mixer-contracts'
const config = require('../exported_config')
import { TxButton, TxStatuses } from '../components/txButton'
import { quickWithdraw } from '../web3/quickWithdraw'
import { getMixerContract, getSemaphoreContract } from '../web3/mixer'
const deployedAddresses = require('../deployedAddresses.json')
import { 
    genMsg,
    signMsg,
    genPubKey,
    setupTree,
    genWitness,
    genIdentityCommitment,
    genSignalAndSignalHash,
    genPublicSignals,
    verifySignature,
    unstringifyBigInts,
    extractWitnessRoot,
    genProof,
    verifyProof,
} from 'mixer-crypto'

enum ErrorCodes {
    INVALID_WITNESS,
    INVALID_PROOF,
    INVALID_SIG,
    TX_FAILED,
}

import {
    getItems,
    updateWithdrawTxHash,
} from '../storage'

const mixAmtEth = config.mixAmtEth
const operatorFeeEth = config.operatorFeeEth

const noItems = (
    <div className='section'>
        <div className='columns has-text-centered'>
            <div className='column is-8 is-offset-2'>
                <h2 className='subtitle'>
                    Nothing to withdraw. To get started,
                    please <a href='/'>make a deposit</a>.
                </h2>
            </div>
        </div>
    </div>
)

export default () => {
    const items = getItems()
    if (items.length == 0) {
        return noItems
    }

    const [proofGenProgress, setProofGenProgress] = useState('')
    const [completedWithdraw, setCompletedWithdraw] = useState(false)
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [consentChecked, setConsentChecked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const context = useWeb3Context()
    let withdrawBtnDisabled = !consentChecked

    const progress = (line: string) => {
        setProofGenProgress(line)
    }

    const identityStored = items[items.length - 1]

    let withdrawTxHash = identityStored.withdrawTxHash

    const recipientAddress = identityStored.recipientAddress

    const handleWithdrawBtnClick = async () => {

        if (!consentChecked) {
            return
        }

        const library = context.library
        const connector = context.connector

        if (!library || !connector) {
            return
        }

        try {
            const feeAmt = ethers.utils.parseEther(
                (parseFloat(operatorFeeEth) * 2).toString()
            )
            const mixerContract = await getMixerContract(context)

            const broadcasterAddress = mixerContract.address
            const externalNullifier = mixerContract.address
            progress('Downloading leaves...')
            const leaves = await mixerContract.getLeaves()

            const tree = setupTree()

            for (let i=0; i<leaves.length; i++) {
                await tree.update(i, leaves[i].toString())
            }

            const pubKey = genPubKey(identityStored.privKey)

            const identityCommitment = genIdentityCommitment(
                identityStored.identityNullifier,
                pubKey,
            )

            const leafIndex = await tree.element_index(identityCommitment)

            const identityPath = await tree.path(leafIndex)
            const identityPathElements = identityPath.path_elements
            const identityPathIndex = identityPath.path_index

            const { signalHash, signal } = genSignalAndSignalHash(
                recipientAddress, broadcasterAddress, feeAmt,
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

            const cirDef = await (await fetch('/build/circuit.json')).json()
            const circuit = new snarkjs.Circuit(cirDef)

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

            progress('Downloading proving key...')

            const provingKey = new Uint8Array(
                await (await fetch('/build/proving_key.bin')).arrayBuffer()
            )
            

            progress('Downloading verifying key')

            const verifyingKey = unstringifyBigInts(
                await (await fetch('/build/verification_key.json')).json()
            )

            progress('Generating proof')
            const proof = await genProof(w, provingKey.buffer)

            const publicSignals = genPublicSignals(w, circuit)

            const isVerified = verifyProof(verifyingKey, proof, publicSignals)

            if (!isVerified) {
                throw {
                    code: ErrorCodes.INVALID_PROOF,
                }
            }

            progress('Executing transaction')

            const tx = await quickWithdraw(
                context,
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmt
            )

            const receipt = await tx.wait()
            if (receipt.status === 1) {
                updateWithdrawTxHash(identityStored, tx.hash)
                setCompletedWithdraw(true)
            } else {
                throw {
                    code: ErrorCodes.TX_FAILED,
                }
            }
            setProofGenProgress('')


        } catch (err) {
            console.error(err)
            setTxStatus(TxStatuses.Err)

            if (
                err.code === ethers.errors.UNSUPPORTED_OPERATION &&
                err.reason === 'contract not deployed'
            ) {
                setErrorMsg(`The mixer contract was not deployed to the expected address ${deployedAddresses.Mixer}`)
            } else if (err.code === ErrorCodes.INVALID_WITNESS) {
                setErrorMsg('Invalid witness.')
            } else if (err.code === ErrorCodes.INVALID_PROOF) {
                setErrorMsg('Invalid proof.')
            } else if (err.code === ErrorCodes.INVALID_SIG) {
                setErrorMsg('Invalid signature.')
            } else if (err.code === ErrorCodes.TX_FAILED) {
                setErrorMsg('The transaction failed.')
            }

        }
    }

    //const handle = () => {
        //updateWithdrawTxHash(identityStored, '0xabc')
        //setCompletedWithdraw(true)
    //}

    return (
        <div className='section'>
            <div className='columns has-text-centered'>
              { (!withdrawTxHash && !completedWithdraw) &&
                  <div className='column is-8 is-offset-2'>
                      <div className='section'>
                          <h2 className='subtitle'>
                              You can immediately withdraw { mixAmtEth - operatorFeeEth * 2 } ETH to
                              <pre>
                                  {recipientAddress} 
                              </pre>
                          </h2>
                      </div>

                    <div className='section'>
                          <label className="checkbox">
                              <input 
                                  onChange={() => {
                                      setConsentChecked(!consentChecked)
                                  }}
                                  type="checkbox" className="consent_checkbox" />
                              I understand that this transaction won't be private
                              as it will link your deposit address to the
                              receiver's address.
                         </label>

                          <br />
                          <br />

                          <TxButton
                              onClick={handleWithdrawBtnClick}
                              txStatus={txStatus}
                              isDisabled={withdrawBtnDisabled}
                              label={`Withdraw ${mixAmtEth - operatorFeeEth * 2} ETH`}
                          />
                          <br />
                          <br />

                          { txStatus === TxStatuses.Err &&
                              <article className="message is-danger">
                                <div className="message-body">
                                  {errorMsg}
                                </div>
                            </article>
                          }

                          { proofGenProgress.length > 0 && 
                              <div className="has-text-left">
                                  <br />
                                  <pre>
                                      {proofGenProgress}
                                  </pre>
                              </div>
                          }
                       </div>
                   </div>
               }

               { withdrawTxHash &&
                    <div className='column is-8 is-offset-2'>
                        <article className="message is-success">
                            <div className="message-body">
                                Withdrawal successful. <a
                                    href={"https://etherscan.io/tx/" + withdrawTxHash}
                                    target="_blank">View on Etherscan.
                                </a>
                            </div>
                        </article>
                        <a href='/'>Make another deposit</a>.
                   </div>
               }
            </div>
        </div>
    )
}
