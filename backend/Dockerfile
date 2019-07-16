ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-backend

COPY --from=mixer-base /mixer/backend/build /build

WORKDIR /

CMD ["node", "build/index.js"]
