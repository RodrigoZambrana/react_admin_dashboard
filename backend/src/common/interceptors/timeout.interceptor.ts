import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs'
import { REQUEST_TIMEOUT_METADATA_KEY } from '../decorators/request-timeout.decorator'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeoutMs = this.resolveDefaultTimeout()

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const overrideTimeout = this.reflector.getAllAndOverride<number | null>(
      REQUEST_TIMEOUT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (overrideTimeout === null) {
      return next.handle()
    }

    const effectiveTimeout = this.normalizeTimeout(overrideTimeout) ?? this.defaultTimeoutMs

    if (!this.isPositiveTimeout(effectiveTimeout)) {
      return next.handle()
    }

    return next.handle().pipe(
      timeout({
        each: effectiveTimeout,
        with: () =>
          throwError(
            () =>
              new RequestTimeoutException({
                message: 'errors.timeout',
              }),
          ),
      }),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException({
                message: 'errors.timeout',
              }),
          )
        }
        return throwError(() => error)
      }),
    )
  }

  private resolveDefaultTimeout(): number | null {
    const raw = process.env.REQUEST_TIMEOUT_MS
    if (raw === undefined || raw === null || raw === '') {
      return 15_000
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return 15_000
    }
    if (parsed <= 0) {
      return null
    }
    return parsed
  }

  private normalizeTimeout(candidate: number | null | undefined): number | null {
    if (candidate === null || candidate === undefined) {
      return null
    }
    return Number.isFinite(candidate) && candidate > 0 ? candidate : null
  }

  private isPositiveTimeout(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
  }
}
