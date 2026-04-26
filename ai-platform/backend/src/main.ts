import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppModule } from './app.module';

loadRuntimeEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const defaultAllowedOrigins = (
    process.env.DEFAULT_ALLOWED_ORIGINS ??
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5179,http://127.0.0.1:5179'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowedOrigins = Array.from(
    new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
  );

  await app.enableCors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }

      const match = allowedOrigins.find(
        (allowed) => origin === allowed || origin.endsWith(allowed),
      );

      if (match) {
        cb(null, true);
        return;
      }

      cb(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4110);
  await app.listen(port);
}

void bootstrap();

function loadRuntimeEnv() {
  for (const envFilePath of [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ]) {
    if (!existsSync(envFilePath)) {
      continue;
    }

    const lines = readFileSync(envFilePath, 'utf8').split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();

      if (!key || process.env[key]) {
        continue;
      }

      process.env[key] = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    }
  }
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
