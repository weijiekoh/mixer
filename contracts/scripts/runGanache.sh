#!/bin/bash

# This mnemonic seed is well-known to the public. If you transfer any ETH to
# addreses derived from it, expect it to be swept away.

npx etherlime ganache --mnemonic='candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' --count=10 --gasLimit=8800000

#npx ganache-cli -a 10 -m 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' --gasLimit 8000000 --port 9545
