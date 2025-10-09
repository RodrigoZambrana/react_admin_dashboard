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

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  )

  await app.register(helmet as any)
  const defaultAllowedOrigins = ['http://localhost:5173']
  const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  const allowedOrigins = Array.from(
    new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
  )

  await app.register(cors as any, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes('*')) {
        cb(null, true)
        return
      }
      if (allowedOrigins.some((allowed) => origin === allowed || origin.endsWith(allowed))) {
        cb(null, true)
        return
      }
      cb(new Error('Origin not allowed'), false)
    },
    credentials: true,
  })

  await app.register(multipart as any, {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
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
    return new BadRequestException({ message: 'validation.failed', errors: flat })
  }

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory }),
  )

  const port = Number(process.env.PORT || 4000)
  await app.listen({ port, host: '0.0.0.0' })
}
bootstrap()
