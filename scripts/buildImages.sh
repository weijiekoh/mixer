#!/bin/bash
set -e

echo "Building mixer-build"
docker build -f Dockerfile -t mixer-build --target mixer-build --build-arg NODE_ENV=$NODE_ENV .

echo "Building mixer-base"
docker build -f Dockerfile -t mixer-base --target mixer-base --build-arg NODE_ENV=$NODE_ENV .

echo "Building images using docker-compose"
docker-compose -f docker/docker-compose.yml build
