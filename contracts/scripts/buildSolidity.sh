#!/bin/bash
set -e

echo 'Building contracts'

rm -rf ../compiled/*
cp ../semaphore/semaphorejs/contracts/*.sol solidity/
cp ../semaphore/semaphorejs/build/verifier.sol solidity/

npx etherlime compile --solcVersion=0.4.25 --buildDirectory=compiled --workingDirectory=solidity --exportAbi 
node build/buildMiMC.js
mkdir -p ../frontend/ts

cp -r compiled/abis ../frontend/ts/
