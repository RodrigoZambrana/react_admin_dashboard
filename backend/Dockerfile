# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
# Install dependencies (including Prisma CLI); support repos without lockfile
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install --legacy-peer-deps; fi

FROM deps AS build
# Compile the NestJS backend to TypeScript output
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
# Runtime image keeps only what is required to run the API on port 3000
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client curl
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY --from=build /app/scripts ./scripts
RUN npm prune --omit=dev
EXPOSE 3000
# App Platform healthcheck probes /healthz; ensure the endpoint remains available
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/src/main.js"]
