import { Injectable, NestMiddleware } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'

type CorrelatedRequest = FastifyRequest & { correlationId?: string }

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: CorrelatedRequest, res: FastifyReply, next: () => void): void {
    const headerValue =
      (req.headers['x-correlation-id'] as string | undefined) ||
      (req.headers['x-request-id'] as string | undefined)
    const candidate =
      typeof headerValue === 'string' && headerValue.trim().length
        ? headerValue.trim()
        : undefined
    const correlationId = candidate ?? randomUUID()

    req.correlationId = correlationId

    if (typeof res.header === 'function') {
      res.header('x-correlation-id', correlationId)
      res.header('x-request-id', correlationId)
    }

    if (req.log?.child) {
      req.log = req.log.child({ correlationId })
    }

    next()
  }
}
