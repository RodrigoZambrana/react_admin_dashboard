# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
COPY . .
ARG CLIENT_SLUG=urucortinas
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
    CLIENT_SLUG=$CLIENT_SLUG
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
ARG CLIENT_SLUG=urucortinas
ENV CLIENT_SLUG=$CLIENT_SLUG
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY --from=build /app/scripts ./scripts
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
