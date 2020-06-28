#!/bin/bash
set -e

echo 'Building contracts'

# Delete old files
rm -rf ./compiled/*

mkdir -p ./compiled/abis

# Copy the Semaphore contracts from the submodule into solidity/
cp ../semaphore/semaphorejs/contracts/*.sol solidity/
cp ../semaphore/semaphorejs/build/verifier.sol solidity/

# Compile the contracts

npx etherlime compile --solcVersion=native --buildDirectory=compiled --workingDirectory=solidity --exportAbi 

# Build the MiMC contract from bytecode
node build/buildMiMC.js

# Copy ABIs to the frontend module

mkdir -p ../frontend/ts
cp -r compiled/abis ../frontend/
