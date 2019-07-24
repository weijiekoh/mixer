// Make Typescript happy
declare var assert: any
require('events').EventEmitter.defaultMaxListeners = 0

const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as ethers from 'ethers'

import { config } from 'mixer-config'

import { sleep } from 'mixer-utils'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genRandomBuffer,
    genIdentity,
    genIdentityCommitment,
    genIdentityNullifier,
    genEddsaKeyPair,
    genSignedMsg,
    genCircuit,
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

const accounts = genAccounts()
const admin = accounts[0]

const depositAmt = ethers.utils.parseEther(config.get('mixAmtEth'))
const feeAmt = ethers.utils.parseEther(
    (parseFloat(config.get('burnFeeEth')) * 2).toString()
)

const burnFee = ethers.utils.parseEther(
    (parseFloat(config.get('burnFeeEth'))).toString()
)

const operatorFee = burnFee

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

const mix = async (mixerContract, signal, proof, publicSignals, recipientAddress, feeAmt) => {

    return await mixerContract.mix(
        {
            signal,
            a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
            b: [ 
                [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
                [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ],
            ],
            c: [ proof.pi_c[0].toString(), proof.pi_c[1].toString() ],
            input: [
                publicSignals[0].toString(),
                publicSignals[1].toString(),
                publicSignals[2].toString(),
                publicSignals[3].toString(),
                publicSignals[4].toString()
            ],
            recipientAddress,
            fee: feeAmt,
        }
    )
}

let mimcContract
let multipleMerkleTreeContract
let mixerContract
let semaphoreContract
let externalNullifier : string
let broadcasterAddress: string

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
        const operatorAddress = accounts[0].address
        const recipientAddress = accounts[1].address
        const identityCommitment = identity.identityCommitment
        let nextIndex

        let recipientBalanceBefore
        let recipientBalanceAfter
        let owedFeesDiff
        let owedFeesBefore
        let owedFeesAfter
        let recipientBalanceDiff

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
                recipientAddress, broadcasterAddress, feeAmt,
            )

            const externalNullifierModified = '0x08f3fa6b5256fe583281738eb79a0cb75c3e7f5b'
            const broadcasterAddressModified = externalNullifierModified

            const { signature, msg } = genSignedMsg(
                identity.privKey,
                externalNullifierModified,
                signalHash, 
                broadcasterAddressModified,
            )

            assert.isTrue(verifySignature(msg, signature, identity.pubKey))

            const w = genWitness(
                circuit,
                identity.pubKey,
                signature,
                signalHash,
                externalNullifierModified,
                identity.identityNullifier,
                identityPathElements,
                identityPathIndex,
                broadcasterAddressModified,
            )
        })
    })
})

