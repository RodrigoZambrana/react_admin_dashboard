export type AnalyticsReportEquivalenceStatus = 'exact' | 'partial' | 'gap'

export type AnalyticsReportRowKeyStrategy = 'row_index' | 'dimensions'

export type AnalyticsReportDataSource = 'baseline_csv' | 'ga4_api'

export type AnalyticsReportApiDateRange = {
  label: string
  startDate: string
  endDate: string
}

export type AnalyticsReportApiDefinition = {
  kind: 'runReport' | 'cohortReport'
  dimensions: string[]
  metrics: string[]
  dateRanges?: AnalyticsReportApiDateRange[]
  limit?: number
  pivotDimensions?: string[]
  cohortSpec?: {
    granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY'
    cohortName?: string
    startOffset?: number
    endOffset?: number
    range?: {
      startDate: string
      endDate: string
    }
  }
}

export type AnalyticsReportCatalogEntry = {
  key: string
  title: string
  description: string
  baselineTitle?: string | null
  baselineHeader: string
  equivalenceStatus: AnalyticsReportEquivalenceStatus
  rowKeyStrategy: AnalyticsReportRowKeyStrategy
  dimensionLabels: string[]
  metricLabels: string[]
  apiDefinition?: AnalyticsReportApiDefinition | null
  notes?: string | null
}

const BASELINE_DATE_RANGE = [
  { label: 'primary', startDate: '2023-01-01', endDate: 'today' },
] satisfies AnalyticsReportApiDateRange[]

export const GA4_REPORT_CATALOG: AnalyticsReportCatalogEntry[] = [
  {
    key: 'active_users_daily',
    title: 'Usuarios activos diarios',
    description: 'Serie temporal de usuarios activos.',
    baselineTitle: 'Informe panorámico',
    baselineHeader: 'Día N,Usuarios activos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Día N'],
    metricLabels: ['Usuarios activos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['date'],
      metrics: ['activeUsers'],
      dateRanges: BASELINE_DATE_RANGE,
    },
  },
  {
    key: 'new_users_daily',
    title: 'Usuarios nuevos diarios',
    description: 'Serie temporal de usuarios nuevos.',
    baselineTitle: 'Informe panorámico',
    baselineHeader: 'Día N,Usuarios nuevos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Día N'],
    metricLabels: ['Usuarios nuevos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['date'],
      metrics: ['newUsers'],
      dateRanges: BASELINE_DATE_RANGE,
    },
  },
  {
    key: 'avg_engagement_time_per_active_user_daily',
    title: 'Tiempo de interacción medio por usuario activo',
    description: 'Serie temporal del tiempo de interacción promedio por usuario activo.',
    baselineTitle: 'Informe panorámico',
    baselineHeader: 'Día N,Tiempo de interacción medio por usuario activo',
    equivalenceStatus: 'partial',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Día N'],
    metricLabels: ['Tiempo de interacción medio por usuario activo'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['date'],
      metrics: ['averageSessionDuration'],
      dateRanges: BASELINE_DATE_RANGE,
    },
  },
  {
    key: 'total_revenue_daily',
    title: 'Ingresos totales diarios',
    description: 'Serie temporal del revenue total.',
    baselineTitle: 'Informe panorámico',
    baselineHeader: 'Día N,Total de ingresos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Día N'],
    metricLabels: ['Total de ingresos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['date'],
      metrics: ['totalRevenue'],
      dateRanges: BASELINE_DATE_RANGE,
    },
  },
  {
    key: 'new_users_by_first_user_default_channel_group',
    title: 'Nuevos usuarios por primer canal',
    description: 'Adquisición de nuevos usuarios por primer grupo de canales.',
    baselineTitle: '¿De dónde proceden los nuevos usuarios?',
    baselineHeader:
      'Primer grupo de canales principal del usuario (Grupo de canales predeterminado),Usuarios nuevos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Primer grupo de canales principal del usuario'],
    metricLabels: ['Usuarios nuevos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['firstUserDefaultChannelGroup'],
      metrics: ['newUsers'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 20,
    },
  },
  {
    key: 'sessions_by_session_default_channel_group',
    title: 'Sesiones por canal de sesión',
    description: 'Atribución de sesiones por grupo de canales de sesión.',
    baselineTitle: null,
    baselineHeader:
      'Grupo de canales principal de la sesión (Grupo de canales predeterminado),Sesiones',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Grupo de canales principal de la sesión'],
    metricLabels: ['Sesiones'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['sessionDefaultChannelGroup'],
      metrics: ['sessions'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 20,
    },
  },
  {
    key: 'active_users_by_country_id',
    title: 'Usuarios activos por país',
    description: 'Distribución geográfica por countryId.',
    baselineTitle: null,
    baselineHeader: 'ID del país,Usuarios activos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['ID del país'],
    metricLabels: ['Usuarios activos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['countryId'],
      metrics: ['activeUsers'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 145,
    },
  },
  {
    key: 'active_users_by_country',
    title: 'Usuarios activos por país',
    description: 'Distribución geográfica por país.',
    baselineTitle: null,
    baselineHeader: 'País,Usuarios activos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['País'],
    metricLabels: ['Usuarios activos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['country'],
      metrics: ['activeUsers'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 7,
    },
  },
  {
    key: 'active_users_trend_30_7_1',
    title: 'Tendencia de usuarios activos',
    description: 'Serie comparativa 30/7/1 días.',
    baselineTitle: '¿Cuál es la tendencia de usuarios activos?',
    baselineHeader: 'Día N,30 días,7 días,1 día',
    equivalenceStatus: 'partial',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Día N'],
    metricLabels: ['30 días', '7 días', '1 día'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['date'],
      metrics: ['activeUsers'],
      dateRanges: [
        { label: '30 días', startDate: '30daysAgo', endDate: 'today' },
        { label: '7 días', startDate: '7daysAgo', endDate: 'today' },
        { label: '1 día', startDate: 'yesterday', endDate: 'today' },
      ],
    },
  },
  {
    key: 'retention_cohort_weekly',
    title: 'Retención por cohortes semanal',
    description: 'Retención por cohortes con semanas 0 a 5.',
    baselineTitle: '¿Cómo retiene a los usuarios?',
    baselineHeader: 'Fecha,Semana 0,Semana 1,Semana 2,Semana 3,Semana 4,Semana 5',
    equivalenceStatus: 'partial',
    rowKeyStrategy: 'row_index',
    dimensionLabels: ['Fecha'],
    metricLabels: ['Semana 0', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
    apiDefinition: {
      kind: 'cohortReport',
      dimensions: ['cohort'],
      metrics: ['cohortActiveUsers'],
      dateRanges: [{ label: 'cohort', startDate: '2023-01-01', endDate: 'today' }],
      cohortSpec: {
        granularity: 'WEEKLY',
      },
    },
  },
  {
    key: 'pages_by_title_views',
    title: 'Páginas por título y vistas',
    description: 'Páginas y screens ordenadas por vistas.',
    baselineTitle: null,
    baselineHeader: 'Título de página y clase de pantalla,Vistas',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Título de página y clase de pantalla'],
    metricLabels: ['Vistas'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['pageTitle'],
      metrics: ['screenPageViews'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 25,
    },
  },
  {
    key: 'events_by_event_name',
    title: 'Eventos por nombre',
    description: 'Conteo de eventos por nombre.',
    baselineTitle: null,
    baselineHeader: 'Nombre del evento,Número de eventos',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Nombre del evento'],
    metricLabels: ['Número de eventos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['eventName'],
      metrics: ['eventCount'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 50,
    },
  },
  {
    key: 'structural_events_by_event_id',
    title: 'Eventos estructurales por event_id',
    description: 'Comparación estructural de eventos 1:1 mediante event_id y tenant_id personalizados.',
    baselineTitle: null,
    baselineHeader: 'Fecha,Nombre del evento,Tenant id,Event id,Timestamp,Product id,Value,Currency,Event count',
    equivalenceStatus: 'gap',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Fecha', 'Nombre del evento', 'Tenant id', 'Event id', 'Timestamp', 'Product id', 'Value', 'Currency'],
    metricLabels: ['Número de eventos'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: [
        'date',
        'eventName',
        'customEvent:tenant_id',
        'customEvent:event_id',
        'customEvent:timestamp',
        'customEvent:product_id',
        'customEvent:value',
        'customEvent:currency',
      ],
      metrics: ['eventCount'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 5000,
    },
    notes: 'Requiere custom dimensions event_id y tenant_id en GA4 para comparación 1:1.',
  },
  {
    key: 'key_events_by_event_name',
    title: 'Eventos clave por nombre',
    description: 'Conteo de eventos clave por nombre.',
    baselineTitle: '¿Cuáles son sus eventos clave con mejor rendimiento?',
    baselineHeader: 'Nombre del evento,Eventos clave',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Nombre del evento'],
    metricLabels: ['Eventos clave'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['eventName'],
      metrics: ['keyEvents'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 50,
    },
  },
  {
    key: 'average_120_day_value_by_channel',
    title: 'Valor medio de 120 días por canal',
    description: 'Valor medio de 120 días por primer canal de usuario.',
    baselineTitle: '¿De dónde procede tu valor medio de 120 días?',
    baselineHeader:
      'Primer grupo de canales principal del usuario (Grupo de canales predeterminado),Valor medio de 120 días',
    equivalenceStatus: 'gap',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Primer grupo de canales principal del usuario'],
    metricLabels: ['Valor medio de 120 días'],
    apiDefinition: null,
    notes: 'No se encontró un equivalente estable de API para este export de referencia.',
  },
  {
    key: 'items_purchased_by_item_name',
    title: 'Artículos comprados por nombre',
    description: 'Unidades compradas por artículo.',
    baselineTitle: null,
    baselineHeader: 'Nombre del artículo,Artículos comprados',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Nombre del artículo'],
    metricLabels: ['Artículos comprados'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['itemName'],
      metrics: ['itemsPurchased'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 100,
    },
  },
  {
    key: 'platform_activity',
    title: 'Actividad por plataforma',
    description: 'Eventos clave por plataforma.',
    baselineTitle: 'Datos sobre la actividad en sus plataformas',
    baselineHeader: 'Plataforma,Eventos clave',
    equivalenceStatus: 'exact',
    rowKeyStrategy: 'dimensions',
    dimensionLabels: ['Plataforma'],
    metricLabels: ['Eventos clave'],
    apiDefinition: {
      kind: 'runReport',
      dimensions: ['platform'],
      metrics: ['keyEvents'],
      dateRanges: BASELINE_DATE_RANGE,
      limit: 20,
    },
  },
]

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\u00a0\s]+/gu, ' ')
    .trim()
    .toLowerCase()

export const normalizeGa4ReportText = normalize

export const findGa4ReportDefinition = (input: {
  header: string
  title?: string | null
}) => {
  const header = normalize(input.header)
  const title = input.title ? normalize(input.title) : null

  return (
    GA4_REPORT_CATALOG.find((entry) => {
      const baselineHeader = normalize(entry.baselineHeader)
      if (baselineHeader === header) {
        return true
      }

      if (title && entry.baselineTitle && normalize(entry.baselineTitle) === title) {
        return true
      }

      return false
    }) ?? null
  )
}
