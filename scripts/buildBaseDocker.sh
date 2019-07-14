#!/bin/bash

docker build -f Dockerfile -t mixer-build --target mixer-build .
docker build -f Dockerfile -t mixer-base --target mixer-base .
