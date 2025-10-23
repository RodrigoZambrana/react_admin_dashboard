# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app/frontend
ARG VITE_CLIENT_SLUG=urucortinas
ENV VITE_CLIENT_SLUG=${VITE_CLIENT_SLUG}
COPY frontend ./
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY shared ../shared
RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    BACKEND_HOST=backend \
    BACKEND_PORT=3000
WORKDIR /usr/share/nginx/html
COPY --from=build /app/frontend/build ./
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
