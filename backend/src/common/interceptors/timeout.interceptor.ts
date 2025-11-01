import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common'
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15_000)

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout({
        each: this.timeoutMs,
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
}
