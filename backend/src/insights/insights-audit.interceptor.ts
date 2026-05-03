import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { finalize } from 'rxjs/operators'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class InsightsAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const startedAt = Date.now()
    const http = context.switchToHttp()
    const request = http.getRequest<{
      url?: string
      routeOptions?: { url?: string }
      routerPath?: string
      insightsPrincipal?: { subject?: string | null; userId?: string | null }
    }>()
    const response = http.getResponse<{ statusCode?: number }>()

    return next.handle().pipe(
      finalize(() => {
        const endpoint = (request.routeOptions?.url ?? request.routerPath ?? String(request.url ?? '')).split('?')[0]
        if (!endpoint.startsWith('/insights')) {
          return
        }
        const subject = request.insightsPrincipal?.userId ?? request.insightsPrincipal?.subject ?? null
        const statusCode = Number(response.statusCode ?? 500)
        const durationMs = Date.now() - startedAt

        void this.prisma.analyticsEndpointUsage
          .create({
            data: {
              endpoint,
              userId: subject ? String(subject) : null,
              statusCode,
              durationMs,
            },
          })
          .catch((error) => {
            // Best-effort telemetry only.
            // eslint-disable-next-line no-console
            console.error('[insights] endpoint usage tracking failed', error)
          })
      }),
    )
  }
}

