#!/bin/bash

rm -rf ./scripts/parity
mkdir -p ./scripts/parity
parity --chain scripts/parityChain.json --config scripts/parityConfig.toml
