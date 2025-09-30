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

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  )

  await app.register(helmet as any)
  await app.register(cors as any, {
    origin: true,
    credentials: true,
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
