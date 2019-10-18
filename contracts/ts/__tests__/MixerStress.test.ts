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
import { mix, getSnarks } from './utils'

import { sleep } from 'mixer-utils'
import {
    genRandomBuffer,
    genIdentity,
    genIdentityCommitment,
    genPathElementsAndIndex,
    genIdentityNullifier,
    genEddsaKeyPair,
    genSignedMsg,
    genCircuit,
    signMsg,
    verifySignature,
    genSignalAndSignalHash,
    genWitness,
    extractWitnessRoot,
    genProof,
    genPublicSignals,
    verifyProof,
    setupTree,
} from 'mixer-crypto'

import { genAccounts, genTestAccounts } from '../accounts'
import buildMiMC from '../buildMiMC'
const Mixer = require('@mixer-contracts/compiled/Mixer.json')

import {
    deployAllContracts,
    deployToken,
} from '../deploy/deploy'

const NUM_CYCLES = 2

const mnemonic = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const accounts = genAccounts()
const testAccounts = genTestAccounts(NUM_CYCLES, mnemonic)
const admin = accounts[0]
const relayerAddress = accounts[0].address

const mixAmtEth = ethers.utils.parseEther(config.get('mixAmtEth').toString())
const mixAmtTokens = ethers.utils.bigNumberify(config.get('mixAmtTokens').toString())
const feeAmt = ethers.utils.parseEther(config.get('feeAmtEth').toString())

const users = accounts.map((user) => user.address)
const identities = {}
const treeIndices = {}

const contractsPath = path.join(
    __dirname,
    '../..',
    'compiled',
)

for (let i=0; i < testAccounts.length; i++) {
    console.log(`Generating EdDSA keyair and identity for user ${i}`)
    const user = testAccounts[i].address

    const identity = genIdentity()
    const { privKey, pubKey } = identity.keypair
    const identityNullifier = identity.identityNullifier
    const identityTrapdoor = identity.identityTrapdoor
    const identityCommitment = genIdentityCommitment(identity)

    identities[user] = {
        identityCommitment,
        identityNullifier,
        identityTrapdoor,
        privKey,
        pubKey,
    }
}

let mimcContract
let mixerContract
let semaphoreContract
let relayerRegistryContract
let externalNullifier : string

describe('Mixer', () => {

    const deployer = new etherlime.JSONRPCPrivateKeyDeployer(
        admin.privateKey,
        config.get('chain.url'),
        {
            chainId: config.get('chain.chainId'),
        },
    )
    deployer.defaultOverrides = { gasLimit: 8800000 }
    deployer.setSigner(accounts[0])

    before(async () => {
        // @ts-ignore
        const sender = new ethers.Wallet(accounts[0].privateKey, deployer.provider)

        for (let account of testAccounts) {
            const balance = await deployer.provider.getBalance(account.address)
            if (ethers.utils.parseUnits('5', 'ether').gt(balance.toString())) {
                await sender.sendTransaction({
                    to: account.address,
                    gasPrice: 1,
                    gasLimit: 21000,
                    value: ethers.utils.parseEther('15'),
                })
            }
        }

        await buildMiMC()

        const contracts = await deployAllContracts(
            deployer,
            mixAmtEth,
            mixAmtTokens,
            admin.address,
        )
        mimcContract = contracts.mimcContract
        semaphoreContract = contracts.semaphoreContract
        mixerContract = contracts.mixerContract
        relayerRegistryContract = contracts.relayerRegistryContract
    })

    describe('Giving away ETH', () => {
        it('users should have enough ETH ', async () => {
            for (let account of testAccounts) {
                const balance = await deployer.provider.getBalance(account.address)
                assert.isTrue(ethers.utils.parseUnits('1', 'ether').lte(balance.toString()))
            }
        })
    })

    describe('Contract deployments', () => {

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
            const semaphoreExtNullifier = await semaphoreContract.external_nullifier()
            const mixerAddress = mixerContract.contractAddress
            assert.equal(mixerAddress.toLowerCase(), semaphoreExtNullifier.toHexString().toLowerCase())
        })
    })

    describe('Deposits and withdrawals', () => {
        // initialise the off-chain merkle tree
        const tree = setupTree()

        // get the circuit, verifying key, and proving key
        const { verifyingKey, provingKey, circuit } = getSnarks()

        const recipientAddress = accounts[1].address
        let nextIndex

        it('should perform deposits', async () => {
            for (let i=0; i < testAccounts.length; i++) {
                console.log(`Deposit by user ${i}`)
                const user = testAccounts[i].address
                const identity = identities[user]
                const identityCommitment = identity.identityCommitment

                // make a deposit
                const tx = await mixerContract.deposit(identityCommitment.toString(), { value: mixAmtEth, gasLimit: 1500000 })
                const receipt = await mixerContract.verboseWaitForTransaction(tx)
                const leafAddedEvent = utils.parseLogs(receipt, semaphoreContract.contract, 'LeafAdded')[0]
                nextIndex = leafAddedEvent.leaf_index
                treeIndices[identityCommitment] = nextIndex

                const gasUsed = receipt.gasUsed.toString()
                console.log('Gas used for this deposit:', gasUsed)

                await tree.update(nextIndex, identityCommitment.toString())
            }
        })

        it('should make withdrawals', async () => {
            let recipientBalanceBefore
            let recipientBalanceAfter

            for (let i=0; i < testAccounts.length; i++) {
                console.log(`Withdraw by user ${i}`)
                const user = testAccounts[i].address
                const identity = identities[user]
                const identityCommitment = identity.identityCommitment

                const identityPath = await tree.path(treeIndices[identityCommitment])
                const { identityPathElements, identityPathIndex } = await genPathElementsAndIndex(
                    tree,
                    identityCommitment,
                )

                const { signalHash, signal } = genSignalAndSignalHash(
                    recipientAddress, relayerAddress, feeAmt,
                )

                const { signature, msg } = genSignedMsg(
                    identity.privKey,
                    externalNullifier,
                    signalHash, 
                    relayerAddress,
                )

                assert.isTrue(verifySignature(msg, signature, identity.pubKey))

                const w = genWitness(
                    circuit,
                    identity.pubKey,
                    signature,
                    signalHash,
                    externalNullifier,
                    identity.identityNullifier,
                    identity.identityTrapdoor,
                    identityPath.path_elements,
                    identityPath.path_index,
                    relayerAddress
                )

                const witnessRoot = extractWitnessRoot(circuit, w)
                assert.equal(witnessRoot.toString(), identityPath.root.toString())

                assert.isTrue(circuit.checkWitness(w))

                const publicSignals = genPublicSignals(w, circuit)

                const proof = await genProof(w, provingKey.buffer)

                // verify the proof off-chain
                const isVerified = verifyProof(verifyingKey, proof, publicSignals)
                assert.isTrue(isVerified)

                recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)

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
                const receipt = await mixerContract.verboseWaitForTransaction(mixTx)

                const gasUsed = receipt.gasUsed.toString()
                console.log('Gas used for this withdrawal:', gasUsed)

                recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)
                const recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
                assert.equal(ethers.utils.formatEther(recipientBalanceDiff), '0.099')
            }
        })
    })
})
