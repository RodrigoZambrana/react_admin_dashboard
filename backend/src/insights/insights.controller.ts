import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { InsightsAuditInterceptor } from './insights-audit.interceptor'
import { InsightsAuthGuard } from './insights-auth.guard'
import { InsightsScopes } from './insights-scopes.decorator'
import { InsightsService } from './insights.service'
import type { InsightsResponse, InsightsScope } from './insights.types'
import { StorefrontProductQueryDto } from '../storefront/dto/product-query.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'

@Controller('insights')
@UseGuards(InsightsAuthGuard)
@UseInterceptors(InsightsAuditInterceptor)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('products/search')
  @InsightsScopes('read:products')
  async searchProducts(@Query() query: StorefrontProductQueryDto) {
    return this.insightsService.getProductsSearch(query)
  }

  @Get('products/performance')
  @InsightsScopes('read:products')
  async getProductsPerformance(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getProductsPerformance({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('search/queries')
  @InsightsScopes('read:search')
  async getSearchQueries(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getSearchQueries({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('search/performance')
  @InsightsScopes('read:search')
  async getSearchPerformance(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getSearchPerformance({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('analytics/funnels')
  @InsightsScopes('read:funnels')
  async getFunnels(
    @Query() query: { from?: string; to?: string; compareFrom?: string; compareTo?: string; steps?: string },
  ) {
    return this.insightsService.getFunnels({
      from: query.from,
      to: query.to,
      compareFrom: query.compareFrom,
      compareTo: query.compareTo,
      steps: query.steps ? query.steps.split(',').map((step) => step.trim()).filter(Boolean) : undefined,
    })
  }

  @Get('analytics/ctas')
  @InsightsScopes('read:analytics')
  async getCtas(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getCtas({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('analytics/sessions')
  @InsightsScopes('read:analytics')
  async getSessions(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getSessions({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('external/ga/traffic')
  @InsightsScopes('read:analytics')
  async getGaTraffic(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getExternalGaTraffic({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('external/ads/campaigns')
  @InsightsScopes('read:ads')
  async getAdsCampaigns(@Query() query: { from?: string; to?: string; limit?: string }) {
    return this.insightsService.getExternalAdsCampaigns({
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get('sources/quality')
  @InsightsScopes('read:analytics')
  async getQuality(): Promise<InsightsResponse<{ source: string; status: string }>> {
    return this.insightsService.getSourceQualityEnvelope()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  @Get('service-keys')
  async listServiceKeys() {
    return this.insightsService.listServiceKeys()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  @Post('service-keys')
  async createServiceKey(
    @Body()
    body: {
      name?: string | null
      scopes?: InsightsScope[]
      expiresAt?: string | null
      enabled?: boolean
    },
  ) {
    return this.insightsService.createServiceKey({
      name: body?.name ?? null,
      scopes: body?.scopes,
      expiresAt: body?.expiresAt ?? null,
      enabled: body?.enabled,
    })
  }
}
