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
    genMixInputs,
    areEqualAddresses,
} from './utils'

import { sleep } from 'mixer-utils'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genRandomBuffer,
    genIdentity,
    genIdentityCommitment,
    genIdentityNullifier,
    genEddsaKeyPair,
    genMsg,
    genCircuit,
    genSignedMsg,
    signMsg,
    verifySignature,
    genSignalAndSignalHash,
    genWitness,
    extractWitnessRoot,
    genPathElementsAndIndex,
    genProof,
    genPublicSignals,
    verifyProof,
    unstringifyBigInts,
    setupTree,
} from 'mixer-crypto'

import { genAccounts } from '../accounts'
import buildMiMC from '../buildMiMC'
const Mixer = require('../../compiled/Mixer.json')

import { deploy } from '../deploy/deploy'

let broadcasterAddress
const accounts = genAccounts()
const relayerAddress = accounts[0].address
const recipientAddress = accounts[1].address
const admin = accounts[0]

const depositAmt = ethers.utils.parseEther(config.get('mixAmtEth'))
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

    let keyBuf = genRandomBuffer(32)
    let idNullifierBytes = genRandomBuffer(31)

    //if (i === 0) {
        //keyBuf = Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex')
        //idNullifierBytes = Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex')
    //}

    // Generate an eddsa identity, identity nullifier, and identity commitment
    // per user
    const { privKey, pubKey } = genEddsaKeyPair(keyBuf)
    const identityNullifier = genIdentityNullifier(idNullifierBytes)
    const identityCommitment = genIdentityCommitment(identityNullifier, pubKey)

    identities[user] = {
        identityCommitment,
        identityNullifier,
        privKey,
        pubKey,
    }
}

let mimcContract
let multipleMerkleTreeContract
let mixerContract
let semaphoreContract
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
        await buildMiMC()

        const contracts = await deploy(deployer, contractsPath)
        mimcContract = contracts.mimcContract
        multipleMerkleTreeContract = contracts.multipleMerkleTreeContract
        semaphoreContract = contracts.semaphoreContract
        mixerContract = contracts.mixerContract
    })

    describe('Contract deployments', () => {

        it('should not deploy Mixer if the Semaphore contract address is invalid', async () => {
            assert.revert(
                deployer.deploy(
                    Mixer,
                    {},
                    '0x0000000000000000000000000000000000000000',
                    ethers.utils.parseEther(config.mixAmtEth),
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
            assert.isAddress(multipleMerkleTreeContract.contractAddress)
            assert.isAddress(semaphoreContract.contractAddress)
            assert.isAddress(mixerContract.contractAddress)

            // the external nullifier is the hash of the contract's address
            externalNullifier = mixerContract.contractAddress
            broadcasterAddress = mixerContract.contractAddress
        })

        it('the Mixer contract should be the owner of the Semaphore contract', async () => {
            assert.equal((await semaphoreContract.owner()), mixerContract.contractAddress)
        })

        it('the Semaphore contract\'s external nullifier should be the mixer contract address', async () => {
            const semaphoreExtNullifier = await semaphoreContract.external_nullifier()
            const mixerAddress = mixerContract.contractAddress
            assert.isTrue(areEqualAddresses(semaphoreExtNullifier, mixerAddress))
        })
    })

    describe('Deposits and withdrawals', () => {
        // initialise the off-chain merkle tree
        const tree = setupTree()

        // get the circuit, verifying key, and proving key
        const verifyingKey: SnarkVerifyingKey = unstringifyBigInts(
            JSON.parse(fs.readFileSync(
                path.join(
                    __dirname,
                    '../../../semaphore/semaphorejs/build/verification_key.json',
                )
            ))
        )

        const provingKey: SnarkProvingKey = fs.readFileSync(
            path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'),
        )
        const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
        const cirDef = JSON.parse(
            fs.readFileSync(path.join(__dirname, circuitPath)).toString()
        )

        const circuit = genCircuit(cirDef)

        const identity = identities[users[0]]
        const identityCommitment = identity.identityCommitment
        let nextIndex

        let recipientBalanceBefore
        let recipientBalanceAfter
        let recipientBalanceDiff

        let relayerBalanceBefore
        let relayerBalanceAfter
        let relayerBalanceDiff

        let mixReceipt
        let mixTxFee

        it('should generate identity commitments', async () => {
            for (const user of users) {
                assert.isTrue(identities[user].identityCommitment.toString(10).length > 0)
            }
        })

        it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
            const identityCommitment = identities[users[0]].identityCommitment
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: depositAmt.add(1) }))
        })

        it('should perform a deposit', async () => {
            // make a deposit (by the first user)
            const tx = await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
            const receipt = await mixerContract.verboseWaitForTransaction(tx)

            const gasUsed = receipt.gasUsed.toString()
            console.log('Gas used for this deposit:', gasUsed)

            // check that the leaf was added using the receipt
            assert.isTrue(utils.hasEvent(receipt, multipleMerkleTreeContract.contract, 'LeafAdded'))
            const leafAddedEvent = utils.parseLogs(receipt, multipleMerkleTreeContract.contract, 'LeafAdded')[0]

            nextIndex = leafAddedEvent.leaf_index
            assert.equal(nextIndex, 0)

            // check that the leaf was added to the leaf history array in the contract
            const leaves = (await mixerContract.getLeaves()).map((x) => {
                return x.toString(10)
            })
            assert.include(leaves, identityCommitment.toString())
        })

        it('should make a withdrawal', async () => {
            await tree.update(nextIndex, identityCommitment.toString())

            const identityPath = await tree.path(nextIndex)

            const { identityPathElements, identityPathIndex } = await genPathElementsAndIndex(
                tree,
                identityCommitment,
            )

            const { signalHash, signal } = genSignalAndSignalHash(
                recipientAddress, mixerContract.contractAddress, feeAmt,
            )

            // signature = signEddsa(
            //     privKey,
            //     mimcHash(
            //         externalNullifier,
            //         sha256Hash(
            //             keccak256Hash(
            //                 recipientAddress, broadcasterAddress, feeAmt
            //             )
            //         )
            //         broadcasterAddress,
            //     )
            // )

            const { signature, msg } = genSignedMsg(
                identity.privKey,
                externalNullifier,
                signalHash, 
                broadcasterAddress,
            )

            assert.isTrue(verifySignature(msg, signature, identity.pubKey))

            const w = genWitness(
                circuit,
                identity.pubKey,
                signature,
                signalHash,
                externalNullifier,
                identity.identityNullifier,
                identityPathElements,
                identityPathIndex,
                broadcasterAddress
            )

            const witnessRoot = extractWitnessRoot(circuit, w)
            assert.equal(witnessRoot, identityPath.root)

            assert.isTrue(circuit.checkWitness(w))

            const publicSignals = genPublicSignals(w, circuit)

            const proof = await genProof(w, provingKey.buffer)

            // verify the proof off-chain
            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            assert.isTrue(isVerified)

            const mixInputs = await genMixInputs(signal, proof, publicSignals, recipientAddress, feeAmt)

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
                mixerContract,
                signal,
                proof,
                publicSignals,
                recipientAddress,
                feeAmt,
                relayerAddress,
            )

            recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)
            relayerBalanceAfter = await deployer.provider.getBalance(relayerAddress) 

            // Wait till the transaction is mined
            mixReceipt = await mixerContract.verboseWaitForTransaction(mixTx)

            const gasUsed = mixReceipt.gasUsed.toString()
            console.log('Gas used for this withdrawal:', gasUsed)

            mixTxFee = mixTx.gasPrice.mul(mixReceipt.gasUsed)
        })

        it('should increase the relayer\'s balance', () => {
            relayerBalanceDiff = relayerBalanceAfter.sub(relayerBalanceBefore)
            assert.equal(mixTxFee.add(relayerBalanceDiff).toString(), feeAmt.toString())
        })

        it('should increase the recipient\'s balance', () => {
            recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            assert.equal(ethers.utils.formatEther(recipientBalanceDiff), '0.099')
        })

        it('should make another deposit and withdrawal', async () => {
            const identity = genIdentity()
            const identityCommitment = genIdentityCommitment(identity.identityNullifier, identity.keypair.pubKey)

            const tx = await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
            const receipt = await mixerContract.verboseWaitForTransaction(tx)
            const leafAddedEvent = utils.parseLogs(receipt, multipleMerkleTreeContract.contract, 'LeafAdded')[0]
            nextIndex = leafAddedEvent.leaf_index
            await tree.update(nextIndex, identityCommitment.toString())
            const leaves = await mixerContract.getLeaves()

            const leafIndex = await tree.element_index(identityCommitment)
            assert.equal(nextIndex, 1)
            assert.equal(nextIndex.toString(10), leafIndex)

            await tree.update(nextIndex, identityCommitment.toString())

            const identityPath = await tree.path(nextIndex)

            const { signalHash, signal } = genSignalAndSignalHash(
                recipientAddress, broadcasterAddress, feeAmt,
            )

            const msg = genMsg(
                externalNullifier,
                signalHash, 
                mixerContract.contractAddress,
            )

            const signature = signMsg(identity.keypair.privKey, msg)

            assert.isTrue(verifySignature(msg, signature, identity.keypair.pubKey))

            const w = genWitness(
                circuit,
                identity.keypair.pubKey,
                signature,
                signalHash,
                externalNullifier,
                identity.identityNullifier,
                identityPath.path_elements,
                identityPath.path_index,
                broadcasterAddress
            )

            const witnessRoot = extractWitnessRoot(circuit, w)
            assert.equal(witnessRoot, identityPath.root)

            assert.isTrue(circuit.checkWitness(w))

            const publicSignals = genPublicSignals(w, circuit)

            const proof = await genProof(w, provingKey.buffer)

            // verify the proof off-chain
            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            assert.isTrue(isVerified)

            recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)

            const mixTx = await mix(mixerContract, signal, proof, publicSignals, recipientAddress, feeAmt, relayerAddress)

            // Wait till the transaction is mined
            const mixReceipt = await mixerContract.verboseWaitForTransaction(mixTx)

            const gasUsed = mixReceipt.gasUsed.toString()
            console.log('Gas used for this withdrawal:', gasUsed)

            recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)

            recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            assert.equal(ethers.utils.formatEther(recipientBalanceDiff), '0.099')
        })
    })
})
