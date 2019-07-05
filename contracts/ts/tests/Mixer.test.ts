declare var assert: any

const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as snarkjs from 'snarkjs'
import * as ethers from 'ethers'

import * as del from 'del'

import { config, sleep } from 'mixer-utils'
import {
    SnarkProvingKey,
    SnarkVerifyingKey,
    genRandomBuffer,
    genIdentityCommitment,
    genIdentityNullifier,
    genEddsaKeyPair,
    genMsg,
    signMsg,
    verifySignature,
    genSignalAndSignalHash,
    genWitness,
    extractWitnessRoot,
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
    (parseFloat(config.get('operatorFeeEth')) * 2).toString()
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
                    ethers.utils.parseEther(config.operatorFeeEth),
                )
            )
            await sleep(1000)
        })

        it('should not deploy Mixer if the operatorFee is invalid', async () => {
            assert.revert(
                deployer.deploy(
                    Mixer,
                    {},
                    semaphoreContract.contractAddress,
                    ethers.utils.parseEther(config.mixAmtEth),
                    ethers.utils.parseEther('0'),
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
                    ethers.utils.parseEther(config.operatorFeeEth),
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
        const tree = setupTree()

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
        const circuit = new snarkjs.Circuit(cirDef)

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

            console.log('Root', (await semaphoreContract.getRootHistory(0)).toString(10))

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
            console.log(leaves)
            console.log('identityCommitment', identityCommitment.toString(16))
            assert.include(leaves, identityCommitment.toString())
        })

        it('should make a withdrawal', async () => {
            const broadcasterAddress = mixerContract.contractAddress
            await tree.update(nextIndex, identityCommitment.toString())

            const identityPath = await tree.path(nextIndex)
            const identityPathElements = identityPath.path_elements
            const identityPathIndex = identityPath.path_index

            const { signalHash, signal } = genSignalAndSignalHash(
                recipientAddress, broadcasterAddress, feeAmt,
            )

            // the external nullifier is the hash of the contract's address
            const externalNullifier = mixerContract.contractAddress

            const msg = genMsg(
                externalNullifier,
                signalHash, 
                mixerContract.contractAddress,
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

            const signature = signMsg(identity.privKey, msg)

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
            console.log('Root / witnessRoot', identityPath.root.toString(16))
            debugger

            assert.isTrue(circuit.checkWitness(w))

            const publicSignals = genPublicSignals(w, circuit)
            console.log('Public signal root', publicSignals[0].toString())

            const proof = await genProof(w, provingKey.buffer)

            // verify the proof off-chain
            const isVerified = verifyProof(verifyingKey, proof, publicSignals)
            assert.isTrue(isVerified)

            recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)
            owedFeesBefore = await mixerContract.getFeesOwedToOperator()

            const mixTx = await mixerContract.mix(
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

            // Wait till the transaction is mined
            const receipt = await mixerContract.verboseWaitForTransaction(mixTx)

            const gasUsed = receipt.gasUsed.toString()
            console.log('Gas used for this withdrawal:', gasUsed)

            recipientBalanceAfter = await deployer.provider.getBalance(recipientAddress)
            owedFeesAfter = await mixerContract.getFeesOwedToOperator()
        })

        it('should increase the recipient\'s balance', () => {
            recipientBalanceDiff = recipientBalanceAfter.sub(recipientBalanceBefore).toString()
            assert.equal(ethers.utils.formatEther(recipientBalanceDiff), '0.099')
        })

        it('should increase the operator\'s claimable fee balance', () => {
            owedFeesDiff = owedFeesAfter.sub(owedFeesBefore).toString()
            assert.equal(ethers.utils.formatEther(owedFeesDiff), '0.0005')
        })

        it('should allow the operator to withdraw all owed fees', async () => {
            const operatorBalanceBefore = await deployer.provider.getBalance(operatorAddress)

            const tx = await mixerContract.withdrawFees()
            const receipt = await mixerContract.verboseWaitForTransaction(tx)

            const operatorBalanceAfter = await deployer.provider.getBalance(operatorAddress)

            const operatorBalanceDiff = operatorBalanceAfter.sub(operatorBalanceBefore).toString()
            const balancePlusGas = tx.gasPrice.mul(receipt.gasUsed).add(operatorBalanceDiff).toString()

            assert.equal(balancePlusGas, owedFeesDiff)
            assert.equal(await mixerContract.getFeesOwedToOperator(), 0)
        })
    })
})
