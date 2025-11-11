# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps

FROM deps AS build
WORKDIR /app
ARG CLIENT_SLUG=core
ENV CLIENT_SLUG=${CLIENT_SLUG}
COPY . .
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG CLIENT_SLUG=core
ENV CLIENT_SLUG=${CLIENT_SLUG}
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh
RUN npm prune --omit=dev
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
