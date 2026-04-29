import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { finalize } from 'rxjs/operators'

import { AnalyticsUsageService } from './analytics-usage.service'

const EXCLUDED_ENDPOINTS = ['/analytics/usage']

@Injectable()
export class AnalyticsEndpointUsageInterceptor implements NestInterceptor {
  constructor(private readonly analyticsUsageService: AnalyticsUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const startedAt = Date.now()
    const http = context.switchToHttp()
    const request = http.getRequest<{ url?: string; user?: { id?: string | number; sub?: string | number } }>()
    const response = http.getResponse<{ statusCode?: number }>()

    return next.handle().pipe(
      finalize(() => {
        const route = request as {
          routeOptions?: { url?: string }
          routerPath?: string
          url?: string
        }
        const endpoint = (route.routeOptions?.url ?? route.routerPath ?? String(route.url ?? '')).split('?')[0]
        if (!endpoint.startsWith('/analytics') || EXCLUDED_ENDPOINTS.includes(endpoint)) {
          return
        }

        const rawUserId = request.user?.id ?? request.user?.sub ?? null
        const userId =
          rawUserId === null || rawUserId === undefined ? null : String(rawUserId)
        const statusCode = Number(response.statusCode ?? 500)
        const durationMs = Date.now() - startedAt

        void this.analyticsUsageService
          .recordEndpointUsage({
            endpoint,
            userId,
            statusCode,
            durationMs,
          })
          .catch((error) => {
            // Best-effort telemetry only.
            // eslint-disable-next-line no-console
            console.error('[analytics] endpoint usage tracking failed', error)
          })
      }),
    )
  }
}
