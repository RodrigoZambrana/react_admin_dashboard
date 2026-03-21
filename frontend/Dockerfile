# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
ARG VITE_APP_NAME=React Admin Dashboard
ARG VITE_API_URL=/api
ARG VITE_CLIENT_SLUG=core
ARG VITE_STATE_SIGNATURE_KEY=
ARG VITE_RECAPTCHA_ENABLED=false
ARG VITE_RECAPTCHA_SITE_KEY=
ARG VITE_PARAMETRIC_IMPORT_TIMEOUT_MS=120000
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CLIENT_SLUG=${VITE_CLIENT_SLUG}
ENV VITE_STATE_SIGNATURE_KEY=${VITE_STATE_SIGNATURE_KEY}
ENV VITE_RECAPTCHA_ENABLED=${VITE_RECAPTCHA_ENABLED}
ENV VITE_RECAPTCHA_SITE_KEY=${VITE_RECAPTCHA_SITE_KEY}
ENV VITE_PARAMETRIC_IMPORT_TIMEOUT_MS=${VITE_PARAMETRIC_IMPORT_TIMEOUT_MS}
COPY frontend/. ./
# Provide shared source for alias imports during the build
COPY docs /docs
COPY src /src
RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    BACKEND_HOST=backend \
    BACKEND_PORT=3000
WORKDIR /usr/share/nginx/html
COPY --from=build /app/build ./
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
