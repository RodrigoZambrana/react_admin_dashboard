import { Injectable, Logger } from '@nestjs/common'

type SentryLike = {
  captureException: (error: unknown, context?: Record<string, unknown>) => void
  captureMessage?: (message: string, options?: Record<string, unknown>) => void
}

interface ErrorMetric {
  code: string
  httpStatus: number
  count: number
  lastAt: number
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name)
  private sentry: SentryLike | null = null
  private readonly errorCounters = new Map<string, ErrorMetric>()

  constructor() {
    const dsn = process.env.SENTRY_DSN
    if (!dsn) {
      return
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sentryModule = require('@sentry/node') as SentryLike & {
        init?: (options: Record<string, unknown>) => void
      }
      if (typeof sentryModule.init === 'function') {
        sentryModule.init({
          dsn,
          environment: process.env.NODE_ENV ?? 'development',
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
        })
      }
      this.sentry = sentryModule
      this.logger.log('Sentry observability enabled')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
        this.logger.warn(`Failed to initialise Sentry: ${(error as Error).message}`)
      } else {
        this.logger.debug('Sentry SDK not installed. Skipping instrumentation.')
      }
    }
  }

  captureException(error: unknown, context: Record<string, unknown> = {}) {
    if (this.sentry) {
      try {
        this.sentry.captureException(error, { extra: context })
      } catch (captureError) {
        this.logger.warn(`Unable to forward error to Sentry: ${(captureError as Error).message}`)
      }
      return
    }
    this.logger.debug('captureException invoked without Sentry. Context: %o', context)
  }

  recordHttpError(code: string, httpStatus: number) {
    const key = `${code}:${httpStatus}`
    const existing = this.errorCounters.get(key)
    const now = Date.now()
    if (existing) {
      existing.count += 1
      existing.lastAt = now
      this.errorCounters.set(key, existing)
    } else {
      this.errorCounters.set(key, { code, httpStatus, count: 1, lastAt: now })
    }
  }

  snapshotErrorMetrics(): ErrorMetric[] {
    return Array.from(this.errorCounters.values())
  }
}
