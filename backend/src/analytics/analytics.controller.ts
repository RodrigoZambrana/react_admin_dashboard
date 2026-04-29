import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import type { AnalyticsEventInput } from './analytics.types'
import { AnalyticsService } from './analytics.service'
import { AnalyticsInsightsService } from './insights.service'
import { AnalyticsBaselineService } from './baseline.service'
import { AdsConnectorService } from './ads-connector.service'
import { SearchConsoleConnectorService } from './search-console-connector.service'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { BackfillJob } from './pipelines/backfill.job'
import { BaselineSyncJob } from './pipelines/baseline-sync.job'
import { DataQualityJob } from './pipelines/data-quality.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'
import { Ga4ConnectorService } from './ga4-connector.service'
import { AnalyticsReportingService } from './reporting/analytics-reporting.service'
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
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsInsightsService: AnalyticsInsightsService,
    private readonly baselineService: AnalyticsBaselineService,
    private readonly normalizeEventsJob: NormalizeEventsJob,
    private readonly backfillEventsJob: BackfillEventsJob,
    private readonly baselineSyncJob: BaselineSyncJob,
    private readonly dataQualityJob: DataQualityJob,
    private readonly backfillJob: BackfillJob,
    private readonly adsConnector: AdsConnectorService,
    private readonly ga4Connector: Ga4ConnectorService,
    private readonly searchConsoleConnector: SearchConsoleConnectorService,
    private readonly reportParity: AnalyticsReportingService,
  ) {}

  @Post('events')
  ingestEvent(@Body() body: AnalyticsEventInput) {
    return this.analyticsService.processEvent(body)
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
  getInsights(
    @Query() query: { from?: string; to?: string; reportKey?: string },
  ) {
    return this.analyticsInsightsService.getInsights({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('summary')
  getSummary(@Query() query: { from?: string; to?: string; reportKey?: string }) {
    return this.analyticsInsightsService.getSummary({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS)
  @Get('opportunities')
  getOpportunities(@Query() query: { from?: string; to?: string; reportKey?: string }) {
    return this.analyticsInsightsService.getOpportunities({
      from: query.from,
      to: query.to,
      reportKey: query.reportKey,
    })
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
