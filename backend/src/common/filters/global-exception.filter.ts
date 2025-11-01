import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library'
import { PrismaQueryTimeoutError } from '../../prisma/errors/prisma-query-timeout.error'
import { ErrorCode, type StandardErrorEnvelope } from '../errors/error-codes'
import { ObservabilityService } from '../observability/observability.service'

const MESSAGE_BY_CODE: Record<ErrorCode, string> = {
  [ErrorCode.BACKEND_TIMEOUT]: 'errors.timeout',
  [ErrorCode.DB_CONNECTION]: 'errors.dbConnection',
  [ErrorCode.DB_CONFLICT]: 'errors.conflict',
  [ErrorCode.DB_PANIC]: 'errors.dbPanic',
  [ErrorCode.DB_TIMEOUT]: 'errors.dbTimeout',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'errors.unauthorized',
  [ErrorCode.AUTH_FORBIDDEN]: 'errors.forbidden',
  [ErrorCode.VALIDATION_FAILED]: 'errors.validation',
  [ErrorCode.RATE_LIMITED]: 'errors.rateLimited',
  [ErrorCode.NOT_FOUND]: 'errors.notFound',
  [ErrorCode.CONFLICT]: 'errors.conflict',
  [ErrorCode.UNKNOWN]: 'errors.unknown',
}

type CorrelatedFastifyRequest = FastifyRequest & {
  correlationId?: string
  user?: { id?: number; sub?: number | string }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly observability: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<CorrelatedFastifyRequest>()
    const correlationId =
      request.correlationId && request.correlationId.length
        ? request.correlationId
        : randomUUID()

    const { statusCode, envelope, retryAfterSeconds } =
      this.normalizeException(exception, correlationId)

    response.header('cache-control', 'no-store, no-cache, max-age=0')
    response.header('pragma', 'no-cache')
    response.header('content-type', 'application/json; charset=utf-8')
    response.header('x-correlation-id', correlationId)
    response.header('x-request-id', correlationId)
    if (retryAfterSeconds) {
      response.header('retry-after', String(retryAfterSeconds))
    }

    const logPayload = {
      correlationId,
      method: request.method,
      path: request.url,
      userId: this.extractUserId(request.user),
      code: envelope.error.code,
      statusCode,
    }

    if (request.log) {
      request.log.error(
        {
          ...logPayload,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        'Request failed',
      )
    } else {
      // eslint-disable-next-line no-console
      console.error('Request failed', {
        ...logPayload,
        error:
          exception instanceof Error
            ? { message: exception.message, stack: exception.stack }
            : exception,
      })
    }

    this.observability.recordHttpError(envelope.error.code, statusCode)
    this.observability.captureException(exception, {
      ...logPayload,
      correlationId,
    })

    response.status(statusCode).send(envelope)
  }

  private normalizeException(
    exception: unknown,
    correlationId: string,
  ): {
    statusCode: number
    envelope: StandardErrorEnvelope
    retryAfterSeconds?: number
  } {
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaKnownError(exception, correlationId)
    }
    if (exception instanceof PrismaClientInitializationError) {
      return this.buildEnvelope(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DB_CONNECTION,
        correlationId,
        { reason: 'unavailable' },
      )
    }
    if (exception instanceof PrismaClientRustPanicError) {
      return this.buildEnvelope(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.DB_PANIC,
        correlationId,
      )
    }
    if (exception instanceof PrismaClientValidationError) {
      return this.buildEnvelope(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.VALIDATION_FAILED,
        correlationId,
      )
    }
    if (exception instanceof PrismaQueryTimeoutError) {
      const detailPayload: Record<string, unknown> = {
        timeoutMs: exception.timeoutMs,
      }
      if (exception.model) {
        detailPayload.model = exception.model
      }
      if (exception.action) {
        detailPayload.action = exception.action
      }
      return this.buildEnvelope(
        HttpStatus.GATEWAY_TIMEOUT,
        ErrorCode.DB_TIMEOUT,
        correlationId,
        detailPayload,
      )
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, correlationId)
    }

    if (exception instanceof Error && exception.name === 'TimeoutError') {
      return this.buildEnvelope(
        HttpStatus.GATEWAY_TIMEOUT,
        ErrorCode.BACKEND_TIMEOUT,
        correlationId,
      )
    }

    return this.buildEnvelope(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.UNKNOWN,
      correlationId,
    )
  }

  private handleHttpException(
    exception: HttpException,
    correlationId: string,
  ): {
    statusCode: number
    envelope: StandardErrorEnvelope
    retryAfterSeconds?: number
  } {
    const statusCode = exception.getStatus()
    const payload = exception.getResponse()

    let code = this.mapHttpStatusToCode(statusCode)
    let message = MESSAGE_BY_CODE[code]
    let details: Record<string, unknown> | undefined
    let retryAfterSeconds: number | undefined

    if (exception instanceof ThrottlerException) {
      const ttl = Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000)
      retryAfterSeconds = Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl / 1000) : 60
      code = ErrorCode.RATE_LIMITED
      message = MESSAGE_BY_CODE[code]
    }

    if (typeof payload === 'string') {
      message = this.sanitizeMessageKey(payload, message)
    } else if (Array.isArray(payload)) {
      details = { errors: payload }
    } else if (payload && typeof payload === 'object') {
      const responseBody = payload as Record<string, unknown>
      const providedMessage = responseBody.message
      if (typeof providedMessage === 'string') {
        message = this.sanitizeMessageKey(providedMessage, message)
      }

      const { errors, details: explicitDetails, ...rest } = responseBody

      if (errors && typeof errors === 'object') {
        details = { ...(details ?? {}), errors }
      }
      if (explicitDetails && typeof explicitDetails === 'object') {
        details = { ...(details ?? {}), ...explicitDetails }
      }

      const sanitizedRest = this.pickSanitizedDetails(rest)
      if (Object.keys(sanitizedRest).length) {
        details = { ...(details ?? {}), ...sanitizedRest }
      }
    }

    if (retryAfterSeconds) {
      details = { ...(details ?? {}), retryAfter: retryAfterSeconds }
    }

    return {
      statusCode,
      envelope: this.createEnvelope({
        statusCode,
        code,
        message,
        details,
        correlationId,
      }),
      retryAfterSeconds,
    }
  }

  private handlePrismaKnownError(
    error: PrismaClientKnownRequestError,
    correlationId: string,
  ) {
    if (error.code === 'P2002') {
      return this.buildEnvelope(
        HttpStatus.CONFLICT,
        ErrorCode.DB_CONFLICT,
        correlationId,
        {
          fields:
            Array.isArray(error.meta?.target) || typeof error.meta?.target === 'string'
              ? error.meta?.target
              : undefined,
        },
      )
    }
    if (error.code === 'P2025') {
      return this.buildEnvelope(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        correlationId,
      )
    }
    if (error.code === 'P2024') {
      return this.buildEnvelope(
        HttpStatus.GATEWAY_TIMEOUT,
        ErrorCode.DB_TIMEOUT,
        correlationId,
      )
    }

    return this.buildEnvelope(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.UNKNOWN,
      correlationId,
    )
  }

  private buildEnvelope(
    statusCode: number,
    code: ErrorCode,
    correlationId: string,
    details?: Record<string, unknown> | undefined,
  ): {
    statusCode: number
    envelope: StandardErrorEnvelope
  } {
    return {
      statusCode,
      envelope: this.createEnvelope({
        statusCode,
        code,
        message: MESSAGE_BY_CODE[code],
        details,
        correlationId,
      }),
    }
  }

  private createEnvelope(params: {
    statusCode: number
    code: ErrorCode
    message?: string
    details?: Record<string, unknown>
    correlationId: string
  }): StandardErrorEnvelope {
    const { statusCode, code, message, details, correlationId } = params
    return {
      ok: false,
      error: {
        code,
        httpStatus: statusCode,
        message: message ?? MESSAGE_BY_CODE[code] ?? MESSAGE_BY_CODE[ErrorCode.UNKNOWN],
        details: details ?? null,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    }
  }

  private sanitizeMessageKey(candidate: string, fallback: string): string {
    const trimmed = candidate.trim()
    if (!trimmed.length) {
      return fallback
    }

    if (trimmed.toLowerCase().includes('prisma')) {
      return fallback
    }

    if (trimmed.toLowerCase().includes('sql')) {
      return fallback
    }

    if (!trimmed.includes('.')) {
      return fallback
    }

    return trimmed
  }

  private pickSanitizedDetails(input: Record<string, unknown>) {
    const clone: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (['statusCode', 'error', 'path', 'timestamp'].includes(key)) {
        continue
      }
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed.length) continue
        if (trimmed.toLowerCase().includes('prisma')) continue
        if (trimmed.toLowerCase().includes('sql')) continue
        clone[key] = trimmed
        continue
      }
      if (value === null || value === undefined) continue
      if (typeof value === 'object') {
        clone[key] = value
        continue
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        clone[key] = value
      }
    }
    return clone
  }

  private mapHttpStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.REQUEST_TIMEOUT:
      case HttpStatus.GATEWAY_TIMEOUT:
        return ErrorCode.BACKEND_TIMEOUT
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_FAILED
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.DB_CONNECTION
      default:
        return ErrorCode.UNKNOWN
    }
  }

  private extractUserId(
    user: CorrelatedFastifyRequest['user'],
  ): number | string | undefined {
    if (!user) {
      return undefined
    }
    if (typeof user.id !== 'undefined') {
      return user.id
    }
    if (typeof user.sub !== 'undefined') {
      return user.sub
    }
    return undefined
  }
}
