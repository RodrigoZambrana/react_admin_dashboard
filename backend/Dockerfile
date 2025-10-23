# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
COPY backend ./backend
WORKDIR /app/backend
ARG CLIENT_SLUG=urucortinas
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
    CLIENT_SLUG=$CLIENT_SLUG
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package*.json ./
ARG CLIENT_SLUG=urucortinas
ENV CLIENT_SLUG=$CLIENT_SLUG
COPY --from=build /app/backend/dist ./dist
COPY backend/prisma ./prisma
COPY --from=build /app/backend/scripts ./scripts
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
