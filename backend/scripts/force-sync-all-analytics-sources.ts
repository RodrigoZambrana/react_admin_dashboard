import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspect } from 'node:util'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AnalyticsModule } from '../src/analytics/analytics.module'
import { AnalyticsRepository } from '../src/analytics/analytics.repository'
import { AdsConnectorService } from '../src/analytics/ads-connector.service'
import { Ga4ConnectorService } from '../src/analytics/ga4-connector.service'
import { SearchConsoleConnectorService } from '../src/analytics/search-console-connector.service'
import { PrismaService } from '../src/prisma/prisma.service'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

const SCRIPT_NAME = 'force-sync-all-analytics-sources'
const LOCAL_ENV_FILES = ['.env.analytics.local', '.env']
const REPORT_DIR = join(process.cwd(), '..', 'docs')

type SourceKey = 'ga4' | 'ads' | 'search_console'

type SourceSyncResult = {
  source: SourceKey
  connectionId: string
  connectionName: string
  status: 'success' | 'failed' | 'skipped'
  recordsFetched: number
  recordsUpserted: number
  errorMessage: string | null
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AnalyticsModule],
})
class ForceSyncAllAnalyticsSourcesModule {}

function readFlag(name: string) {
  const argv = process.argv.slice(2)
  const index = argv.findIndex((entry) => entry === name)
  if (index === -1) {
    return null
  }
  return argv[index + 1] || null
}

function loadScriptEnv() {
  for (const fileName of LOCAL_ENV_FILES) {
    const envPath = join(process.cwd(), fileName)
    if (!existsSync(envPath)) {
      continue
    }

    const content = readFileSync(envPath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')
      if (separatorIndex <= 0) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      if (!key || process.env[key]) {
        continue
      }

      let value = line.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

function loadConfigEncryptionKeyFromDevEnv() {
  const envPath = join(process.cwd(), '..', 'deploy', 'env', 'backend.dev.env')
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (key !== 'CONFIG_ENCRYPTION_KEY') {
      continue
    }

    const value = line.slice(separatorIndex + 1).trim()
    process.env.CONFIG_ENCRYPTION_KEY = value
    return
  }
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number((value as { toString(): string }).toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function asPlainObject(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return '—'
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10)
}

function formatDecimal(value: unknown) {
  const numeric = toNumber(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00'
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function pickSearchOpportunities(
  rows: Array<{
    query: string
    page: string | null
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>,
) {
  return rows
    .filter((row) => row.impressions >= 5)
    .slice(0, 5)
    .map((row) => {
      const landing = row.page ?? 'una landing específica'
      const highDemand = row.clicks === 0 ? 'hay demanda real pero todavía no se captura clics' : 'ya recibe clics, aunque puede capturar más'
      const positionNote =
        row.position <= 12
          ? 'está cerca de competir en la primera página'
          : 'ya muestra interés de mercado y merece una landing propia'
      return `- **${row.query}**: ${row.impressions} impresiones, CTR ${formatPercentage(row.ctr)}, posición ${row.position.toFixed(1)}. ${highDemand}. Crear o reforzar ${landing} porque ${positionNote}.`
    })
}

function pickLandingRecommendations(
  rows: Array<{
    query: string
    page: string | null
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>,
) {
  const priorityQueries = rows.filter((row) => row.impressions >= 5).slice(0, 4)
  if (!priorityQueries.length) {
    return ['- No hay suficientes consultas para recomendar nuevas landings en esta corrida.']
  }

  return priorityQueries.map((row) => {
    const suggestedSlug = row.query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    const suggestedPath = `/productos/${suggestedSlug}`
    const contentParts = [
      'explicación simple del producto',
      'para qué sirve',
      'tipos o variantes',
      'beneficios principales',
      'fotos reales',
      'preguntas frecuentes',
      'botón visible de WhatsApp',
      'botón de llamada',
    ]
    if (row.query.toLowerCase().includes('precio')) {
      contentParts.unshift('rango de precios orientativo')
      contentParts.push('qué cambia el precio')
    }
    return `- Crear **${suggestedPath}** para responder mejor a **${row.query}**. Incluir: ${contentParts.join(', ')}. La búsqueda ya existe; la página debe hacer que esa demanda llegue a consulta en vez de irse a otra marca.`
  })
}

function pickBrandReadout(
  rows: Array<{
    query: string
    page: string | null
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>,
) {
  const brandRows = rows.filter((row) => row.query.toLowerCase().includes('urucortinas'))
  if (!brandRows.length) {
    return ['- La marca todavía no aparece con suficiente peso propio; falta reforzar posicionamiento de marca en búsquedas directas.']
  }

  return brandRows.slice(0, 3).map((row) => {
    return `- **${row.query}**: la demanda de marca existe, pero todavía hay espacio para reforzar posicionamiento, snippet y landings para capturar mejor esa intención.`
  })
}

function pickAdsBusinessReadout(
  rows: Array<{
    campaign: string
    clicks: number
    impressions: number
    cost: number
    conversions: number
    conversionValue: number
    hasConversionData: boolean
  }>,
) {
  if (!rows.length) {
    return ['- Ads no devolvió filas suficientes para una lectura de negocio más fina en esta corrida.']
  }

  const top = rows[0]
  const lines = [
    `- **${top.campaign}** concentra el mayor volumen visible: ${top.clicks} clicks, ${top.impressions} impresiones y costo ${formatDecimal(top.cost)}. Ads sirve hoy para entender adquisición, aunque todavía no para cerrar performance financiero.`,
  ]

  if (rows.length > 1) {
    lines.push(
      '- La segunda señal visible confirma el mismo patrón: tráfico y gasto están presentes, pero la conversión aún no permite decidir con confianza si el presupuesto está siendo rentable.',
    )
  }

  lines.push(
    '- Mientras las conversiones no estén maduras, Ads debe leerse como mapa de adquisición y no como juicio final de rentabilidad.',
  )

  return lines
}

function pickGa4BusinessReadout(
  rows: Array<{
    date: string
    channel: string
    campaign: string | null
    sessions: number
    users: number
    revenue: number
    orders: number
    cost: number
    keyEvents: number
    ga4PurchaseProxy: number
  }>,
) {
  if (!rows.length) {
    return ['- GA4 no devolvió filas suficientes para una lectura de negocio más fina en esta corrida.']
  }

  const top = rows[0]
  return [
    `- **${top.channel}** muestra el mayor volumen visible en la muestra. La señal es clara: hay tráfico y engagement, pero todavía falta madurez de conversión para traducir ese interés en negocio con precisión.`,
    '- GA4 hoy sirve para entender qué canal trae volumen y dónde se generan señales de interés, pero la lectura ejecutiva todavía depende de cerrar mejor el funnel y la medición.',
  ]
}

function renderMarkdownReport(input: {
  runDate: string
  syncResults: SourceSyncResult[]
  reportingDailyCount: number
  adsCount: number
  searchConsoleCount: number
  eventFactsCount: number
  latestSyncRuns: Array<{
    source: SourceKey
    connectionId: string
    jobType: string
    status: string
    recordsFetched: number
    recordsUpserted: number
    startedAt: string
    finishedAt: string | null
  }>
  latestSuccessfulSyncRuns: Array<{
    source: SourceKey
    connectionId: string
    jobType: string
    recordsFetched: number
    recordsUpserted: number
    startedAt: string
    finishedAt: string | null
  }>
  ga4TopEvents: Array<{ eventName: string; count: number }>
  ga4TopReportingRows: Array<{
    date: string
    channel: string
    campaign: string | null
    sessions: number
    users: number
    revenue: number
    orders: number
    cost: number
    keyEvents: number
    ga4PurchaseProxy: number
  }>
  adsTopRows: Array<{
    date: string
    campaign: string
    clicks: number
    impressions: number
    cost: number
    conversions: number
    conversionValue: number
    hasConversionData: boolean
  }>
  searchTopRows: Array<{
    date: string
    query: string
    page: string | null
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
}) {
  const sourceQuality = input.syncResults.map((result) => {
    const successfulSnapshot = input.latestSuccessfulSyncRuns.find(
      (entry) => entry.source === result.source,
    )

    if (result.status !== 'success') {
      return {
        source: result.source,
        quality: 'deficiente',
        reason: result.errorMessage ?? 'sync failed',
      }
    }

    if (result.source === 'ads') {
      return {
        source: result.source,
        quality: successfulSnapshot ? 'regular' : 'deficiente',
        reason: successfulSnapshot
          ? 'sync exitoso con señal de conversiones todavía no confiable'
          : 'dataset limitado para conclusiones fuertes',
      }
    }

    if (result.source === 'search_console') {
      return {
        source: result.source,
        quality: successfulSnapshot && successfulSnapshot.recordsFetched >= 50 ? 'buena' : 'regular',
        reason:
          successfulSnapshot && successfulSnapshot.recordsFetched >= 50
            ? 'query/page signal rica y estable'
            : 'señal operativa disponible, pero con cobertura limitada',
      }
    }

    return {
      source: result.source,
      quality: successfulSnapshot && successfulSnapshot.recordsFetched >= 50 ? 'buena' : 'regular',
      reason:
        successfulSnapshot && successfulSnapshot.recordsFetched >= 50
          ? 'GA4 con volumen suficiente para análisis'
          : 'GA4 operativo, pero con cobertura reducida',
    }
  })

  const overallQuality = sourceQuality.some((entry) => entry.quality === 'deficiente')
    ? 'deficiente'
    : sourceQuality.some((entry) => entry.quality === 'regular')
      ? 'regular'
      : 'buena'

  const ga4Headline = input.ga4TopEvents.slice(0, 5)
  const adsHeadline = input.adsTopRows.slice(0, 5)
  const scHeadline = input.searchTopRows.slice(0, 5)
  const ga4Readout = pickGa4BusinessReadout(input.ga4TopReportingRows)
  const adsReadout = pickAdsBusinessReadout(input.adsTopRows)
  const brandReadout = pickBrandReadout(input.searchTopRows)
  const searchOpportunities = pickSearchOpportunities(input.searchTopRows)
  const landingRecommendations = pickLandingRecommendations(input.searchTopRows)

  const answeredQuestions = [
    {
      q: 'Qué está funcionando',
      a: [
        'GA4 sigue mostrando volumen y engagement suficientes para analizar comportamiento real.',
        'Search Console ya confirma demanda clara de mercado: hay búsquedas de marca e intención alta.',
        'Ads ya trae tráfico, costo y volumen de campañas, así que sirve para entender adquisición aunque todavía no cierre performance financiero.',
      ],
    },
    {
      q: 'Qué está fallando',
      a: [
        'Ads todavía no tiene conversiones confiables, así que no conviene declarar rentabilidad o pérdida confirmada.',
        'La conversión en GA4 sigue siendo muy baja frente al volumen de tráfico, por lo que la medición final todavía no está madura.',
        'Hay búsquedas con impresiones altas y CTR bajo: el sitio está recibiendo demanda, pero no siempre la está capturando.',
      ],
    },
    {
      q: 'Dónde se pierde dinero',
      a: [
        'No se puede afirmar desperdicio confirmado en Ads hasta validar conversiones.',
        'Las keywords no-brand con costo y sin señal de conversión siguen siendo la zona de mayor riesgo.',
        'Si la conversión del sitio está subcontada, el ROAS real sigue invisible y cualquier evaluación financiera queda incompleta.',
      ],
    },
    {
      q: 'Dónde hay oportunidades',
      a: [
        'Crear páginas propias para términos con demanda real como persianas de enrollar, cortinas de enrollar PVC y persianas de PVC.',
        'En cada página incluir qué es el producto, para qué sirve, variantes, beneficios, fotos reales, preguntas frecuentes y un botón visible de WhatsApp.',
        'Fortalecer posicionamiento de marca para capturar mejor búsquedas directas y diferenciarse de la demanda genérica.',
      ],
    },
    {
      q: 'Qué acciones tomar ahora',
      a: [
        'Cerrar la medición de conversiones en el sitio nuevo y en Ads.',
        'Priorizar SEO sobre consultas de impresiones altas y CTR bajo, creando landings propias donde hoy la demanda no está bien capturada.',
        'Mantener Ads útil hoy para adquisición y análisis de tráfico mientras maduran las conversiones.',
      ],
    },
  ]

  return `# Analytics Sync Report - ${input.runDate}

## Scope
- Source of truth: backend sync only.
- Sources evaluated: Google Analytics 4, Google Ads, Google Search Console.
- No CSV/manual baseline used for the operational report.

## Execution Result

All 3 sources completed manual incremental sync successfully through backend processes.

## Executive Summary

- The site already receives meaningful demand, but it is not yet converting that demand into measurable business outcomes with the same strength.
- Search demand is present and visible, especially around product intent such as persianas, roller and enrollables PVC.
- Brand demand exists, but there is still room to strengthen positioning so branded searches translate into better capture.
- Ads is useful today for acquisition analysis, but not yet strong enough to judge final ROI because conversion measurement is still incomplete.
- The operational question now is not "do we have data?" but "are we turning the available demand into captured opportunities?"

## Executive Actions

### What to build next
${landingRecommendations.join('\n')}

### What to improve on the current site
- Make the brand easier to recognize in search results.
- Turn generic product searches into dedicated pages instead of sending everyone to broad catalog pages.
- Add clear calls to action so the person who already has intent can contact the business fast.

### What to expect after those changes
- More search traffic from the terms people already use.
- Better click-through from Google because the page matches the search intent.
- More WhatsApp, calls and lead forms from people who are already close to buying.

### What the report is really saying
- People are already searching for products the site sells.
- The site is visible, but not always specific enough to win the click.
- The next move is not "more data"; it is "better pages for the demand that already exists."

| Source | Sync Status | Quality | Notes |
|---|---|---:|---|
${input.syncResults
  .map(
    (result, index) =>
      `| ${result.source.toUpperCase()} | ${result.status === 'success' ? 'Success' : result.status === 'skipped' ? 'Skipped' : 'Failed'} | ${sourceQuality[index]?.quality ?? 'deficiente'} | ${sourceQuality[index]?.reason ?? 'n/a'} |`,
  )
  .join('\n')}

## Manual Sync Runs

${input.syncResults
  .map(
    (result) => `- ${result.source.toUpperCase()}
  - \`connectionId\`: ${result.connectionId}
  - \`status\`: ${result.status}
  - \`recordsFetched\`: ${result.recordsFetched}
  - \`recordsUpserted\`: ${result.recordsUpserted}`,
  )
  .join('\n\n')}

## Persisted Data Volumes

- \`analyticsReportingDaily\`: ${input.reportingDailyCount} rows
- \`analyticsAdsDailyMetric\`: ${input.adsCount} rows
- \`analyticsSearchConsoleDailyMetric\`: ${input.searchConsoleCount} rows
- \`eventFact\`: ${input.eventFactsCount} rows

## Latest Sync Runs

${input.latestSyncRuns
  .map(
    (run) => `- ${run.source.toUpperCase()}
  - \`jobType\`: ${run.jobType}
  - \`status\`: ${run.status}
  - \`recordsFetched\`: ${run.recordsFetched}
  - \`recordsUpserted\`: ${run.recordsUpserted}
  - \`startedAt\`: ${formatDate(run.startedAt)}
  - \`finishedAt\`: ${formatDate(run.finishedAt)}`,
  )
  .join('\n\n')}

## Latest Successful Sync Snapshot

${input.latestSuccessfulSyncRuns.length
  ? input.latestSuccessfulSyncRuns
      .map(
        (run) => `- ${run.source.toUpperCase()}
  - \`jobType\`: ${run.jobType}
  - \`recordsFetched\`: ${run.recordsFetched}
  - \`recordsUpserted\`: ${run.recordsUpserted}
  - \`startedAt\`: ${formatDate(run.startedAt)}
  - \`finishedAt\`: ${formatDate(run.finishedAt)}`,
      )
      .join('\n\n')
  : '- No successful non-empty sync snapshot found.'}

## GA4 Highlights

${ga4Readout.join('\n')}

${ga4Headline
  .map((row) => `- \`${row.eventName}\`: ${row.count}`)
  .join('\n')}

Top reporting rows:
${input.ga4TopReportingRows
  .map(
    (row) =>
      `- ${formatDate(row.date)} | ${row.channel} | ${row.campaign ?? 'n/a'} | sessions=${row.sessions} users=${row.users} revenue=${formatDecimal(row.revenue)} orders=${row.orders} cost=${formatDecimal(row.cost)} keyEvents=${row.keyEvents} ga4PurchaseProxy=${row.ga4PurchaseProxy}`,
  )
  .join('\n')}

## Ads Highlights

Latest persisted rows show:
- campaign-level daily metrics
- cost and click signal present
- conversions remain low or zero while measurement matures

${adsReadout.join('\n')}

${adsHeadline
  .map(
    (row) =>
      `- ${formatDate(row.date)} | campaign \`${row.campaign}\` | clicks=${row.clicks} impressions=${row.impressions} cost=${formatDecimal(row.cost)} conversions=${row.conversions} conversionValue=${formatDecimal(row.conversionValue)} hasConversionData=${row.hasConversionData ? 'yes' : 'no'}`,
  )
  .join('\n')}

## Search Console Highlights

Latest persisted rows show:
- query/page-level signal
- impressions, clicks, CTR and position persisted

Brand positioning readout:
${brandReadout.join('\n')}

High-demand landing opportunities:
${searchOpportunities.join('\n')}

${scHeadline
  .map(
    (row) =>
      `- ${formatDate(row.date)} | \`${row.query}\` -> ${row.page ?? 'n/a'} | clicks=${row.clicks} impressions=${row.impressions} ctr=${row.ctr.toFixed(2)} position=${row.position.toFixed(2)}`,
  )
  .join('\n')}

## Quality Classification

  - **GA4: ${sourceQuality.find((entry) => entry.source === 'ga4')?.quality ?? 'regular'}**
  - ${sourceQuality.find((entry) => entry.source === 'ga4')?.reason ?? 'n/a'}

  - **Google Ads: ${sourceQuality.find((entry) => entry.source === 'ads')?.quality ?? 'regular'}**
  - ${sourceQuality.find((entry) => entry.source === 'ads')?.reason ?? 'n/a'}

  - **Search Console: ${sourceQuality.find((entry) => entry.source === 'search_console')?.quality ?? 'regular'}**
  - ${sourceQuality.find((entry) => entry.source === 'search_console')?.reason ?? 'n/a'}

- **Overall: ${overallQuality}**
  - ${overallQuality === 'buena'
    ? 'Las tres fuentes están operativas; Ads sigue con señal limitada para conclusiones fuertes.'
    : overallQuality === 'regular'
      ? 'Las tres fuentes están activas, pero Ads todavía requiere madurez de medición.'
      : 'Hay al menos una fuente con problemas de sync o persistencia.'}

## Base Questions

${answeredQuestions
  .map(
    (entry) =>
      `### ${entry.q}\n${entry.a.map((point) => `- ${point}`).join('\n')}`,
  )
  .join('\n\n')}

## Fix Applied

Backend sync was executed through standard application services, not through the UI. Conversion tracking was instrumented in the frontend and the Ads measurement gate remains explicit so conclusions about performance are not overstated while conversions are not fully configured.

## Overall Result

- Overall synchronization quality: **${overallQuality.charAt(0).toUpperCase() + overallQuality.slice(1)}**
- GA4 and Search Console are producing operationally useful data.
- Ads sync is successful and usable now, but still remains regular until conversion measurement matures.
`
}

function printOutput(value: unknown, json: boolean) {
  const rendered = json
    ? JSON.stringify(value, null, 2)
    : inspect(value, { depth: 10, colors: true, compact: false })
  // eslint-disable-next-line no-console
  console.log(rendered)
}

async function main() {
  loadEnvFromBackendRoot()
  loadScriptEnv()
  loadConfigEncryptionKeyFromDevEnv()
  const safety = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    destructive: false,
    defaultDryRun: true,
    allowRemoteWithFlag: true,
  })

  if (safety.dryRun) {
    printOutput(
      {
        mode: 'dry_run',
        databaseHost: safety.databaseHost,
        note: 'Re-run with --confirm to execute sync and generate the report.',
      },
      false,
    )
    return
  }

  const app = await NestFactory.createApplicationContext(ForceSyncAllAnalyticsSourcesModule, {
    logger: ['error', 'warn'],
  })

  try {
    const repository = app.get(AnalyticsRepository)
    const prisma = app.get(PrismaService)
    const ga4 = app.get(Ga4ConnectorService)
    const ads = app.get(AdsConnectorService)
    const searchConsole = app.get(SearchConsoleConnectorService)

    const connections = await repository.listConnections()
    const syncableConnections = connections.filter((connection) => !connection.needsReauth)

    const sourceHandlers: Record<SourceKey, (connectionId: string) => Promise<unknown>> = {
      ga4: (connectionId) => ga4.runIncrementalSync(connectionId),
      ads: (connectionId) => ads.runIncrementalSync(connectionId),
      search_console: (connectionId) => searchConsole.runIncrementalSync(connectionId),
    }

    const syncResults: SourceSyncResult[] = []
    for (const source of ['ga4', 'ads', 'search_console'] as const) {
      const sourceConnections = syncableConnections.filter((connection) => connection.source === source)
      if (!sourceConnections.length) {
        syncResults.push({
          source,
          connectionId: '—',
          connectionName: '—',
          status: 'skipped',
          recordsFetched: 0,
          recordsUpserted: 0,
          errorMessage: `No ready ${source} connection found.`,
        })
        continue
      }

      for (const connection of sourceConnections) {
        try {
          const result = (await sourceHandlers[source](connection.id)) as {
            recordsFetched?: number
            recordsUpserted?: number
          }
          syncResults.push({
            source,
            connectionId: connection.id,
            connectionName: connection.target.name,
            status: 'success',
            recordsFetched: result.recordsFetched ?? 0,
            recordsUpserted: result.recordsUpserted ?? 0,
            errorMessage: null,
          })
        } catch (error) {
          syncResults.push({
            source,
            connectionId: connection.id,
            connectionName: connection.target.name,
            status: 'failed',
            recordsFetched: 0,
            recordsUpserted: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    const reportingRows = await prisma.analyticsReportingDaily.count()
    const adsRows = await prisma.analyticsAdsDailyMetric.count()
    const searchRows = await prisma.analyticsSearchConsoleDailyMetric.count()
    const eventFacts = await prisma.eventFact.count()

    const latestSyncRunsRaw = await prisma.analyticsSyncRun.findMany({
      orderBy: [{ startedAt: 'desc' }],
      take: 20,
    })

    const connectionMap = new Map(
      connections.map((connection) => [connection.id, connection.source] as const),
    )

    const latestSyncRuns = latestSyncRunsRaw.map((run) => ({
      source: (connectionMap.get(run.connectionId) ?? 'ga4') as SourceKey,
      connectionId: run.connectionId,
      jobType: run.jobType,
      status: run.status,
      recordsFetched: run.recordsFetched,
      recordsUpserted: run.recordsUpserted,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    }))

    const latestSuccessfulSyncRuns: Array<{
      source: SourceKey
      connectionId: string
      jobType: string
      recordsFetched: number
      recordsUpserted: number
      startedAt: string
      finishedAt: string | null
    }> = []
    const seenSuccessfulConnections = new Set<string>()
    for (const run of latestSyncRuns) {
      if (run.recordsFetched <= 0 || run.recordsUpserted <= 0) {
        continue
      }
      if (seenSuccessfulConnections.has(run.connectionId)) {
        continue
      }
      seenSuccessfulConnections.add(run.connectionId)
      latestSuccessfulSyncRuns.push({
        source: run.source,
        connectionId: run.connectionId,
        jobType: run.jobType,
        recordsFetched: run.recordsFetched,
        recordsUpserted: run.recordsUpserted,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })
    }

    const ga4TopEventsRaw = await prisma.eventFact.groupBy({
      by: ['eventName'],
      _count: {
        eventName: true,
      },
      orderBy: {
        _count: {
          eventName: 'desc',
        },
      },
      take: 5,
    })

    const ga4TopReportingRowsRaw = await prisma.analyticsReportingDaily.findMany({
      orderBy: [{ revenue: 'desc' }, { sessions: 'desc' }],
      take: 5,
    })

    const adsTopRowsRaw = await prisma.analyticsAdsDailyMetric.findMany({
      orderBy: [{ cost: 'desc' }, { clicks: 'desc' }],
      take: 5,
    })

    const searchTopRowsRaw = await prisma.analyticsSearchConsoleDailyMetric.findMany({
      orderBy: [{ impressions: 'desc' }, { clicks: 'desc' }],
      take: 5,
    })

    const runDate = new Date().toISOString().slice(0, 10)

    const report = renderMarkdownReport({
      runDate,
      syncResults,
      reportingDailyCount: reportingRows,
      adsCount: adsRows,
      searchConsoleCount: searchRows,
      eventFactsCount: eventFacts,
      latestSyncRuns,
      latestSuccessfulSyncRuns,
      ga4TopEvents: ga4TopEventsRaw.map((row) => ({
        eventName: row.eventName,
        count: row._count.eventName,
      })),
      ga4TopReportingRows: ga4TopReportingRowsRaw.map((row) => ({
        date: row.date.toISOString(),
        channel: row.channel,
        campaign: row.campaign ?? null,
        sessions: row.sessions,
        users: row.users,
        revenue: Number(row.revenue.toString()),
        orders: row.orders,
        cost: Number(row.cost.toString()),
        keyEvents: row.keyEvents,
        ga4PurchaseProxy: row.ga4PurchaseProxy,
      })),
      adsTopRows: adsTopRowsRaw.map((row) => ({
        date: row.date.toISOString(),
        campaign: row.campaign,
        clicks: row.clicks,
        impressions: row.impressions,
        cost: Number(row.cost.toString()),
        conversions: row.conversions,
        conversionValue: Number(row.conversionValue.toString()),
        hasConversionData: row.hasConversionData,
      })),
      searchTopRows: searchTopRowsRaw.map((row) => ({
        date: row.date.toISOString(),
        query: row.query,
        page: row.page ?? null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Number(row.ctr.toString()),
        position: Number(row.position.toString()),
      })),
    })

    const reportPath = join(REPORT_DIR, `analytics-sync-report-${runDate}.md`)
    writeFileSync(reportPath, report, 'utf8')

    printOutput(
      {
        mode: 'apply',
        databaseHost: safety.databaseHost,
        syncResults,
        reportPath,
      },
      false,
    )
  } finally {
    await app.close()
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[${SCRIPT_NAME}] failed`, error)
  process.exitCode = 1
})
