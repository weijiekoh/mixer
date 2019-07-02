#!/bin/bash

# This mnemonic seed is well-known to the public. If you transfer any ETH to
# addreses derived from it, expect it to be swept away.

# Etherlime's ganache command works differently from ganache-cli. It
# concatenates `--count minus 10` new accounts generated from `--mnemonic`. The
# first 10 are predefined.
npx etherlime ganache --mnemonic "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" --gasLimit=8800000 count=20 --networkId 1234

#npx ganache-cli -a 10 -m='candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' --gasLimit=8800000 --port 8545 -i 1234
