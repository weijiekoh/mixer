require('module-alias/register')
// Make Typescript happy
declare var assert: any
declare var before: any
require('events').EventEmitter.defaultMaxListeners = 0

const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as ethers from 'ethers'

import { config } from 'mixer-config'
import {
    mix,
    genDepositProof,
    areEqualAddresses,
    getSnarks,
} from './utils'

import { sleep } from 'mixer-utils'
import {
    genIdentity,
    genIdentityCommitment,
    genMixerWitness,
    genProof,
    verifyProof,
    verifySignature,
    genPublicSignals,
} from 'libsemaphore'

import { genAccounts } from '../accounts'
import buildMiMC from '../buildMiMC'
const Mixer = require('@mixer-contracts/compiled/Mixer.json')

import {
    deployAllContracts,
} from '../deploy/deploy'

const accounts = genAccounts()
const recipientAddress = accounts[1].address
let relayerAddress = accounts[2].address

const mixAmtWei = ethers.utils.parseEther(config.get('mixAmtEth')).toString()
const mixAmtTokens = ethers.utils.bigNumberify(config.get('mixAmtTokens').toString())
const feeAmt = ethers.utils.parseEther(
    (parseFloat(config.get('feeAmtEth'))).toString()
)

const users = accounts.slice(1, 6).map((user) => user.address)
const identities = {}

const contractsPath = path.join(
    __dirname,
    '../..',
    'compiled',
)

for (let i=0; i < users.length; i++) {
    const user = users[i]

    const identity = genIdentity()

    identities[user] = identity
}

let mimcContract
let mixerContract
let semaphoreContract
let relayerRegistryContract
let externalNullifier : string

describe('Mixer', () => {

    const deployer = new etherlime.JSONRPCPrivateKeyDeployer(
        accounts[0].privateKey,
        config.get('chain.url'),
        {
            chainId: config.get('chain.chainId'),
        },
    )
    deployer.defaultOverrides = { gasLimit: 8800000 }
    deployer.setSigner(accounts[0])

    before(async () => {
        await buildMiMC()

        const contracts = await deployAllContracts(
            deployer,
            mixAmtWei,
            mixAmtTokens,
            accounts[0].address,
        )
        mimcContract = contracts.mimcContract
        semaphoreContract = contracts.semaphoreContract
        mixerContract = contracts.mixerContract
        relayerRegistryContract = contracts.relayerRegistryContract
    })

    describe('Contract deployments', () => {

        it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
            assert.revert(
                deployer.deploy(
                    Mixer,
                    {},
                    '0x0000000000000000000000000000000000000000',
                    mixAmtWei,
                    '0x0000000000000000000000000000000000000000',
                )
            )
            await sleep(1000)
        })

        it('should not deploy Mixer if the mixAmt is invalid', async () => {
            assert.revert(
                deployer.deploy(
                    Mixer,
                    {},
                    semaphoreContract.contractAddress,
                    ethers.utils.parseEther('0'),
                    '0x0000000000000000000000000000000000000000',
                )
            )
            await sleep(1000)
        })

        it('should deploy contracts', () => {
            assert.notEqual(
                mimcContract._contract.bytecode,
                '0x',
                'the contract bytecode should not just be 0x'
            )

            assert.isAddress(mimcContract.contractAddress)
            assert.isAddress(semaphoreContract.contractAddress)
            assert.isAddress(mixerContract.contractAddress)

            // the external nullifier is the hash of the contract's address
            externalNullifier = mixerContract.contractAddress
        })

        it('the Mixer contract should be the owner of the Semaphore contract', async () => {
            assert.equal((await semaphoreContract.owner()), mixerContract.contractAddress)
        })

        it('the Semaphore contract\'s external nullifier should be the mixer contract address', async () => {
            const semaphoreExtNullifier = await semaphoreContract.getExternalNullifierByIndex(1)
            const mixerAddress = mixerContract.contractAddress
            assert.isTrue(areEqualAddresses(semaphoreExtNullifier, mixerAddress))
        })
    })

    describe('Deposits and withdrawals', () => {
        // get the circuit, verifying key, and proving key
        const { verifyingKey, provingKey, circuit } = getSnarks()

        const identity = identities[users[0]]
        const identityCommitment = genIdentityCommitment(identity)
        let nextIndex

        let recipientBalanceBefore
        let recipientBalanceAfter
        let recipientBalanceDiff

        let relayerBalanceBefore
        let relayerBalanceAfter
        let relayerBalanceDiff

        let mixReceipt
        let mixTxFee

        it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))

            const invalidValue = (BigInt(mixAmtWei) + BigInt(1)).toString()
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: invalidValue }))
        })

        it('should fail to call depositERC20', async () => {
            let reason: string = ''
            let tx
            try {
                tx = await mixerContract.depositERC20(
                    '0x' + identityCommitment.toString(16),
                    { gasLimit: 1000000 },
                )
                const receipt = await mixerContract.verboseWaitForTransaction(tx)
            } catch (err) {
                reason = err.data[err.transactionHash].reason
            }
            assert.equal(reason, 'Mixer: only supports tokens')
        })

        it('should perform an ETH deposit', async () => {
            // make a deposit (by the first user)
            const tx = await mixerContract.deposit(
                identityCommitment.toString(),
                { 
                    value: '0x' + BigInt(mixAmtWei).toString(16),
                    gasLimit: 1500000,
                },
            )
            const receipt = await mixerContract.verboseWaitForTransaction(tx)

            const gasUsed = receipt.gasUsed.toString()
            console.log('Gas used for this deposit:', gasUsed)

            // check that the leaf was added using the receipt
            assert.isTrue(utils.hasEvent(receipt, semaphoreContract.contract, 'LeafAdded'))
            const leafAddedEvent = utils.parseLogs(receipt, semaphoreContract.contract, 'LeafAdded')[0]

            nextIndex = leafAddedEvent.leaf_index
            assert.equal(nextIndex, 0)

            // check that the leaf was added to the leaf history array in the contract
            const leaves = (await mixerContract.getLeaves()).map((x) => {
                return x.toString(10)
            })
            assert.include(leaves, identityCommitment.toString())
        })

        it('should make an ETH withdrawal', async () => {
            const leaves = await mixerContract.getLeaves()
            const {
                witness,
                signal,
                signalHash,
                signature,
                msg,
                tree,
                identityPath,
                identityPathIndex,
                identityPathElements,
            } = await genMixerWitness(
                circuit,
                identity,
                leaves,
                20,
                recipientAddress,
                relayerAddress,
                feeAmt,
                externalNullifier,
            )

            assert.isTrue(verifySignature(msg, signature, identity.keypair.pubKey))

            assert.isTrue(circuit.checkWitness(witness))

            const publicSignals = genPublicSignals(witness, circuit)

            const proof = await genProof(witness, provingKey)

            // verify the proof off-chain
            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            assert.isTrue(isVerified)

            const mixInputs = genDepositProof(
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmt,
            )

            // check inputs to mix() using preBroadcastCheck()
            const preBroadcastChecked = await semaphoreContract.preBroadcastCheck(
                mixInputs.a,
                mixInputs.b,
                mixInputs.c,
                mixInputs.input,
                signalHash.toString(),
            )

            assert.isTrue(preBroadcastChecked)

            recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)
            relayerBalanceBefore = await deployer.provider.getBalance(relayerAddress)

            const mixTx = await mix(
                relayerRegistryContract,
                mixerContract,
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmt,
                relayerAddress,
            )

            // Wait till the transaction is mined
            mixReceipt = await mixerContract.verboseWaitForTransaction(mixTx)

            recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)
            relayerBalanceAfter = await deployer.provider.getBalance(relayerAddress) 

            const gasUsed = mixReceipt.gasUsed.toString()
            console.log('Gas used for this withdrawal:', gasUsed)

            mixTxFee = mixTx.gasPrice.mul(mixReceipt.gasUsed)
        })

        it('should increase the relayer\'s balance', () => {
            relayerBalanceDiff = relayerBalanceAfter.sub(relayerBalanceBefore)
            assert.equal(relayerBalanceDiff.toString(), feeAmt.toString())
        })

        it('should increase the recipient\'s balance', () => {
            recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            assert.equal(ethers.utils.formatEther(recipientBalanceDiff), '0.099')
        })
    })
})
