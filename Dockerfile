ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-build
WORKDIR /mixer

RUN npm i lerna -g
COPY package.json package-lock.json lerna.json tsconfig.json /mixer/

RUN npm install --quiet && \
    npm cache clean --force

COPY scripts /mixer/scripts
COPY semaphore /mixer/semaphore

RUN cd /mixer/ && \
    ./scripts/downloadSnarks.sh --only-verifier

RUN cd /mixer/semaphore/sbmtjs && \
    npm install --quiet && \
    cd ../semaphorejs && \
    npm install --quiet && \
    npx truffle compile

COPY contracts /mixer/contracts
COPY config /mixer/config
COPY utils /mixer/utils
COPY crypto /mixer/crypto
COPY backend /mixer/backend
COPY frontend /mixer/frontend

RUN npm run bootstrap &&  \
    npm run build
