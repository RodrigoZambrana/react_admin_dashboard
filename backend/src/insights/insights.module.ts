import { Module } from '@nestjs/common'
import { AnalyticsModule } from '../analytics/analytics.module'
import { StorefrontModule } from '../storefront/storefront.module'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { InsightsAuditInterceptor } from './insights-audit.interceptor'
import { InsightsAuthGuard } from './insights-auth.guard'
import { InsightsController } from './insights.controller'
import { InsightsService } from './insights.service'

@Module({
  imports: [AnalyticsModule, StorefrontModule, SecureConfigModule],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsAuthGuard, InsightsAuditInterceptor],
  exports: [InsightsService],
})
export class InsightsModule {}
