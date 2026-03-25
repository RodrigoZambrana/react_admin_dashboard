FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

EXPOSE 4200

CMD ["node", "src/main.js"]
