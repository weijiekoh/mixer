ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-build
WORKDIR /mixer

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

COPY package.json lerna.json tsconfig.json /mixer/

RUN npm install --quiet && \
    npm cache clean --force

COPY scripts /mixer/scripts
COPY semaphore /mixer/semaphore

RUN cd /mixer/ && \
    ./scripts/downloadSnarks.sh --only-verifier

RUN mkdir /mixer/contracts && \
    mkdir /mixer/config && \
    mkdir /mixer/utils && \
    mkdir /mixer/backend && \
    mkdir /mixer/frontend

COPY config/package*.json /mixer/config/
COPY contracts/package*.json /mixer/contracts/
COPY utils/package*.json /mixer/utils/
COPY backend/package*.json /mixer/backend/
COPY frontend/package*.json /mixer/frontend/

RUN npx lerna bootstrap --no-progress

COPY contracts /mixer/contracts
COPY config /mixer/config
COPY utils /mixer/utils
COPY backend /mixer/backend
COPY frontend /mixer/frontend

RUN wget https://github.com/ethereum/solidity/releases/download/v0.5.12/solc-static-linux
RUN chmod a+x solc-static-linux && mv solc-static-linux /usr/bin/solc
RUN rm -rf /mixer/frontend/build /mixer/frontend/dist

RUN npm run build

RUN echo "Building frontend with NODE_ENV=production" && \
    cd frontend && \
    npm run build && \
    npm run webpack-build

FROM node:${NODE_VERSION}-stretch AS mixer-base

COPY --from=mixer-build /mixer/contracts /mixer/contracts
COPY --from=mixer-build /mixer/config /mixer/config
COPY --from=mixer-build /mixer/utils /mixer/utils
COPY --from=mixer-build /mixer/backend /mixer/backend
COPY --from=mixer-build /mixer/frontend /mixer/frontend

COPY --from=mixer-build /mixer/package.json /mixer/package.json
COPY --from=mixer-build /mixer/lerna.json /mixer/lerna.json
COPY --from=mixer-build /mixer/tsconfig.json /mixer/tsconfig.json

RUN rm -rf /mixer/contracts/ts/ \
    /mixer/config/ts/ \
    /mixer/utils/ts/ \
    /mixer/backend/ts/ \
    /mixer/frontend/ts/

WORKDIR /mixer

RUN cd contracts && npm uninstall --save-dev && \
   cd ../config && npm uninstall --save-dev && \
   cd ../utils && npm uninstall --save-dev && \
   cd ../backend && npm uninstall --save-dev && \
   cd ../frontend && npm uninstall --save-dev
