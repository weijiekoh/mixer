ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-build
WORKDIR /mixer

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

RUN npm i lerna -g
COPY package.json lerna.json tsconfig.json /mixer/

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

RUN npm config set depth 0 && \
    lerna bootstrap --no-progress && \
    lerna run build

FROM node:${NODE_VERSION}-stretch AS mixer-base

COPY --from=mixer-build /mixer/contracts /mixer/contracts
COPY --from=mixer-build /mixer/config /mixer/config
COPY --from=mixer-build /mixer/utils /mixer/utils
COPY --from=mixer-build /mixer/crypto /mixer/crypto
COPY --from=mixer-build /mixer/backend /mixer/backend
COPY --from=mixer-build /mixer/frontend /mixer/frontend
COPY --from=mixer-build /mixer/*.json /mixer/

RUN rm -rf /mixer/contracts/ts/ \
    /mixer/config/ts/ \
    /mixer/utils/ts/ \
    /mixer/crypto/ts/ \
    /mixer/backend/ts/ \
    /mixer/frontend/ts/

WORKDIR /mixer

RUN cd contracts && npm uninstall --save-dev && \
   cd ../config && npm uninstall --save-dev && \
   cd ../utils && npm uninstall --save-dev && \
   cd ../crypto && npm uninstall --save-dev && \
   cd ../backend && npm uninstall --save-dev && \
   cd ../frontend && npm uninstall --save-dev
