# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
# Install dependencies; fall back to npm install when no lockfile is present
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --legacy-peer-deps; fi

FROM deps AS build
# Build the React dashboard ahead of time so the runtime image serves static assets only
WORKDIR /app
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
# App Platform serves the image as a Static Site, so we expose the built assets via nginx
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
WORKDIR /usr/share/nginx/html
# CRA/Vite output lives under /app/build; adjust if your bundler changes paths
COPY --from=build /app/build ./
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
# Default nginx command keeps the container in the foreground for App Platform
CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
