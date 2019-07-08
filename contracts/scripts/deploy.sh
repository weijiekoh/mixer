#!/bin/bash

node ./build/deploy/deploy.js -c compiled -o deployedAddresses.json
cp deployedAddresses.json ../frontend/ts/deployedAddresses.json
cp deployedAddresses.json ../backend/ts/deployedAddresses.json
