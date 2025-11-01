import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaQueryTimeoutError } from './errors/prisma-query-timeout.error'

const DEFAULT_PRISMA_TIMEOUT_MS = 15_000

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly queryTimeoutMs: number

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['error', 'warn'],
    })
    const parsedTimeout = Number(process.env.PRISMA_QUERY_TIMEOUT_MS)
    this.queryTimeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_PRISMA_TIMEOUT_MS

    this.registerQueryTimeoutGuard()
  }

  async onModuleInit() {
    await this.$connect()
  }

  async enableShutdownHooks(_app: INestApplication) {}

  private registerQueryTimeoutGuard() {
    const client = this as any
    if (typeof client.$use !== 'function') {
      return
    }
    client.$use(async (params, next) => {
      const timeoutError = new PrismaQueryTimeoutError(
        this.queryTimeoutMs,
        params.model,
        params.action,
      )
      let timer: NodeJS.Timeout | undefined

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError), this.queryTimeoutMs)
      })

      const queryPromise = next(params)

      try {
        return await Promise.race([queryPromise, timeoutPromise])
      } catch (error) {
        if (error === timeoutError) {
          queryPromise.catch((reason) => {
            if (reason instanceof Error) {
              // eslint-disable-next-line no-console
              console.warn('[prisma] Query resolved after timeout', {
                model: params.model,
                action: params.action,
                reason: reason.message,
              })
            }
          })
          throw timeoutError
        }
        throw error
      } finally {
        if (timer) {
          clearTimeout(timer)
        }
      }
    })
  }
}
