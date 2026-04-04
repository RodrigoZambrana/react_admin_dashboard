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

  app.enableCors();

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
