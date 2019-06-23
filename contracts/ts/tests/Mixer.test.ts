import 'mocha'
import * as etherlime from 'etherlime-lib'
import * as Artifactor from 'truffle-artifactor'
const Semaphore = require('../compiled/Semaphore.json')
const Mixer = require('../compiled/Mixer.json')
const MerkleTree = require('../compiled/MerkleTree.json')
const mimcGenContract = require('circomlib/src/mimc_gencontract.js')

// @ts-ignore
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

    it('should deploy contracts', () => {
        // @ts-ignore
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
