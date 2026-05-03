# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
ENV SECURITY_LOOP_SKIP=1
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
RUN apk add --no-cache postgresql-client curl
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.seed.json ./tsconfig.seed.json
COPY src/common/security ./src/common/security
COPY src/common/media ./src/common/media
COPY src/prisma ./src/prisma
COPY src/storefront/defaults ./src/storefront/defaults
COPY src/storefront/site-routes.ts ./src/storefront/site-routes.ts
COPY src/storefront/utils.ts ./src/storefront/utils.ts
COPY src/storefront/types.ts ./src/storefront/types.ts
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh
RUN npm prune --omit=dev
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["./entrypoint.sh"]
