#!/bin/bash

VERIFIER_SOL="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/verifier.sol"
PROVING_KEY_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/proving_key.json"
VERIFICATION_KEY_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/verification_key.json"
PROVING_KEY_BIN="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/proving_key.bin"
CIRCUIT_JSON="https://kobigurk.s3.us-west-1.amazonaws.com/mixer/circuit.json"
CIRCUIT_JSON_PATH="semaphore/semaphorejs/build/circuit.json"
PROVING_KEY_BIN_PATH="semaphore/semaphorejs/build/proving_key.bin"

mkdir -p semaphore/semaphorejs/build

if [ "$1" = "--only-verifier" ]; then
    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O semaphore/semaphorejs/build/verifier.sol

    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O semaphore/semaphorejs/build/verification_key.json

else
    if [ ! -f "$CIRCUIT_JSON_PATH" ]; then
        echo "Downloading circuit.json"
        wget --quiet -O - $CIRCUIT_JSON | gunzip -c > $CIRCUIT_JSON_PATH
    fi

    if [ ! -f "$PROVING_KEY_BIN_PATH" ]; then
        echo "Downloading proving_key.bin"
        wget --quiet -O - $PROVING_KEY_BIN | gunzip -c > $PROVING_KEY_BIN_PATH
    fi

    echo "Downloading proving_key.json"
    wget --quiet -nc $PROVING_KEY_JSON -O semaphore/semaphorejs/build/proving_key.json

    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O semaphore/semaphorejs/build/verification_key.json

    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O semaphore/semaphorejs/build/verifier.sol
fi

