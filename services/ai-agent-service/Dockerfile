FROM node:20-alpine

WORKDIR /app

COPY ai-agent-service/package.json ./
COPY ai-agent-service/package-lock.json ./
RUN npm ci --omit=dev
COPY ai-agent-service/src ./src
COPY shared /shared

EXPOSE 4100

CMD ["node", "src/main.js"]
