#!/bin/bash

# This mnemonic seed is well-known to the public. If you transfer any ETH to
# addreses derived from it, expect it to be swept away.

# Etherlime doesn't generate the same addresses as Ganache
#npx etherlime ganache --mnemonic "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" --gasLimit=8800000 count=10

npx ganache-cli -a 10 -m='candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' --gasLimit=8800000 --port 8545 -i 1234
