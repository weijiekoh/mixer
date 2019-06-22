#!/bin/bash

mkdir -p semaphore/semaphorejs/build
wget -nc https://www.dropbox.com/s/48wq4m793ixwf8v/circuit.json?dl=1 -O semaphore/semaphorejs/build/circuit.json
wget -nc https://www.dropbox.com/s/wb6zh9l66frpj7w/proving_key.json?dl=1 -O semaphore/semaphorejs/build/proving_key.json
wget -nc https://www.dropbox.com/s/uek5oktz3p3od63/verification_key.json?dl=1 -O semaphore/semaphorejs/build/verification_key.json
wget -nc https://www.dropbox.com/s/tks6kazydc7snf0/verifier.sol?dl=1 -O semaphore/semaphorejs/build/verifier.sol
