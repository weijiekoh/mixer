# Mixer Frontend

The frontend is a React 16 app written in TypeScript. It uses Parcel to handle
source bundling.

## Instructions

First, get at least 0.102 Kovan ETH (0.1 plus gas fees) from a
[faucet](https://faucet.kovan.network/). Next, navigate to the UI in your web
browser.

Enter the recipient's ETH address and click "Mix 0.1 ETH". This will trigger a
MetaMask popup. Click submit. Do not close your browser window until you see
the Countdown page.

Keep this browser window open till midnight UTC for the page to automatically
mix the funds. To speed up this process for testing purposes, you can set the
timestamp of the last entry in the localStorage `MIXER` JSON array to `0`, and
a yellow button will appear which you can click to trigger the mix.

This mix process downloads about 40MB worth of gzipped zk-SNARK keys and
circuit data, generates a proof, and submits it to a centralised but
noncustodial relayer. The relayer verifies the proof and submits a `mix()`
transaction to the mixer contract located
[here](https://kovan.etherscan.io/address/0xfb2bf70382a98c72d38bed63735ff5115ff243c6).

## Development

For a hot-reloading development setup, run the following command in this
directory:

```bash
npm run watch
```

And launch [http://localhost:1234](http://localhost:1234) in your browser.

## Production

To create a production build, run:

```bash
npm run build
```

## Stylesheets

All stylesheets are written in LESS and stored in `less/`.

`index.html` imports `index.less`. In turn, `index.less` imports all other
stylesheets named `index.less` in various subfolders.

We use convention to separate of style concerns.

- `constants.less`: defines colour values, lengths, font sizes, and any
  absolute values used by the other stylesheets.

- `routes/index.less`: defines styles common to all routes, and also imports
  all stylesheets in `routes/`.

- `routes/<name>.less`: defines styles specific to `routes/<name>.tsx`

- `components/index.less`: defines styles common to all components, and also imports
  all stylesheets in `components/`.

- `components/<name>.less`: defines styles specific to `components/<name>.tsx`

The layout should be responsive. Media queries should go into each individual
stylesheet. e.g. `constants.less` should contain a media query which sets
different margins for different screen sizes, `deposit.less` should handle its
own responsive styles, etc.
