import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'

import { AnalyticsModule } from './analytics.module'

async function bootstrap() {
  process.env.ANALYTICS_QUEUE_WORKER = process.env.ANALYTICS_QUEUE_WORKER ?? 'true'
  await NestFactory.createApplicationContext(AnalyticsModule, {
    logger: ['error', 'warn', 'log'],
  })
}

void bootstrap()
