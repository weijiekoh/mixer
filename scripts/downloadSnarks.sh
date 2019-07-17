#!/bin/bash

VERIFIER_SOL="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/verifier.sol"
PROVING_KEY_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/proving_key.json"
VERIFICATION_KEY_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/verification_key.json"
PROVING_KEY_BIN="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/proving_key.bin"
CIRCUIT_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/circuit.json"

mkdir -p semaphore/semaphorejs/build

if [ "$1" = "--only-verifier" ]; then
    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O semaphore/semaphorejs/build/verifier.sol

    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O semaphore/semaphorejs/build/verification_key.json

else
    mkdir -p semaphore/semaphorejs/build
    echo "Downloading circuit.json"
    wget --quiet -nc $CIRCUIT_JSON -O semaphore/semaphorejs/build/circuit.json

    echo "Downloading proving_key.bin"
    wget --quiet -nc $PROVING_KEY_BIN -O semaphore/semaphorejs/build/proving_key.bin

    echo "Downloading proving_key.json"
    wget --quiet -nc $PROVING_KEY_JSON -O semaphore/semaphorejs/build/proving_key.json

    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O semaphore/semaphorejs/build/verification_key.json

    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O semaphore/semaphorejs/build/verifier.sol
fi

