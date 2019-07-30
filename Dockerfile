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

#RUN cd /mixer/semaphore/sbmtjs && \
    #npm install --quiet && \
    #cd ../semaphorejs && \
    #npm install --quiet && \
    #npx truffle compile
RUN mkdir /mixer/contracts && \
    mkdir /mixer/config && \
    mkdir /mixer/utils && \
    mkdir /mixer/crypto && \
    mkdir /mixer/backend && \
    mkdir /mixer/frontend

COPY config/package*.json /mixer/config/
COPY contracts/package*.json /mixer/contracts/
COPY utils/package*.json /mixer/utils/
COPY crypto/package*.json /mixer/crypto/
COPY backend/package*.json /mixer/backend/
COPY frontend/package*.json /mixer/frontend/

COPY config/tsconfig.json /mixer/config/
COPY contracts/tsconfig.json /mixer/contracts/
COPY utils/tsconfig.json /mixer/utils/
COPY crypto/tsconfig.json /mixer/crypto/
COPY backend/tsconfig.json /mixer/backend/
COPY frontend/tsconfig.json /mixer/frontend/

RUN npx lerna bootstrap --no-progress

COPY contracts /mixer/contracts
COPY config /mixer/config
COPY utils /mixer/utils
COPY crypto /mixer/crypto
COPY backend /mixer/backend
COPY frontend /mixer/frontend

RUN rm -rf /mixer/frontend/build /mixer/frontend/dist
RUN npx lerna run build

#ENV NODE_ENV_BAK=$NODE_ENV
#ENV NODE_ENV=production

#RUN echo "Building frontend with NODE_ENV=production" && \
    #cd frontend && \
    #npm run build

#ENV NODE_ENV=$NODE_ENV_BAK

FROM node:${NODE_VERSION}-stretch AS mixer-base

COPY --from=mixer-build /mixer/contracts /mixer/contracts
COPY --from=mixer-build /mixer/config /mixer/config
COPY --from=mixer-build /mixer/utils /mixer/utils
COPY --from=mixer-build /mixer/crypto /mixer/crypto
COPY --from=mixer-build /mixer/backend /mixer/backend
COPY --from=mixer-build /mixer/frontend /mixer/frontend

COPY --from=mixer-build /mixer/package.json /mixer/package.json
COPY --from=mixer-build /mixer/lerna.json /mixer/lerna.json
COPY --from=mixer-build /mixer/tsconfig.json /mixer/tsconfig.json

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
