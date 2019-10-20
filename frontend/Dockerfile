FROM nginx:1.17.1-alpine AS mixer-frontend

COPY --from=mixer-base /mixer/frontend/dist /static
COPY --from=mixer-base /mixer/frontend/nginx.conf /etc/nginx/nginx.conf

WORKDIR /

CMD nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
