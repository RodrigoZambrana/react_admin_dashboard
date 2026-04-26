# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci

FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY frontend ./frontend

ARG VITE_API_URL=http://localhost:4110
ARG VITE_TENANT_ID=demo-tenant
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TENANT_ID=${VITE_TENANT_ID}

RUN npm run build --workspace frontend

FROM nginx:1.27-alpine AS runtime

WORKDIR /usr/share/nginx/html

RUN apk add --no-cache curl

COPY --from=build /app/frontend/dist ./
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
