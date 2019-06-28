declare var assert: any

const crypto = require('crypto')
const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as Artifactor from 'truffle-artifactor'
import * as snarkjs from 'snarkjs'
import * as circomlib from 'circomlib'
import * as ethers from 'ethers'
import * as web3Utils from 'web3-utils'
import * as del from 'del'
const RocksDb = require('zkp-sbmtjs/src/storage/rocksdb')
const MerkleTreeJs = require('zkp-sbmtjs/src/tree')
const MimcSpongeHasher = require('zkp-sbmtjs/src/hasher/mimcsponge')
const blake2 = require('blakejs')

const Semaphore = require('../../compiled/Semaphore.json')
const Mixer = require('../../compiled/Mixer.json')
const MerkleTree = require('../../compiled/MerkleTree.json')
const MultipleMerkleTree = require('../../compiled/MultipleMerkleTree.json')
const mimcGenContract = require('circomlib/src/mimcsponge_gencontract.js');
import MemStorage from '../utils/memStorage'

const bigInt = snarkjs.bigInt;
const eddsa = circomlib.eddsa;
const mimcsponge = circomlib.mimcsponge;

const admin = accounts[0]
const artifactor = new Artifactor('compiled/')

const depositAmt = ethers.utils.parseEther('0.1')
const feeAmt = ethers.utils.parseEther('0.001')

const users = accounts.slice(1, 6).map((user) => user.signer.address)
const identities = {}

const DEFAULT_VALUE = 0

const mixerInterface = new ethers.utils.Interface(Mixer.abi)

import { convertWitness, prove, cutDownBits, beBuff2int} from './utils'

for (const user of users) {
    const privKey = crypto.randomBytes(32)
    const pubKey = eddsa.prv2pub(privKey)

    const identityNullifier = bigInt(snarkjs.bigInt.leBuff2int(crypto.randomBytes(31)))

    const identityCommitmentInts = [
        bigInt(circomlib.babyJub.mulPointEscalar(pubKey, 8)[0]),
        bigInt(identityNullifier),
    ]

    const identityCommitmentBuffer = Buffer.concat(
        identityCommitmentInts.map(x => x.leInt2Buff(32))
    )

    const identityCommitment = cutDownBits(
        beBuff2int(Buffer.from(blake2.blake2sHex(identityCommitmentBuffer), 'hex')),
        253,
    )

    identities[user] = {
        identityCommitment,
        identityNullifier,
        privKey,
        pubKey,
    }
}

const identity = identities[users[0]]
const operatorAddress = accounts[0].signer.address
const recipientAddress = accounts[1].signer.address
const identityCommitment = identity.identityCommitment
let nextIndex

let mimcContract
let multipleMerkleTreeContract
let mixerContract
let semaphoreContract

describe('Mixer', () => {
    const SEED = 'mimcsponge';

    const deployer = new etherlime.EtherlimeGanacheDeployer(admin.secretKey)
    deployer.defaultOverrides = { gasLimit: 8800000 }
    deployer.setSigner(accounts[0].signer)

    before(async () => {
        await artifactor.save({
            contractName: 'MiMC',
            abi: mimcGenContract.abi,
            unlinked_binary: mimcGenContract.createCode(SEED, 220),
        })

        const MiMC = require('../../compiled/MiMC.json')

        console.log('Deploying MiMC')
        mimcContract = await deployer.deploy(MiMC, {})

        const libraries = {
            MiMC: mimcContract.contractAddress,
        }

        console.log('Deploying MultipleMerkleTree')
        multipleMerkleTreeContract = await deployer.deploy(
            MultipleMerkleTree,
            libraries,
        )

        console.log('Deploying Semaphore')
        semaphoreContract = await deployer.deploy(
            Semaphore,
            libraries,
            20,
            0,
            12312,
            1000,
        )

        console.log('Deploying Mixer')
        mixerContract = await deployer.deploy(Mixer, {}, semaphoreContract.contractAddress)

        console.log('Transferring ownership of Semaphore to Mixer')
        await semaphoreContract.transferOwnership(mixerContract.contractAddress)

        console.log('Setting the external nullifier of the Semaphore contract')
        await mixerContract.setSemaphoreExternalNulllifier()
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
        const storage_path = '/tmp/rocksdb_semaphore_mixer_test'
        if (fs.existsSync(storage_path)) {
            del.sync(storage_path, { force: true })
        }

        const storage = new RocksDb(storage_path);

        const default_value = '0'
        const hasher = new MimcSpongeHasher()
        const prefix = 'semaphore'
        const tree = new MerkleTreeJs(
            prefix,
            storage,
            hasher,
            20,
            DEFAULT_VALUE,
        )

        const verifyingKey = snarkjs.unstringifyBigInts(
            JSON.parse(fs.readFileSync(
                path.join(
                    __dirname,
                    '../../../semaphore/semaphorejs/build/verification_key.json',
                )
            ))
        )

        const provingKey = fs.readFileSync(path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.bin'))
        const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
        const cirDef = JSON.parse(
            fs.readFileSync(path.join(__dirname, circuitPath)).toString()
        )
        const circuit = new snarkjs.Circuit(cirDef)

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
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 1 }))
        })


        it('should successfully make a deposit', async () => {
            // make a deposit (by the first user)
            const tx = await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
            const receipt = await mixerContract.verboseWaitForTransaction(tx)

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

        it('should successfully make a withdrawal', async () => {
            const broadcasterAddress = mixerContract.contractAddress
            await tree.update(nextIndex, identityCommitment.toString())

            const identityPath = await tree.path(nextIndex)

            const identityPathElements = identityPath.path_elements
            const identityPathIndex = identityPath.path_index

            // calculate the signal, which is the keccak256 hash of
            // recipientAddress, broadcasterAddress, and fee.

            const signal = ethers.utils.solidityKeccak256(
                ['address', 'address', 'uint256'],
                [recipientAddress, broadcasterAddress, feeAmt],
            )

            const signalToContract = signal

            const signalAsBuffer = Buffer.from(signal.slice(2), 'hex')
            const signalHashRaw = crypto.createHash('sha256').update(signalAsBuffer).digest()
            const signalHash = beBuff2int(signalHashRaw.slice(0, 31))


            // the external nullifier is the hash of the contract's address
            const externalNullifier = mixerContract.contractAddress

            const msg = mimcsponge.multiHash(
                [
                    bigInt(externalNullifier),
                    bigInt(signalHash), 
                    bigInt(mixerContract.contractAddress),
                ]
            )

            const signature = eddsa.signMiMCSponge(identity.privKey, msg)

            assert.isTrue(eddsa.verifyMiMCSponge(msg, signature, identity.pubKey));

            const w = circuit.calculateWitness({
                'identity_pk[0]': identity.pubKey[0],
                'identity_pk[1]': identity.pubKey[1],
                'auth_sig_r[0]': signature.R8[0],
                'auth_sig_r[1]': signature.R8[1],
                auth_sig_s: signature.S,
                signal_hash: signalHash,
                external_nullifier: externalNullifier,
                identity_nullifier: identity.identityNullifier,
                identity_path_elements: identityPathElements,
                identity_path_index: identityPathIndex,
                broadcaster_address: broadcasterAddress,
            })

            const witnessRoot = w[circuit.getSignalIdx('main.root')]
            const nullifiersHash = w[circuit.getSignalIdx('main.nullifiers_hash')]
            assert.isTrue(circuit.checkWitness(w))
            assert.equal(witnessRoot, identityPath.root)

            const witnessBin = convertWitness(snarkjs.stringifyBigInts(w))
            const publicSignals = w.slice(1, circuit.nPubInputs + circuit.nOutputs+1)
            const proof = await prove(witnessBin.buffer, provingKey.buffer)

            // verify the proof off-chain
            const isVerified = snarkjs.groth.isValid(verifyingKey, proof, publicSignals)
            assert.isTrue(isVerified)

            recipientBalanceBefore = await deployer.provider.getBalance(recipientAddress)
            owedFeesBefore = await mixerContract.getFeesOwedToOperator()

            const mixTx = await mixerContract.mix(
                {
                    signal: signalToContract,
                    a: [ proof.pi_a[0].toString(), proof.pi_a[1].toString() ],
                    b: [ 
                        [ proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString() ],
                        [ proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString() ] 
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
