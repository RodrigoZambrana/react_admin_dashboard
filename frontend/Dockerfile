# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
