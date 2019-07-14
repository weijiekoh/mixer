ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-backend

COPY --from=mixer-base /mixer /mixer

WORKDIR /mixer/backend

CMD ["node", "build/index.js"]
