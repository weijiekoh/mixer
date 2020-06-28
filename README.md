# MicroMix: A noncustodial Ethereum mixer

<a href="https://micromix.app">
    <img src="/docs/img/logo.png" />
</a>

This is the monorepo for all code and documentation for a noncustodial Ethereum
mixer. Try it at [micromix.app](https://micromix.app).

Join the [Telegram group](https://t.me/joinchat/A5mVoBRl-b6SD8aoAUVvFw) to discuss.

A mixer moves ETH or ERC20 tokens from one address to another in a way that
nobody except the sender can know for sure that these addresses are linked.
This mixer lets a user deposit fixed amounts of ETH into a contract, and when
the pool is large enough, anonymously submit zero-knowledge proofs which show
that the submitter had previously made a deposit, thus authorising the contract
to release funds to the recipient.

As a transaction relayer pays the gas of this transaction, there is no certain
on-chain connection between the sender and recipient. Although this relayer is
centralised, the mixer is noncustodial and no third party can exit with users'
funds.

A technical specification of the mixer is
[here](https://hackmd.io/qlKORn5MSOes1WtsEznu_g).

This mixer is highly experimental and not yet audited. Do not use it to mix
real funds yet. It only supports Kovan ETH for now. Get Kovan ETH from a faucet
[here](https://faucet.kovan.network/) or
[here](https://gitter.im/kovan-testnet/faucet).

## Supported features

The current version of this mixer is a simple MVP for desktop Chrome, Brave, or
Firefox. You should also have [MetaMask](https://metamask.io/) installed, and
some Kovan ETH. You need at least 0.11 KETH to mix 0.1 ETH, and 20 Kovan DAI
and 0.01 ETH to mix Kovan DAI. You can generate Kovan DAI using MakerDAO's CDP
creation tool [here](https://cdp.makerdao.com).

It has the following features:

1. A user interface which allows:

    - One deposit per day.

    - One-click withdrawal once UTC midnight has passed.

    - Immediate self-withdrawals in case the user wants their funds back at the
      cost of privacy.
    
    - Immediate withdraw requests if the user wishes the operator to mix the
      funds immediately, which also comes at the cost of some privacy.

2. A backend server with one JSON-RPC 2.0 endpoint, `mixer_mix()`, which:
    
    - Accepts, verifies, and submits a zk-SNARK proof (generated in the user's
      browser) to the mixer contract.

3. Ethereum contracts:

    - The
      [Semaphore](https://github.com/kobigurk/semaphore/) zero-knowledge
      signalling system as a base layer.

    - A Mixer contract with functions which
        
        - Accepts ETH or ERC20 token deposits.

        - Accepts mix requests. Each request comprises of a zk-SNARK proof that
          a deposit had been made in the past and has not already been claimed.
          If the proof is valid, it transfers funds to the recipient and takes an
          operator's fee.
        
        - Allows the operator to withdraw all accurred fees.

    - Gas costs after the Istanbul network upgrade is currently 1.2 million per deposit and 378k per withdrawal. The gas cost for each withdrawal (before Istanbul) is 886k.

## Local development and testing

These instructions have been tested with Ubuntu 18.0.4 and Node 11.14.0.

### Requirements

- Node v11.14.0.
      - We recommend [`nvm`](https://github.com/nvm-sh/nvm) to manage your Node
        installation.

- [`etcd`](https://github.com/etcd-io/etcd) v3.3.13
    - The relayer server requires an `etcd` server to lock the account nonce of
      its hot wallet.

### Local development

Install `npx` and `http-server` if you haven't already:

```bash
npm install -g npx http-server
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

Create a file named `hotWalletPrivKey.json` in a location outside this
repository with a private key which will serve as the operator's hot wallet.
The following private key corresponds to the address
`0x627306090abab3a6e1400e9345bc60c78a8bef57`, the first Ethereum address which
can be derived from the well-known `candy maple cake sugar...` mnemonic. Don't
use this in production.

```json
{
    "privateKey": "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"
}
```

`0x62730609...` is also the address to which the Mixer contract will transfer
fees.

Copy `config/config.example.yaml` to `config/local-dev.yaml` to  and modify
it as such:

- Change `backend.hotWalletPrivKeyPath` to the absolute path to the
  `hotWalletPrivKey.json` file you just created.

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
cd ../../
# if you are still in semaphore/semaphorejs/

npm i && \
npm run bootstrap && \
npm run build
```

In a new terminal, run Ganche:

```bash
# Assuming you are in mixer/

cd contracts && \
./scripts/runGanache.sh
```

In another terminal, deploy the contracts:

```bash
# Assuming you are in mixer/

cd contracts && \
npm run deploy
```

In another terminal, run `etcd`:

```bash
etcd
```

In another terminal, run the relayer server:

```bash
# Assuming you are in mixer/

cd backend && \
npm run server
```

In another terminal, launch the frontend:

```bash
# Assuming you are in mixer/

cd frontend && \
npm run watch
```

Finally, launch a HTTP server to serve the zk-SNARK content:

```bash
# Assuming you are in mixer/

cd semaphore/semaphorejs/ && \
http-server -p 8000 --cors
```

You can now run the frontend at http://localhost:1234.

To automatically compile the TypeScript source code whenever you change it,
first make sure that you have `npm run watch` running in a terminal. For
instance, while you edit `backend/ts/index.ts`, have a terminal open at
`backend/` and then run `npm run watch`.

If you use a terminal multiplexer like `tmux`, your screen might now look like this:

<img src="/docs/img/dev_screens.png" />

Clockwise from top right:

1. Ganache (`runGanache.sh`)
2. Frontend (`npm run watch`)
3. Deployed contracts (`npm run deploy`)
4. HTTP server (`http-server`)
5. Backend (`npm run server`)

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

<!--### Integration tests-->

<!--TODO-->

<!--### CircleCI-->

<!--TODO-->

## Deployment

<!--### Ethereum contracts-->

<!--First, copy `config/local-dev.yaml` to `config/local-prod.yaml` and modify it as such:-->

<!--- Change `chain.url` to an Ethereum node of a network of your choice, e.g.-->
  <!--`"https://kovan.infura.io/v3/<api_key>`-->
<!--- Change `chain.chainId` to the corresponding chain ID. e.g. `42` for Kovan.-->

### Docker containers

This project uses Docker to containerise its various components, and Docker
Compose to orchestrate them.

To run build and run the Docker containers, first create a `MIXER_SECRETS`
directory as a sibling of the `mixer` directory:

```bash
# Assuming you are in mixer/

cd .. && \
mkdir -p MIXER_SECRETS
```

Create a file named `hotWalletPrivKey.json` in `MIXER_SECRETS/` with the private key
which will serve as the operator's hot wallet:

```json
{
    "privateKey": "0x................................................................"
}
```

Change its file permissions:

```bash
chmod 400 MIXER_SECRETS/hotWalletPrivKey.json
```

Next, run:

```bash
NODE_ENV=docker ./scripts/buildImages.sh && \
./scripts/runImages.sh
```

This will produce the following images and containers (edited for brevity):

```
REPOSITORY              TAG                 SIZE
docker_mixer-frontend   latest              23.2MB
docker_mixer-backend    latest              2.09GB
mixer-base              latest              2.09GB
mixer-build             latest              3.24GB
nginx                   1.17.1-alpine       20.6MB
jumanjiman/etcd         latest              35MB
node                    11.14.0-stretch     904MB

CONTAINER ID        IMAGE                   COMMAND                  PORTS                          NAMES
............        docker_mixer-backend    "node build/index.js"    0.0.0.0:3000->3000/tcp         mixer-backend
............        docker_mixer-frontend   "/bin/sh -c 'nginx -…"   80/tcp, 0.0.0.0:80->8001/tcp   mixer-frontend
............        jumanjiman/etcd         "etcd --listen-clien…"   0.0.0.0:2379->2379/tcp         mixer-etcd
```

Note that setting `NODE_ENV` to `docker-dev` in the above command will make the
frontend and backend use the [`config/docker-dev.yaml`](config/docker-dev.yaml)
config file, which in turn points to the Kovan testnet.

In contrast, the local instances run via `npm run watch` in
`frontend/` and `npm run server` in `backend` respectively use
[`config/local-dev.yaml`](config/local-dev.yaml), which uses any network at
`http://localhost:8545` with a chain ID of `1234`.

<!--## Full documentation-->

<!--**TODO**-->

### Directory structure

- `frontend/`: source code for the UI
- `contracts/`: source code for mixer contracts and tests
- `semaphore/`: a submodule for the [Semaphore code](https://github.com/weijiekoh/semaphore)

### Frontend

See the frontend documentation [here](./frontend).

## Contributing pull requests

Each PR should contain a clear description of the feature it adds or problem it
solves (the **why**), and walk the user through a summary of **how** it solves
it.

Each PR should also add to the unit and/or integration tests as appropriate.

<!--## Governance and project management-->

<!--**TODO**-->

<!--## Code of conduct and reporting-->

<!--**TODO**-->
