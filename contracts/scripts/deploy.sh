#!/bin/bash

node ./build/deploy/deploy.js -o deployedAddresses.json
cp deployedAddresses.json ../frontend/ts/deployedAddresses.json

# TODO: is this necessary?
cp deployedAddresses.json ../backend/deployedAddresses.json
