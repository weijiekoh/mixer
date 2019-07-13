#!/bin/bash

mkdir -p semaphore/semaphorejs/build

if [ "$1" = "--only-verifier" ]; then
    echo "Downloading verifier.sol"
    wget --quiet -nc https://www.dropbox.com/s/e095d2m8hlxoen7/verifier.sol?dl=0 -O semaphore/semaphorejs/build/verifier.sol
else
    mkdir -p semaphore/semaphorejs/build
    echo "Downloading circuit.json"
    wget --quiet -nc https://www.dropbox.com/s/93fr9wmv2ynjsah/circuit.json?dl=1 -O semaphore/semaphorejs/build/circuit.json

    echo "Downloading proving_key.bin"
    wget --quiet -nc https://www.dropbox.com/s/1xv2k21h75s8esc/proving_key.bin?dl=1 -O semaphore/semaphorejs/build/proving_key.bin

    echo "Downloading proving_key.json"
    wget --quiet -nc https://www.dropbox.com/s/a2ryrbnfk43q25l/proving_key.json?dl=1 -O semaphore/semaphorejs/build/proving_key.json

    echo "Downloading verification_key.json"
    wget --quiet -nc https://www.dropbox.com/s/5qrvbnv5yakf7wn/verification_key.json?dl=1 -O semaphore/semaphorejs/build/verification_key.json

    echo "Downloading verifier.sol"
    wget --quiet -nc https://www.dropbox.com/s/e095d2m8hlxoen7/verifier.sol?dl=0 -O semaphore/semaphorejs/build/verifier.sol
fi

