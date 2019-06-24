const fs = require('fs');
const path = require('path');
import * as etherlime from 'etherlime-lib'
import * as Artifactor from 'truffle-artifactor'
import * as snarkjs from 'snarkjs'
import * as circomlib from 'circomlib'
import * as ethers from 'ethers'

const Semaphore = require('../compiled/Semaphore.json')
const Mixer = require('../compiled/Mixer.json')
const MerkleTree = require('../compiled/MerkleTree.json')
const mimcGenContract = require('circomlib/src/mimc_gencontract.js')

const bigInt = snarkjs.bigInt;
const eddsa = circomlib.eddsa;
const mimc7 = circomlib.mimc7;

const admin = accounts[0]
const artifactor = new Artifactor('compiled/')

describe('Mixer', () => {
    let mimcContract
    let merkleTreeContract
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

        const MiMC = require('../compiled/MiMC.json')
        mimcContract = await deployer.deploy(MiMC, {})

        const libraries = {
            MiMC: mimcContract.contractAddress,
        }

        merkleTreeContract = await deployer.deploy(
            MerkleTree,
            libraries,
            2,
            4,
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
            assert.isAddress(merkleTreeContract.contractAddress)
            assert.isAddress(semaphoreContract.contractAddress)
            assert.isAddress(mixerContract.contractAddress)
        })

        it('the Mixer contract should be the owner of the Semaphore contract', async () => {
            assert.equal((await semaphoreContract.owner()), mixerContract.contractAddress)
        })
    })

    describe('Deposits', () => {
        const depositAmt = ethers.utils.parseEther('0.1')

        let identityCommitments = {}
        let users = accounts.slice(1, 6)

        const prvKey = Buffer.from('0001020304050607080900010203040506070809000102030405060708090001', 'hex')
        const pubKey = eddsa.prv2pub(prvKey)
        const identityNullifier = bigInt('230')
        const identityTrapdoor = bigInt('12311')

        const identityCommitment = mimc7.multiHash(
            [
                bigInt(pubKey[0]),
                bigInt(pubKey[1]),
                bigInt(identityNullifier),
                bigInt(identityTrapdoor)
            ]
        )

        it('should generate an identity commitment', async () => {
            assert.equal(
                identityCommitment.toString(10), 
                '21375762478350580868641914949267138481263092446318042242917459058343516778559',
            )
        })

        it('should not add the identity commitment to the contract if the amount is incorrect', async () => {
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 0 }))
            await assert.revert(mixerContract.deposit(identityCommitment.toString(), { value: 1 }))
        })

        it('should add the identity commitment to the contract if the amount is correct', async () => {
            await mixerContract.deposit(identityCommitment.toString(), { value: depositAmt })
            const leaves = (await mixerContract.getLeaves()).map((x) => {
                return x.toString(10)
            })
            assert.include(leaves, identityCommitment.toString())
        })
    })

    describe('Withdrawals', () => {
        //const circuitPath = '../../semaphore/semaphorejs/build/circuit.json'
        //const cirDef = JSON.parse(
            //fs.readFileSync(path.join(__dirname, circuitPath)).toString()
        //)
        //const circuit = new snarkjs.Circuit(cirDef)
    })
})
