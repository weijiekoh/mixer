#!/bin/bash

VERIFIER_SOL="https://micromixtest.blob.core.windows.net/snarks/verifier.sol"
VERIFICATION_KEY_JSON="https://micromixtest.blob.core.windows.net/snarks/verification_key.json"
PROVING_KEY_BIN="https://micromixtest.blob.core.windows.net/snarks/proving_key.bin"
CIRCUIT_JSON="https://micromixtest.blob.core.windows.net/snarks/circuit.json"

CIRCUIT_JSON_PATH="semaphore/semaphorejs/build/circuit.json"
PROVING_KEY_BIN_PATH="semaphore/semaphorejs/build/proving_key.bin"
VERIFIER_SOL_PATH="semaphore/semaphorejs/build/verifier.sol"
VERIFICATION_KEY_PATH="semaphore/semaphorejs/build/verification_key.json"

mkdir -p semaphore/semaphorejs/build

if [ "$1" = "--only-verifier" ]; then
    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O $VERIFIER_SOL_PATH
    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O $VERIFICATION_KEY_PATH

else
    if [ ! -f "$CIRCUIT_JSON_PATH" ]; then
        echo "Downloading circuit.json"
        wget --quiet -O - $CIRCUIT_JSON | gunzip -c > $CIRCUIT_JSON_PATH
    fi

    if [ ! -f "$PROVING_KEY_BIN_PATH" ]; then
        echo "Downloading proving_key.bin"
        wget --quiet -O - $PROVING_KEY_BIN | gunzip -c > $PROVING_KEY_BIN_PATH
    fi

    #echo "Downloading proving_key.json"
    #wget --quiet -nc $PROVING_KEY_JSON -O $PROVING_KEY_JSON_PATH

    echo "Downloading verification_key.json"
    wget --quiet -nc $VERIFICATION_KEY_JSON -O $VERIFICATION_KEY_PATH

    echo "Downloading verifier.sol"
    wget --quiet -nc $VERIFIER_SOL -O $VERIFIER_SOL_PATH
fi

