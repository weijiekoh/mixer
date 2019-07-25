ARG NODE_VERSION=11.14.0

#FROM node:${NODE_VERSION}-stretch AS mixer-backend

#COPY --from=mixer-base /mixer /mixer

FROM mixer-base AS mixer-backend

WORKDIR /mixer/backend

RUN rm -rf /mixer/frontend

CMD ["node", "build/index.js"]
