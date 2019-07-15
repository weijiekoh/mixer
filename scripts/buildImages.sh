#!/bin/bash

docker build -f Dockerfile -t mixer-build --target mixer-build --build-arg NODE_ENV=$NODE_ENV .
docker build -f Dockerfile -t mixer-base --target mixer-base .
docker-compose -f docker/docker-compose.dev.yml build
