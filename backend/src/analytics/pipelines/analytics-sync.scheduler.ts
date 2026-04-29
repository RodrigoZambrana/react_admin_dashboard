import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { AnalyticsRepository } from '../analytics.repository'
import { AdsConnectorService } from '../ads-connector.service'
import { Ga4ConnectorService } from '../ga4-connector.service'
import { SearchConsoleConnectorService } from '../search-console-connector.service'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const SYNCABLE_SOURCES = new Set(['ga4', 'ads', 'search_console'])

@Injectable()
export class AnalyticsSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsSyncScheduler.name)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly ga4Connector: Ga4ConnectorService,
    private readonly adsConnector: AdsConnectorService,
    private readonly searchConsoleConnector: SearchConsoleConnectorService,
  ) {}

  onModuleInit() {
    void this.run()
    this.timer = setInterval(() => {
      void this.run()
    }, FIVE_MINUTES_MS)
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async run() {
    if (this.running) {
      return
    }

    this.running = true
    try {
      const now = Date.now()
      const connections = await this.repository.listConnections()
      const dueConnections = connections.filter((connection) => {
        if (!SYNCABLE_SOURCES.has(connection.source)) {
          return false
        }
        if (connection.status === 'syncing' || connection.needsReauth) {
          return false
        }
        if (!connection.nextSyncAt) {
          return false
        }
        const nextSyncAt = new Date(connection.nextSyncAt).getTime()
        return Number.isFinite(nextSyncAt) && nextSyncAt <= now
      })

      for (const connection of dueConnections) {
        try {
          switch (connection.source) {
            case 'ga4':
              await this.ga4Connector.runIncrementalSync(connection.id)
              break
            case 'ads':
              await this.adsConnector.runIncrementalSync(connection.id)
              break
            case 'search_console':
              await this.searchConsoleConnector.runIncrementalSync(connection.id)
              break
            default:
              break
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(
            `Analytics scheduler could not sync ${connection.source} connection ${connection.id}: ${message}`,
          )
        }
      }
    } finally {
      this.running = false
    }
  }
}
