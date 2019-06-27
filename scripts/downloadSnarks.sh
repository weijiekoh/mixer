#!/bin/bash

mkdir -p semaphore/semaphorejs/build
wget -nc https://www.dropbox.com/s/wnav410x4zuox4z/circuit.json?dl=1 -O semaphore/semaphorejs/build/circuit.json
wget https://www.dropbox.com/s/zgi99x7peevfzhb/proving_key.bin?dl=1 -nc  -O semaphore/semaphorejs/build/proving_key.bin
wget https://www.dropbox.com/s/vka5jqcacy9k86h/proving_key.json?dl=1 -nc  -O semaphore/semaphorejs/build/proving_key.json
wget -nc https://www.dropbox.com/s/3359a7c2ykhhj98/verification_key.json?dl=1 -O semaphore/semaphorejs/build/verification_key.json
wget -nc https://www.dropbox.com/s/nuth00m5nnue122/verifier.sol?dl=1 -O semaphore/semaphorejs/build/verifier.sol
