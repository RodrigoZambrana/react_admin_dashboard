import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import { AppModule } from './app.module'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { ValidationError } from 'class-validator'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import cookie from '@fastify/cookie'
import { SanitizeInputPipe } from './common/pipes/sanitize-input.pipe'
import { resolveRequiredEnv } from './common/config/runtime-env'
import { resolveMediaRoot } from './common/media/sync-core'

async function bootstrap() {
  const BODY_LIMIT_BYTES = 15 * 1024 * 1024

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: BODY_LIMIT_BYTES,
      trustProxy: true,
    }),
  )

  const isDevelopment = process.env.NODE_ENV !== 'production'

  const helmetOptions: Record<string, unknown> = {}
  if (isDevelopment) {
    helmetOptions.contentSecurityPolicy = false
  }
  await app.register(helmet as any, Object.keys(helmetOptions).length ? helmetOptions : undefined)
const defaultAllowedOrigins = (
  process.env.DEFAULT_ALLOWED_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080'
)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  const allowedOrigins = Array.from(
    new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
  )

  const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, '')

  await app.register(cors as any, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true)
        return
      }

      if (isDevelopment) {
        cb(null, true)
        return
      }

      const normalizedOrigin = normalizeOrigin(origin)

      if (allowedOrigins.includes('*')) {
        cb(null, true)
        return
      }

      const match = allowedOrigins.find(
        (allowed) =>
          normalizedOrigin === normalizeOrigin(allowed) ||
          normalizedOrigin.endsWith(normalizeOrigin(allowed)),
      )

      if (match) {
        cb(null, true)
        return
      }

      cb(new Error('Origin not allowed'), false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  await app.register(cookie as any, {
    secret: resolveRequiredEnv('COOKIE_SECRET', {
      developmentFallback: 'local-dev-cookie-secret-change-me',
    }),
  })

  await app.register(multipart as any, {
    limits: {
      fileSize: BODY_LIMIT_BYTES,
    },
  })

  await app.register(fastifyStatic as any, {
    root: resolveMediaRoot(),
    prefix: '/media/',
    decorateReply: false,
  })

  await app.register(fastifyStatic as any, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  app.setGlobalPrefix('api')
  const exceptionFactory = (errors: ValidationError[]) => {
    const flat: { field: string; key: string; constraints?: Record<string, string> }[] = []
    const walk = (errs: ValidationError[], parent = '') => {
      for (const e of errs) {
        const path = parent ? `${parent}.${e.property}` : e.property
        if (e.constraints && Object.keys(e.constraints).length) {
          const constraintKeys = Object.keys(e.constraints)
          // Map known fields to translation keys
          let key = ''
          if (path === 'customerId') key = 'sales.orders.validation.customerRequired'
          if (path.startsWith('items')) key = 'sales.orders.validation.itemsRequired'
          if (!key) key = 'validation.fieldInvalid'
          flat.push({ field: path, key, constraints: e.constraints })
        }
        if (e.children && e.children.length) walk(e.children, path)
      }
    }
    walk(errors)
    return new BadRequestException({ message: 'errors.validation', errors: flat })
  }

  app.useGlobalPipes(
    new SanitizeInputPipe(),
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory }),
  )

  const port = Number(process.env.PORT || 4000)
  await app.listen({ port, host: '0.0.0.0' })
}
bootstrap()
