ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-testnet

COPY --from=mixer-base /mixer /mixer

WORKDIR /mixer/contracts

#RUN npm run deploy

CMD ["npm", "run", "ganache"]
