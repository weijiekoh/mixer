declare var assert: any
const crypto = require('crypto')
const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as Artifactor from 'truffle-artifactor'
import * as snarkjs from 'snarkjs'
import * as circomlib from 'circomlib'
import * as ethers from 'ethers'
import * as del from 'del'
const RocksDb = require('zkp-sbmtjs/src/storage/rocksdb')
const MerkleTreeJs = require('zkp-sbmtjs/src/tree')
const Mimc7Hasher = require('zkp-sbmtjs/src/hasher/mimc7')

const Semaphore = require('../../compiled/Semaphore.json')
const Mixer = require('../../compiled/Mixer.json')
const MerkleTree = require('../../compiled/MerkleTree.json')
const MultipleMerkleTree = require('../../compiled/MultipleMerkleTree.json')
const mimcGenContract = require('circomlib/src/mimc_gencontract.js')
import MemStorage from '../utils/memStorage'

const bigInt = snarkjs.bigInt;
const eddsa = circomlib.eddsa;
const mimc7 = circomlib.mimc7;

const admin = accounts[0]
const artifactor = new Artifactor('compiled/')

const depositAmt = ethers.utils.parseEther('0.1')
const feeAmt = ethers.utils.parseEther('0.001')

const users = accounts.slice(1, 6).map((user) => user.signer.address)
const identities = {}

const TREE_LEVELS = 2
const DEFAULT_VALUE = 4

const mixerInterface = new ethers.utils.Interface(Mixer.abi)

import { convertWitness, prove } from './utils'

for (const user of users) {
    const privKey = crypto.randomBytes(32)
    const pubKey = eddsa.prv2pub(privKey)

    const identityNullifier = bigInt(snarkjs.bigInt.leBuff2int(crypto.randomBytes(31)))
    const identityTrapdoor = bigInt(snarkjs.bigInt.leBuff2int(crypto.randomBytes(31)))

    const identityCommitment = mimc7.multiHash(
        [
            bigInt(pubKey[0]),
            bigInt(pubKey[1]),
            bigInt(identityNullifier),
            bigInt(identityTrapdoor)
        ]
    )
    identities[user] = {
        identityCommitment,
        identityNullifier,
        identityTrapdoor,
        privKey,
        pubKey,
    }
}

describe('Mixer', () => {
    let mimcContract
    let multipleMerkleTreeContract
    let mixerContract
    let semaphoreContract

    const deployer = new etherlime.EtherlimeGanacheDeployer(admin.secretKey)
    deployer.defaultOverrides = { gasLimit: 8000000 }
    deployer.setSigner(accounts[0].signer)

    before(async () => {
        await artifactor.save({
            contractName: 'MiMC',
            abi: mimcGenContract.abi,
            unlinked_binary: mimcGenContract.createCode('mimc', 91),
        })

        const MiMC = require('../../compiled/MiMC.json')
        mimcContract = await deployer.deploy(MiMC, {})

        const libraries = {
            MiMC: mimcContract.contractAddress,
        }

        multipleMerkleTreeContract = await deployer.deploy(
            MultipleMerkleTree,
            libraries,
        )

        semaphoreContract = await deployer.deploy(
            Semaphore,
            libraries,
            20,
            0,
            12312,
            1000,
        )

        mixerContract = await deployer.deploy(Mixer, {}, semaphoreContract.contractAddress)
        await semaphoreContract.transferOwnership(mixerContract.contractAddress)
    })

    describe('Deployments', () => {
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
    })

    describe('Deposits and withdrawals', () => {
        const storage_path = '/tmp/rocksdb_semaphore_mixer_test'
        if (fs.existsSync(storage_path)) {
            del.sync(storage_path, { force: true })
        }

        const storage = new RocksDb(storage_path);
        //const storage = new MemStorage()

        const default_value = '0'
        const hasher = new Mimc7Hasher()
        const prefix = 'semaphore'
        const tree = new MerkleTreeJs(
            prefix,
            storage,
            hasher,
            20,
            DEFAULT_VALUE,
        )

        const verifyingKey = fs.readFileSync(path.join(__dirname, '../../../semaphore/semaphorejs/build/verification_key.json'))
        const provingKey = fs.readFileSync(path.join(__dirname, '../../../semaphore/semaphorejs/build/proving_key.json'))
        const circuitPath = '../../../semaphore/semaphorejs/build/circuit.json'
        const cirDef = JSON.parse(
            fs.readFileSync(path.join(__dirname, circuitPath)).toString()
        )
        const circuit = new snarkjs.Circuit(cirDef)

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

        it('should add the identity commitment to the contract if the amount is correct', async () => {
            const identity = identities[users[0]]
            const recipientAddress = accounts[1].signer.address
            const identityCommitment = identity.identityCommitment
            const broadcasterAddress = mixerContract.contractAddress

            // make a deposit (by the first user)
            const tx = await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
            const receipt = await mixerContract.verboseWaitForTransaction(tx)

            // check that the leaf was added using the receipt
            assert.isTrue(utils.hasEvent(receipt, multipleMerkleTreeContract.contract, 'LeafAdded'))
            const leafAddedEvent = utils.parseLogs(receipt, multipleMerkleTreeContract.contract, 'LeafAdded')[0]

            const nextIndex = leafAddedEvent.leaf_index
            assert.equal(nextIndex, 0)

            // check that the leaf was added to the leaf history array in the contract
            const leaves = (await mixerContract.getLeaves()).map((x) => {
                return x.toString(10)
            })
            assert.include(leaves, identityCommitment.toString())

            await tree.update(nextIndex, identityCommitment.toString())

            const identityPath = await tree.path(nextIndex)

            const identityPathElements = identityPath.path_elements
            const identityPathIndex = identityPath.path_index

            // calculate the signalHash which is the hash of recipientAddress,
            // broadcasterAddress, and fee
            // Matches the following Solidity code:
            //
            // keccak256(abi.encodePacked(recipientAddress, mixerAddress, feeAmt));

            const signalHash = ethers.utils.solidityKeccak256(
                ['address', 'address', 'uint256'],
                [recipientAddress, broadcasterAddress, feeAmt],
            )

            // the external nullifier is the hash of the contract's address
            const externalNullifier = mixerContract.contractAddress

            const msg = mimc7.multiHash(
                [
                    bigInt(externalNullifier),
                    bigInt(signalHash), 
                    bigInt(mixerContract.contractAddress),
                ]
            )

            const signature = eddsa.signMiMC(identity.privKey, msg);
            ////console.log(identityPath, identityPathElements, identityPathIndex, identityPath.root)
            const w = circuit.calculateWitness({
                'identity_pk[0]': identity.pubKey[0],
                'identity_pk[1]': identity.pubKey[1],
                'auth_sig_r[0]': signature.R8[0],
                'auth_sig_r[1]': signature.R8[1],
                auth_sig_s: signature.S,
                signal_hash: signalHash,
                external_nullifier: externalNullifier,
                identity_nullifier: identity.identityNullifier,
                identity_r: identity.identityTrapdoor,
                identity_path_elements: identityPathElements,
                identity_path_index: identityPathIndex,
                broadcaster_address: broadcasterAddress,
            })

            const witnessRoot = w[circuit.getSignalIdx('main.root')];
            const nullifiersHash = w[circuit.getSignalIdx('main.nullifiers_hash')];
            assert(circuit.checkWitness(w));
            assert.equal(witnessRoot, identityPath.root);
            debugger

            const witnessBin = convertWitness(snarkjs.stringifyBigInts(w));
            const publicSignals = w.slice(1, circuit.nPubInputs + circuit.nOutputs+1);
            const proof = await prove(witnessBin.buffer, provingKey.buffer);

            const isVerified = snarkjs.isValid(verifyingKey, proof, verifyingKey)
            assert.isTrue(isVerified)
        })

        it('should perform a withdrawal', async () => {
        })
    })

    describe('Withdrawals', () => {
    })
})
