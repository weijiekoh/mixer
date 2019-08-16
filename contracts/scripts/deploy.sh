#!/bin/bash

node ./build/deploy/deploy.js -o deployedAddresses.json
cp deployedAddresses.json ../frontend/ts/deployedAddresses.json
cp deployedAddresses.json ../backend/deployedAddresses.json
