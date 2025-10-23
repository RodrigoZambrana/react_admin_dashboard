# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
ARG CLIENT_SLUG=core
ENV CLIENT_SLUG=${CLIENT_SLUG}
COPY backend ./
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG CLIENT_SLUG=core
ENV CLIENT_SLUG=${CLIENT_SLUG}
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package*.json ./
COPY --from=build /app/dist ./dist
COPY backend/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/shared ./shared
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
