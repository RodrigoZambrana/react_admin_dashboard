FROM node:20-alpine

WORKDIR /app

COPY channel-adapter/package.json ./
COPY channel-adapter/package-lock.json ./
RUN npm ci --omit=dev
COPY channel-adapter/src ./src
COPY shared /shared

EXPOSE 4200

CMD ["node", "src/main.js"]
