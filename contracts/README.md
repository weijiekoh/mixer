# Mixer contracts

To build the contracts and tests, run:

```bash
npm run build
```

The `solidity/` directory contains all `.sol` files for the Semaphore and Mixer
smart contracts. Note that the `npm run build` command will **copy** the
Semaphore contracts from the `mixer/semaphore/` submodule into `solidity/` in
order for the `solc-js` compiler to build the contracts properly. As such, do
not modify the Semaphore contracts in `solidity/`; instead, do so in the
`mixer/semaphore` submodule.

The compiled contracts will be in `compiled/` and ABI files will be in `compiled/abis`.

To compile contract tests while on the fly, run:

```bash
npm run watch
```

To run the tests:

```bash
npm run ganache
```

And in another terminal, run:

```bash
npm run test
```

