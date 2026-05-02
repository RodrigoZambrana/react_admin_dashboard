import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  Redirect,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { AnalyticsEventInput, AnalyticsExportRunsResponse } from './analytics.types'
import { AnalyticsService } from './analytics.service'
import { AnalyticsInsightsService } from './insights.service'
import { AnalyticsBaselineService } from './baseline.service'
import { AnalyticsDataParityService } from './data-parity/analytics-data-parity.service'
import { AdsConnectorService } from './ads-connector.service'
import { SearchConsoleConnectorService } from './search-console-connector.service'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { BackfillJob } from './pipelines/backfill.job'
import { BaselineSyncJob } from './pipelines/baseline-sync.job'
import { DataQualityJob } from './pipelines/data-quality.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'
import { Ga4ConnectorService } from './ga4-connector.service'
import { AnalyticsReportingService } from './reporting/analytics-reporting.service'
import { AnalyticsHealthService } from './analytics-health.service'
import { AnalyticsDataTrustService } from './data-trust/analytics-data-trust.service'
import { AnalyticsUsageService } from './analytics-usage.service'
import { AnalyticsExportService } from './analytics-export.service'
import { AnalyticsEndpointUsageInterceptor } from './analytics-endpoint-usage.interceptor'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'

type FunnelQuery = {
  from?: string
  to?: string
  compare_from?: string
  compare_to?: string
  steps?: string
}

const resolveRedirectUrl = (
  returnPath: string | null | undefined,
  frontendOrigin: string | null | undefined,
  fallbackPath: string,
) => {
  const path = (returnPath ?? fallbackPath).trim()

  if (/^https?:\/\//iu.test(path)) {
    return path
  }

  const origin = frontendOrigin?.trim() || null
  if (origin) {
    try {
      return new URL(path, origin).toString()
    } catch {
      return path
    }
  }

  return path
}

@Controller('analytics')
@UseInterceptors(AnalyticsEndpointUsageInterceptor)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsInsightsService: AnalyticsInsightsService,
    private readonly baselineService: AnalyticsBaselineService,
    private readonly analyticsDataParityService: AnalyticsDataParityService,
    private readonly normalizeEventsJob: NormalizeEventsJob,
    private readonly backfillEventsJob: BackfillEventsJob,
    private readonly baselineSyncJob: BaselineSyncJob,
    private readonly dataQualityJob: DataQualityJob,
    private readonly backfillJob: BackfillJob,
    private readonly adsConnector: AdsConnectorService,
    private readonly ga4Connector: Ga4ConnectorService,
    private readonly searchConsoleConnector: SearchConsoleConnectorService,
    private readonly reportParity: AnalyticsReportingService,
    private readonly healthService: AnalyticsHealthService,
    private readonly dataTrustService: AnalyticsDataTrustService,
    private readonly analyticsUsageService: AnalyticsUsageService,
    private readonly analyticsExportService: AnalyticsExportService,
  ) {}

  @Post('events')
  ingestEvent(@Body() body: AnalyticsEventInput, @Req() req: FastifyRequest) {
    const forwardedFor = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : null
    const realIp = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : null
    const connectingIp =
      typeof req.headers['cf-connecting-ip'] === 'string' ? req.headers['cf-connecting-ip'] : null
    const clientIp =
      forwardedFor?.split(',')[0]?.trim() ||
      realIp?.trim() ||
      connectingIp?.trim() ||
      req.ip ||
      null

    return this.analyticsService.processEvent({
      ...body,
      client_ip_address: body.client_ip_address ?? clientIp,
    })
  }

  @Get('metrics/funnel')
  getFunnelMetrics(@Query() query: FunnelQuery) {
    const steps =
      typeof query.steps === 'string'
        ? query.steps
            .split(',')
            .map((step) => step.trim())
            .filter(Boolean)
        : undefined

    return this.analyticsService.getFunnelMetrics({
      from: query.from,
      to: query.to,
      compareFrom: query.compare_from,
      compareTo: query.compare_to,
      steps,
    })
  }

  @Get('dashboard')
  getDashboardMetrics(@Query() query: { from?: string; to?: string }) {
    return this.analyticsService.getDashboardMetrics({
      from: query.from,
      to: query.to,
    })
  }

  @Get('structural-quality')
  getStructuralQuality(@Query() query: { from?: string; to?: string }) {
    return this.analyticsService.getStructuralQuality({
      from: query.from,
      to: query.to,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('marketing/meta')
  getMetaMarketingMetrics(@Query() query: { from?: string; to?: string }) {
    return this.analyticsService.getMetaMarketingMetrics({
      from: query.from,
      to: query.to,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('connections')
  getConnections() {
    return this.analyticsService.getConnections()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('sync-runs')
  getSyncRuns(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.analyticsService.getSyncRuns(Number.isFinite(limit) && limit > 0 ? limit : 50)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('insights')
  async getInsights(
    @Query() query: { from?: string; to?: string; reportKey?: string },
  ) {
    const result = await this.analyticsInsightsService.getInsights({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
    return result
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('summary')
  async getSummary(@Query() query: { from?: string; to?: string; reportKey?: string }) {
    const result = await this.analyticsInsightsService.getSummary({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
    return result
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('opportunities')
  async getOpportunities(
    @Query() query: { from?: string; to?: string; reportKey?: string },
  ) {
    const result = await this.analyticsInsightsService.getOpportunities({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
    return result
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('data-parity')
  getDataParity(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 100)
    return this.analyticsDataParityService.getParityOverview(Number.isFinite(limit) && limit > 0 ? limit : 100)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('usage')
  getUsage(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 100)
    return this.analyticsUsageService.getUsageOverview(Number.isFinite(limit) && limit > 0 ? limit : 100)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('export/canonical')
  async exportCanonical(
    @Query()
    query: { from?: string; to?: string; source?: 'ga4' | 'ads' | 'search_console' | 'all'; granularity?: 'daily' },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!query.from || !query.to) {
      throw new BadRequestException('from and to are required')
    }

    const { stream, filename, metadata } = await this.analyticsExportService.exportCanonical({
      from: query.from,
      to: query.to,
      source: query.source ?? 'all',
      granularity: query.granularity ?? 'daily',
    })

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('X-Analytics-Export-Metadata', JSON.stringify(metadata))
    return reply.send(stream)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('export/report')
  async exportReport(
    @Query()
    query: { report?: 'ga4_overview' | 'ads_campaigns' | 'seo_pages'; from?: string; to?: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!query.report) {
      throw new BadRequestException('report is required')
    }
    if (!query.from || !query.to) {
      throw new BadRequestException('from and to are required')
    }

    const { stream, filename, metadata } = await this.analyticsExportService.exportReport({
      report: query.report,
      from: query.from,
      to: query.to,
    })

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('X-Analytics-Export-Metadata', JSON.stringify(metadata))
    return reply.send(stream)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('export/runs')
  getExportRuns(
    @Query()
    query: {
      limit?: string
      offset?: string
      exportType?: 'canonical' | 'report'
      source?: 'ga4' | 'ads' | 'search_console' | 'unified'
      status?: 'running' | 'success' | 'error'
    },
  ): Promise<AnalyticsExportRunsResponse> {
    const limit = Number(query.limit ?? 20)
    const offset = Number(query.offset ?? 0)
    return this.analyticsExportService.listRuns({
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
      offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
      exportType: query.exportType ?? null,
      source: query.source ?? null,
      status: query.status ?? null,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('export/runs/:id')
  async getExportRun(@Param('id') id: string) {
    const run = await this.analyticsExportService.getRun(id)
    if (!run) {
      throw new NotFoundException('Export run not found')
    }
    return run
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('insights/history')
  getInsightsHistory(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 100)
    return this.analyticsInsightsService.getHistory(Number.isFinite(limit) && limit > 0 ? limit : 100)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('insights/recompute')
  recomputeInsights(@Body() body?: { from?: string; to?: string; reportKey?: string }) {
    return this.analyticsInsightsService.recompute({
      from: body?.from,
      to: body?.to,
      reportKey: body?.reportKey,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('insights/bundle')
  getInsightsBundle(@Query() query: { from?: string; to?: string; reportKey?: string }) {
    return this.analyticsInsightsService.getInsightBundle({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/ga4/start')
  startGa4OAuth(@Body() body?: { returnPath?: string }, @Req() req?: FastifyRequest) {
    const frontendOrigin = typeof req?.headers.origin === 'string' ? req.headers.origin : null
    return this.ga4Connector.startOAuth(body?.returnPath, frontendOrigin)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/ads/start')
  startAdsOAuth(@Body() body?: { returnPath?: string }, @Req() req?: FastifyRequest) {
    const frontendOrigin = typeof req?.headers.origin === 'string' ? req.headers.origin : null
    return this.adsConnector.startOAuth(body?.returnPath, frontendOrigin)
  }

  @Redirect()
  @Get('connections/ga4/callback')
  async completeGa4OAuth(
    @Query() query: { state?: string; code?: string; error?: string; error_description?: string },
  ) {
    try {
      const sources = [
        {
          key: 'ga4',
          complete: () => this.ga4Connector.completeOAuth(query),
        },
        {
          key: 'ads',
          complete: () => this.adsConnector.completeOAuth(query),
        },
        {
          key: 'search_console',
          complete: () => this.searchConsoleConnector.completeOAuth(query),
        },
      ] as const

      let lastError: unknown = null
      for (const source of sources) {
        try {
          const result = await source.complete()
          const returnUrl = resolveRedirectUrl(
            result.returnPath,
            result.frontendOrigin,
            '/app/analytics/connections',
          )
          const separator = returnUrl.includes('?') ? '&' : '?'
          return {
            url: `${returnUrl}${separator}${source.key}=connected&connectionId=${encodeURIComponent(result.connectionId)}`,
          }
        } catch (error) {
          lastError = error
          const message = error instanceof Error ? error.message : String(error)
          if (
            !/OAuth session not found or expired|Missing OAuth state|OAuth session expired/iu.test(
              message,
            )
          ) {
            throw error
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Unable to complete OAuth flow.')
    } catch (error) {
      return {
        url: '/app/analytics/connections?ga4=error',
      }
    }
  }

  @Redirect()
  @Get('connections/ads/callback')
  async completeAdsOAuth(
    @Query() query: { state?: string; code?: string; error?: string; error_description?: string },
  ) {
    try {
      const result = await this.adsConnector.completeOAuth(query)
      const returnUrl = resolveRedirectUrl(
        result.returnPath,
        result.frontendOrigin,
        '/app/analytics/connections',
      )
      const separator = returnUrl.includes('?') ? '&' : '?'
      return {
        url: `${returnUrl}${separator}ads=connected&connectionId=${encodeURIComponent(result.connectionId)}`,
      }
    } catch (error) {
      return {
        url: '/app/analytics/connections?ads=error',
      }
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('connections/:connectionId/ga4/properties')
  async getGa4Properties(@Param('connectionId') connectionId: string) {
    return {
      properties: await this.ga4Connector.listProperties(connectionId),
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Put('connections/:connectionId/ga4/property')
  selectGa4Property(
    @Param('connectionId') connectionId: string,
    @Body() body: { propertyId?: string },
  ) {
    if (!body.propertyId) {
      throw new BadRequestException('propertyId is required')
    }
    return this.ga4Connector.selectProperty(connectionId, body.propertyId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/initial-sync')
  runGa4InitialSync(@Param('connectionId') connectionId: string) {
    return this.ga4Connector.runInitialSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/incremental-sync')
  runGa4IncrementalSync(@Param('connectionId') connectionId: string) {
    return this.ga4Connector.runIncrementalSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/backfill')
  runGa4Backfill(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.ga4Connector.runBackfill(connectionId, body?.from, body?.to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/repair')
  runGa4Repair(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.ga4Connector.runRepair(connectionId, body?.from, body?.to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/report-sync')
  runGa4ReportSync(
    @Param('connectionId') connectionId: string,
    @Body() body?: { from?: string; to?: string; reportKey?: string },
  ) {
    return this.ga4Connector.runCanonicalReportSync(
      connectionId,
      body?.from,
      body?.to,
      body?.reportKey,
    )
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/baseline-sync')
  runGa4BaselineSync(
    @Param('connectionId') connectionId: string,
    @Body() body?: { from?: string; to?: string; reportKey?: string },
  ) {
    return this.baselineSyncJob.run(connectionId, body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/data-quality')
  runGa4DataQuality(
    @Param('connectionId') connectionId: string,
    @Body() body?: { from?: string; to?: string; reportKey?: string },
  ) {
    return this.dataQualityJob.run({
      connectionId,
      reportKey: body?.reportKey,
      from: body?.from,
      to: body?.to,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ga4/backfill-quality')
  runGa4BackfillQuality(
    @Param('connectionId') connectionId: string,
    @Body() body?: { from?: string; to?: string; reportKey?: string },
  ) {
    if (!body?.from || !body?.to) {
      throw new BadRequestException('from and to are required')
    }

    const input = body as { from: string; to: string; reportKey?: string }
    return this.backfillJob.run({
      connectionId,
      from: input.from,
      to: input.to,
      reportKey: input.reportKey,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('baseline-snapshots')
  getBaselineSnapshots(@Query() query: { limit?: string; reportKey?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.baselineService.listSnapshots(Number.isFinite(limit) && limit > 0 ? limit : 50, query.reportKey)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('data-quality')
  getDataQuality(@Query() query: { limit?: string; reportKey?: string }) {
    const limit = Number(query.limit ?? 100)
    return this.reportParity.getDataQualityChecks(
      Number.isFinite(limit) && limit > 0 ? limit : 100,
      query.reportKey,
    )
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('insights/input')
  getInsightsInput(
    @Query() query: { connectionId?: string; reportKey?: string; from?: string; to?: string },
  ) {
    if (!query.connectionId) {
      throw new BadRequestException('connectionId is required')
    }
    return this.reportParity.getInsightsInput({
      connectionId: query.connectionId,
      reportKey: query.reportKey,
      from: query.from,
      to: query.to,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ads/initial-sync')
  runAdsInitialSync(@Param('connectionId') connectionId: string) {
    return this.adsConnector.runInitialSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ads/incremental-sync')
  runAdsIncrementalSync(@Param('connectionId') connectionId: string) {
    return this.adsConnector.runIncrementalSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ads/backfill')
  runAdsBackfill(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.adsConnector.runBackfill(connectionId, body?.from, body?.to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/ads/repair')
  runAdsRepair(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.adsConnector.runRepair(connectionId, body?.from, body?.to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/search-console/start')
  startSearchConsoleOAuth(@Body() body?: { returnPath?: string }, @Req() req?: FastifyRequest) {
    const frontendOrigin = typeof req?.headers.origin === 'string' ? req.headers.origin : null
    return this.searchConsoleConnector.startOAuth(body?.returnPath, frontendOrigin)
  }

  @Redirect()
  @Get('connections/search-console/callback')
  async completeSearchConsoleOAuth(
    @Query() query: { state?: string; code?: string; error?: string; error_description?: string },
  ) {
    try {
      const result = await this.searchConsoleConnector.completeOAuth(query)
      const returnUrl = resolveRedirectUrl(
        result.returnPath,
        result.frontendOrigin,
        '/app/analytics/connections',
      )
      const separator = returnUrl.includes('?') ? '&' : '?'
      return {
        url: `${returnUrl}${separator}search_console=connected&connectionId=${encodeURIComponent(result.connectionId)}`,
      }
    } catch (error) {
      return {
        url: '/app/analytics/connections?search_console=error',
      }
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('connections/:connectionId/search-console/properties')
  async getSearchConsoleProperties(@Param('connectionId') connectionId: string) {
    return {
      properties: await this.searchConsoleConnector.listProperties(connectionId),
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Put('connections/:connectionId/search-console/property')
  selectSearchConsoleProperty(
    @Param('connectionId') connectionId: string,
    @Body() body: { propertyId?: string },
  ) {
    if (!body.propertyId) {
      throw new BadRequestException('propertyId is required')
    }
    return this.searchConsoleConnector.selectProperty(connectionId, body.propertyId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/search-console/initial-sync')
  runSearchConsoleInitialSync(@Param('connectionId') connectionId: string) {
    return this.searchConsoleConnector.runInitialSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/search-console/incremental-sync')
  runSearchConsoleIncrementalSync(@Param('connectionId') connectionId: string) {
    return this.searchConsoleConnector.runIncrementalSync(connectionId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/search-console/backfill')
  runSearchConsoleBackfill(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.searchConsoleConnector.runBackfill(connectionId, body?.from, body?.to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('connections/:connectionId/search-console/repair')
  runSearchConsoleRepair(
    @Param('connectionId') connectionId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.searchConsoleConnector.runRepair(connectionId, body?.from, body?.to)
  }

  @Get('overview')
  getOverviewMetrics(
    @Query() query: { from?: string; to?: string; compare_from?: string; compare_to?: string },
  ) {
    return this.analyticsService.getDashboardMetrics({
      from: query.from,
      to: query.to,
      compareFrom: query.compare_from,
      compareTo: query.compare_to,
    })
  }

  @Get('funnel')
  getFunnel(@Query() query: FunnelQuery) {
    return this.getFunnelMetrics(query)
  }

  @Post('pipelines/normalize-events/run')
  runNormalizationBatch(@Body() body?: { limit?: number }) {
    return this.normalizeEventsJob.run(body?.limit)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('reports/catalog')
  getReportCatalog() {
    return this.reportParity.listCatalog()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('reports/runs')
  getReportRuns(@Query() query: { limit?: string; reportKey?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.reportParity.listRuns(Number.isFinite(limit) && limit > 0 ? limit : 50, query.reportKey)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('reports/reconciliations')
  getReportReconciliations(@Query() query: { limit?: string; reportKey?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.reportParity.listReconciliations(
      Number.isFinite(limit) && limit > 0 ? limit : 50,
      query.reportKey,
    )
  }

  @Get('health')
  getHealth(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 20)
    return this.healthService.getHealthOverview(Number.isFinite(limit) && limit > 0 ? limit : 20)
  }

  @Get('health/status')
  getHealthStatus() {
    return this.healthService.getHealthStatus()
  }

  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Get('health/badge')
  getHealthBadge() {
    return this.healthService.getHealthBadge()
  }

  @Get('health/history')
  getHealthHistory(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.healthService.getHealthHistory(Number.isFinite(limit) && limit > 0 ? limit : 50)
  }

  @Get('data-trust')
  getDataTrust(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 10)
    return this.dataTrustService.getOverview(Number.isFinite(limit) && limit > 0 ? limit : 10)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('reports/import-baseline')
  importReportBaseline(@Body() body: { filePath?: string }) {
    if (!body.filePath) {
      throw new BadRequestException('filePath is required')
    }
    return this.reportParity.importBaselineFromPath(body.filePath)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Post('reports/reconcile')
  reconcileReports(@Body() body?: { reportKey?: string }) {
    if (body?.reportKey) {
      return this.reportParity.reconcileReport(body.reportKey)
    }
    return this.reportParity.reconcileAllReports()
  }

  @Post('pipelines/backfill-events/run')
  runBackfill(@Body() body?: { from?: string; to?: string; batchSize?: number }) {
    return this.backfillEventsJob.run(body?.from, body?.to, body?.batchSize)
  }
}
