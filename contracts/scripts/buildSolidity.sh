#!/bin/bash
set -e

echo 'Building contracts'

cp ../semaphore/semaphorejs/contracts/*.sol solidity/
cp ../semaphore/semaphorejs/build/verifier.sol solidity/

if [[ -z "${SOLC}" ]]; then
    solcBinary="solc"
else
    solcBinary="${SOLC}"
fi

echo Using $solcBinary

cd solidity

mkdir -p ../compiled
$solcBinary -o ../compiled/ ./Mixer.sol --overwrite --optimize --bin --abi --bin-runtime

if [ $? -eq 1 ]; then
    echo
    echo 'Please run this command with the path to the solc 0.4.25 binary set as the SOLC environment variable.'
fi
