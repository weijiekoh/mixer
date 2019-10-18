# How to integrate MicroMix

This document will help anyone who wants to use MicroMix in their own website
or app.

## Prerequisites (Kovan testnet)

When MicroMix completes its security audit and trusted setup ceremonies, we
will publish the following files and mainnet contract addresses.

In the meantime, the following are for testing purposes on the Kovan testnet.
Their security is not guaranteed.

### Deployed contracts

Clients will interact with the following deployed contracts.

| Contract | Address (Kovan) | Notes |
|-|-|-|
| Mixer | [0xCF321783a827d5422822a45f1F3543e3994f8361](https://kovan.etherscan.io/address/0xCF321783a827d5422822a45f1F3543e3994f8361) | Supports 0.1 ETH deposits |
| TokenMixer | [0xcF95B8393321B03d7E50A7043eE580B9fF605E3b](https://kovan.etherscan.io/address/0xcF95B8393321B03d7E50A7043eE580B9fF605E3b) | Supports 20 [Kovan DAI (TKN)](https://kovan.etherscan.io/token/0xc4375b7de8af5a38a93548eb8453a498222c4ff2) deposits |

### zk-SNARK files

These are static files required for proof generation, and optionally, proof
verification. For best network performance, clients should either cache these
files or mirror them in a separate server.

| File | Location | Size | Notes |
|-|-|-|-|
| `circuit.json` | [Link](https://kobigurk.s3.us-west-1.amazonaws.com/mixer/audit_v1/circuit.json) | 113M (15.6M gzipped) | Required for proof generation. |
| `proving_key.bin` | [Link](https://kobigurk.s3.us-west-1.amazonaws.com/mixer/audit_v1/proving_key.bin) | 68M (24.3M gzipped) | Required for proof generation. |
| `verification_key.json` | [Link](https://kobigurk.s3.us-west-1.amazonaws.com/mixer/audit_v1/verification_key.json) | 4K | Optional. Allows the client to verify a generated proof off-chain. |

## User flow

There are four things that a client must support to successfully integrate with MicroMix:

1. Generate and save an `Identity`

2. Allow the user to deposit ETH or tokens into the Mixer or TokenMixer
   contract, along with an *identity commitment* (see below).

3. Encourage the user to leave their deposits in the mixer for as long as
   possible, in order to enhance their privacy.

4. Allow the user to generate a zk-SNARK proof when they wish to withdraw their funds

5. Send the proof to a [Surrogeth](https://github.com/lsankar4033/surrogeth/)
   relayer, which will perform a withdrawal transaction in exchange for a fee.
   This preserves the user's on-chain privacy as they do not have to use their
   own address to perform the withdrawal.

[`libsemaphore`](https://www.npmjs.com/package/libsemaphore), a client library
for Semaphore and MicroMix, will assist with steps (1) and (3).

## Install `libsemaphore`

`libsemaphore` is available as a Node package:

```bash
npm i libsemaphore
```

Import functions from `libsemaphore` as such:

```ts
import {
    // function name
} from 'libsemaphore'
```

`libsemaphore` is written in Typescript. See its
[documentation](https://github.com/weijiekoh/libsemaphore) for detailed documentation.

The following examples are written in Typescript to maximise clarity around
variable types.

## 1. Generate and save an `Identity`

First, generate an `Identity` using `genIdentity()`.

```ts
import {
    Identity,
    SnarkBigInt,
    genIdentity,
    genIdentityCommitment,
} from 'libsemaphore'

const identity: Identity = genIdentity()
const identityCommitment: SnarkBigInt = genIdentityCommitment(identity)
```

An `Identity` is not the user's Ethereum
address. Rather, it is comprised of:

1. An EdDSA keypair
2. A 31-byte identity nullifier
3. A 31-byte identity trapdoor

The identity nullifier and identity trapdoor are random values. Clients do not
need to be concerned about them, except that they must be kept safe along with
the EdDSA keypair. 

To that end, clients should provide a way to store and retrieve the `Identity`
locally on the user's device, such as in their browser's localStorage. This is
important as this information is necessary to generate a zk-SNARK proof to
effect a withdrawal in the future.

We suggest that clients first serialise each `Identity` as such: 

```ts
import { serialiseIdentity } from 'libsemaphore'
const serialisedId: string = serialiseIdentity(identity)
// now, store serialisedId locally
```

A serialised `Identity` looks like this:

```text
["e82cc2b8654705e427df423c6300307a873a2e637028fab3163cf95b18bb172e","a02e517dfb3a4184adaa951d02bfe0fe092d1ee34438721d798db75b8db083","15c6540bf7bddb0616984fccda7e954a0fb5ea4679ac686509dc4bd7ba9c3b"]
```

To convert a serialised `Identity` to an `Identity`:

```ts
import { unSerialiseIdentity } from 'libsemaphore'
const unSerialisedId: libsemaphore.Identity = unSerialiseIdentity(serialisedId)
```

## 2. Deposit ETH or ERC20 tokens

To deposit ETH to a Mixer contract which accepts ETH deposits, create a
`deposit` transaction to the desired Mixer contract.

The following code snippets assume the following:

- `mixerContract` is an instance of an
  [`ethers.Contract`](https://docs.ethers.io/ethers.js/html/api-contract.html)
  which is associated with the desired Mixer contract.
- `mixAmtWei` is the amount of ETH which the `Mixer` contract supports, in wei.

```ts
const idc = identityCommitment.toString()
const tx = await mixerContract.deposit(idc), { value: mixAmtWei })
```

[`web3.js`](https://web3js.readthedocs.io/en/v1.2.0/) clients would use `await mixerContract.methods.deposit(idc).send( { value: mixAmtWei } )`

To deposit ERC20 tokens to a TokenMixer contract which accepts token
deposits, create a `depositERC20` transaction to the desired TokenMixer contract.

The following code snippets assume the following:

- `tokenContract` is an instance of an
  [`ethers.Contract`](https://docs.ethers.io/ethers.js/html/api-contract.html)
  which is associated with the ERC20 token contract. 
- `tokenMixerContract` is an instance of an
  [`ethers.Contract`](https://docs.ethers.io/ethers.js/html/api-contract.html)
  which is associated with the desired TokenMixer contract.
- `mixAmtTokens` is the number of tokens which the TokenMixer contract supports.
- `tokenDecimals` is the number of token decimals specified by the ERC20
  contract.

Invoke the ERC20 `approve()` function to allow the ERC20 token contract to
transfer `mixAmtTokens` tokens from the user to the `tokenMixerContract`.

```ts
const mixAmtTokensMultiplied = (mixAmtTokens.toNumber() * 10 ** tokenDecimals).toString()
const approveTx = await tokenContract.approve(tokenMixerContract.contractAddress, mixAmtTokensMultiplied)
```

[`web3.js`](https://web3js.readthedocs.io/en/v1.2.0/) clients would use 
`await tokenContract.methods.approve(tokenMixerContract.contractAddress, mixAmtTokensMultiplied)`

Next, inovke the TokenMixer's `depositERC20` function:

```ts
const idc = identityCommitment.toString()
const tx = await mixerContract.depositERC20(idc)
```

## 3. Encourage anonymity-enhancing best practices

## 4. Generate a zk-SNARK proof

## 5. Submit the proof to a relayer
