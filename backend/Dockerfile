ARG NODE_VERSION=11.14.0

FROM node:${NODE_VERSION}-stretch AS mixer-backend

COPY --from=mixer-base /mixer /mixer

RUN rm -rf /mixer/frontend

WORKDIR /mixer/backend

CMD ["node", "build/index.js"]
