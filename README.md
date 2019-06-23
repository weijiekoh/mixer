# Minimal Ethereum Mixer

This is the monorepo for all code and documentation for a minimal Ethereum
mixer. It allows you to cryptographically break the link between a source and
destination address for ETH transfers. It does this via zero-knowledge proofs
which let withdrawals occur securely without revealing the original address
which made a deposit. It relies on a centralised broadcaster server, but the
system is non-custodial and trustless.

A technical specification can be found
[here](https://hackmd.io/qlKORn5MSOes1WtsEznu_g).

## Getting started

These instructions have been tested with Ubuntu 18.0.4.

First, install `npx` if you haven't already:

```bash
npm install -g npx
```

Clone this repository and its `semaphore` submodule:

```bash
git clone git@github.com:weijiekoh/mixer.git && \
cd mixer && \
git submodule update --init
```

Download the circuit, keys, and verifier contract. Doing this instead of
generating your own keys will save you about 20 minutes. Note that these are
not for production use as there is no guarantee that the toxic waste was
discarded.

```bash
./scripts/downloadSnarks.sh
```

<!--Next, download the `solc` [v0.4.25-->
<!--binary](https://github.com/ethereum/solidity/releases/tag/v0.4.25) make it-->
<!--executable, and rename it.-->

<!--```bash-->
<!--chmod a+x solc-static-linux && # whatever its name is-->
<!--mv solc-static-linux solc-0.4.25-->
<!--```-->

<!--Take note of the filepath of `solc-0.4.25` as you will need to modify the next-->
<!--command to use it.-->

Install dependencies and build the source code:

<!--```bash-->
<!--npx lerna bootstrap && \-->
<!--SOLC=/path/to/solc-0.4.25 npx lerna run build-->
<!--```-->
```bash
npx lerna bootstrap && \
npx lerna run build
```

## Full documentation

**TODO**

### Directory structure

- `frontend/`: source code for the UI
- `contracts/`: source code for mixer contracts and tests
- `semaphore/`: a submodule for the [Semaphore code](https://github.com/weijiekoh/semaphore)

### Frontend

See the frontend documentation [here](./frontend).

## Contributing pull requests

Please make pull requests against the `develop` branch.

Each PR should contain a clear description of the feature it adds or problem it
solves (the **why**), and walk the user through a summary of **how** it solves
it.

Each PR should also add to the unit and/or integration tests as appropriate.

## Governance and project management

**TODO**

## Code of conduct and reporting

**TODO**
