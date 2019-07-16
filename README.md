# Minimal Ethereum Mixer

This is the monorepo for all code and documentation for a noncustodial Ethereum
mixer. A mixer moves Ether from one address to another in a way that nobody,
except the sender, knows with full certainty the destination address. This
mixer lets senders deposit fixed amounts of Ether into a contract, and when the
pool is large enough, anonymously submit zero-knowledge proofs which
show that the submitter had previously made a deposit, thus authorising the
contract to release funds to the recipient. As a transaction relayer pays the
gas of this transaction, there is no certain on-chain connection between the
sender and recipient. Although this relayer is centralised, the mixer is
noncustodial and no third party can exit with users' funds.

A technical specification of the mixer can be found
[here](https://hackmd.io/qlKORn5MSOes1WtsEznu_g).

## Getting started for local development and testing

These instructions have been tested with Ubuntu 18.0.4 and Node 11.14.0.

### Requirements

- Node v11.14.0.
      - We recommend [`nvm`](https://github.com/nvm-sh/nvm) to manage your Node
        installation.

- [`etcd`](https://github.com/etcd-io/etcd) v3.3.13
    - The relayer server requires an `etcd` server to lock the account nonce of
      its hot wallet.

### Local development

Install `npx` if you haven't already:

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

Install dependencies for the Semaphore submodule and compile its contracts:

```bash
cd semaphore/semaphorejs && \
npm i && \
npx truffle compile
```

Install dependencies and build the source code:

<!--```bash-->
<!--npx lerna bootstrap && \-->
<!--SOLC=/path/to/solc-0.4.25 npx lerna run build-->
<!--```-->

```bash
npm i && \
npm run bootstrap && \
npm run build
```

In a new terminal, run Ganche:

```bash
cd contracts && \
./scripts/runGanache.sh
```

In another terminal, run `etcd`:

```bash
etcd
```

In another terminal, run the relayer server:

```bash
cd backend && \
npm run server
```

In another terminal, launch the frontend:

```bash
cd frontend && \
npm run watch
```

Finally, launch a HTTP server to serve the zk-SNARK content:

```bash
npm i -g http-server && \
cd semaphore/semaphorejs/build && \
http-server -p 8000 --cors
```

You can now run the frontend at http://127.0.0.1:1234.

To automatically compile the TypeScript source code whenever you make a change,
first make sure that you have `npm run watch` running in a terminal. For
instance, while you edit `backend/ts/index.ts`, have a terminal open at
`backend/` and then run `npm run watch`.

## Testing

### Unit tests

#### Contracts

In the `mixer/contracts/` directory:

1. Run `npm run build` if you haven't built the source already
2. Run `npm run testnet`
3. In a separate terminal: `npm run test`

#### Backend

In the `mixer/contracts/` directory:

1. Run `npm run build` if you haven't built the source already
2. Run `npm run testnet`
3. Run `npm run deploy`

In the `mixer/backend/` directory:

1. Run `npm run build` if you haven't built the source already
2. Run `npm run test`

### Integration tests

### CircleCI

## Deployment

<!--This project uses Docker to handle -->

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
