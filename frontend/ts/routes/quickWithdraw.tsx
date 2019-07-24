import React, { Component, useState } from 'react'
import ReactDOM from 'react-dom'
import { useWeb3Context } from 'web3-react'
import * as snarkjs from 'snarkjs'
import * as ethers from 'ethers'
import { utils } from 'mixer-contracts'
import { sleep } from 'mixer-utils'
const config = require('../exported_config')
import { TxButton, TxStatuses } from '../components/txButton'
import { TxHashMessage } from '../components/txHashMessage'
import { quickWithdraw } from '../web3/quickWithdraw'
import { getMixerContract, getSemaphoreContract } from '../web3/mixer'
const deployedAddresses = config.chain.deployedAddresses

import { 
    genMsg,
    signMsg,
    genSignedMsg,
    genPubKey,
    genTree,
    genCircuit,
    genWitness,
    genIdentityCommitment,
    genPathElementsAndIndex,
    genSignalAndSignalHash,
    genPublicSignals,
    verifySignature,
    unstringifyBigInts,
    extractWitnessRoot,
    genProof,
    verifyProof,
} from 'mixer-crypto'

import { ErrorCodes } from '../errors'

import {
    getItems,
    updateWithdrawTxHash,
} from '../storage'

import {
    mixAmtEth,
    operatorFeeEth,
    feeAmtWei,
} from '../utils/ethAmts'

const blockExplorerTxPrefix = config.frontend.blockExplorerTxPrefix

const noItemsCol = (
    <div className='column is-8 is-offset-2'>
        <h2 className='subtitle'>
            Nothing to withdraw. To get started,
            please <a href='/'>make a deposit</a>.
        </h2>
    </div>
)

const noItems = (
    <div className='section'>
        <div className='columns has-text-centered'>
            {noItemsCol}
        </div>
    </div>
)

export default () => {
    const items = getItems()
    if (items.length == 0) {
        return noItems
    }

    const [proofGenProgress, setProofGenProgress] = useState('')
    const [pendingTxHash, setPendingTxHash] = useState('')
    const [completedWithdraw, setCompletedWithdraw] = useState(false)
    const [txStatus, setTxStatus] = useState(TxStatuses.None)
    const [consentChecked, setConsentChecked] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const context = useWeb3Context()
    let withdrawBtnDisabled = !consentChecked

    const progress = (line: string) => {
        setProofGenProgress(line)
    }

    // Just use the last stored item
    const identityStored = items[items.length - 1]

    const withdrawTxHash = identityStored.withdrawTxHash
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

            const { signature, msg } = genSignedMsg(
                identityStored.privKey,
                externalNullifier,
                signalHash, 
                broadcasterAddress,
            )

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
                throw {
                    code: ErrorCodes.WITNESS_GEN_ERROR,
                }
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

            progress('Downloading verifying key')

            const verifyingKey = unstringifyBigInts(
                await (await fetch(config.frontend.snarks.paths.verificationKey)).json()
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

            progress('Performing transaction')

            const tx = await quickWithdraw(
                context,
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmtWei,
            )

            setPendingTxHash(tx.hash)
            setProofGenProgress('')

            if (config.env === 'local-dev') {
                await sleep(3000)
            }

            const receipt = await tx.wait()

            if (receipt.status === 1) {
                updateWithdrawTxHash(identityStored, tx.hash)
                setCompletedWithdraw(true)
            } else {
                throw {
                    code: ErrorCodes.TX_FAILED,
                }
            }

        } catch (err) {
            console.error(err)
            setTxStatus(TxStatuses.Err)

            if (
                err.code === ethers.errors.UNSUPPORTED_OPERATION &&
                err.reason === 'contract not deployed'
            ) {
                setErrorMsg(`The mixer contract was not deployed to the expected address ${deployedAddresses.Mixer}`)
            } else if (err.code === ErrorCodes.WITNESS_GEN_ERROR) {
                setErrorMsg('Could not generate witness.')
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

    return (
        <div className='section first-section'>
            <div className='columns has-text-centered'>
              { (!withdrawTxHash && !completedWithdraw) &&
                  <div className='column is-8 is-offset-2'>
                      <div className='section'>
                          <h2 className='subtitle'>
                              You can immediately withdraw { mixAmtEth - operatorFeeEth * 2 } ETH to
                              <br />
                              <br />
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
                              I understand that this transaction will not be
                              private as it will link your deposit address to
                              the receiver's address.
                         </label>

                          <br />
                          <br />

                          <TxButton
                              onClick={handleWithdrawBtnClick}
                              txStatus={txStatus}
                              isDisabled={withdrawBtnDisabled}
                              label={`Withdraw ${mixAmtEth - operatorFeeEth * 2} ETH`}
                          />

                          { pendingTxHash.length > 0 &&
                              <div>
                                  <br />
                                  <TxHashMessage 
                                      mixSuccessful={false}
                                      txHash={pendingTxHash}
                                      txStatus={TxStatuses.Pending} />
                              </div>
                          }

                          <br />
                          <br />

                          { proofGenProgress.length > 0 && 
                              <div className="has-text-left">
                                  <br />
                                  <pre>
                                      {proofGenProgress}
                                  </pre>
                              </div>
                          }

                          <br />
                          <br />

                          { txStatus === TxStatuses.Err &&
                              <article className="message is-danger">
                                  <div className="message-body">
                                      {'Error: ' + errorMsg}
                                  </div>
                              </article>
                          }

                       </div>
                   </div>
               }

               { withdrawTxHash && completedWithdraw &&
                    <div className='column is-8 is-offset-2'>
                        <TxHashMessage 
                            mixSuccessful={true}
                            txHash={withdrawTxHash}
                            txStatus={TxStatuses.Mined} />
                        <a href='/'>Make another deposit</a>.
                   </div>
               }

               { withdrawTxHash && !completedWithdraw &&
                   noItemsCol
               }
            </div>
        </div>
    )
}
