import { appPath } from '@/constants/route.constant'

export type AnalyticsSectionKey =
    | 'home'
    | 'overview'
    | 'funnel'
    | 'marketing'
    | 'metaMarketing'
    | 'products'
    | 'behavior'
    | 'conversions'
    | 'connections'
    | 'systemHealth'
    | 'insights'
    | 'dataAccess'
    | 'dataQuality'
    | 'dataParity'
    | 'exports'
    | 'growthInsights'

export type AnalyticsSection = {
    key: AnalyticsSectionKey
    path: string
    title: string
    subtitle: string
}

export const analyticsSections: AnalyticsSection[] = [
    {
        key: 'home',
        path: appPath('/analytics'),
        title: 'Analítica',
        subtitle: 'Centro de métricas, segmentación y evolución del negocio.',
    },
    {
        key: 'overview',
        path: appPath('/analytics/overview'),
        title: 'Resumen',
        subtitle: 'Revenue, órdenes, conversión y evolución temporal.',
    },
    {
        key: 'funnel',
        path: appPath('/analytics/funnel'),
        title: 'Embudo',
        subtitle: 'Del view_item al purchase con comparación histórica.',
    },
    {
        key: 'marketing',
        path: appPath('/analytics/marketing'),
        title: 'Marketing',
        subtitle: 'CAC, ROAS y atribución por canal.',
    },
    {
        key: 'metaMarketing',
        path: appPath('/analytics/marketing/meta'),
        title: 'Meta Ads',
        subtitle: 'Pixel, CAPI, remarketing y calidad de match.',
    },
    {
        key: 'products',
        path: appPath('/analytics/products'),
        title: 'Productos',
        subtitle: 'Productos con más intención, vistas y revenue.',
    },
    {
        key: 'behavior',
        path: appPath('/analytics/behavior'),
        title: 'Comportamiento',
        subtitle: 'Sesiones, navegación y engagement.',
    },
    {
        key: 'conversions',
        path: appPath('/analytics/conversions'),
        title: 'Conversiones',
        subtitle: 'Drivers de conversión y caídas por etapa.',
    },
    {
        key: 'connections',
        path: appPath('/analytics/connections'),
        title: 'Conexiones',
        subtitle: 'Fuentes externas, sync runs e insights operativos.',
    },
    {
        key: 'systemHealth',
        path: appPath('/analytics/system-health'),
        title: 'Salud del sistema',
        subtitle: 'Estado visible, histórico reciente y señal de degradación.',
    },
    {
        key: 'insights',
        path: appPath('/analytics/insights'),
        title: 'Insights IA',
        subtitle: 'Resumen ejecutivo, oportunidades y evidencia priorizada.',
    },
    {
        key: 'dataAccess',
        path: appPath('/analytics/data-access'),
        title: 'Acceso a datos',
        subtitle: 'Panel seguro para consumir la DAL y emitir API keys de servicio.',
    },
    {
        key: 'dataQuality',
        path: appPath('/analytics/data-quality'),
        title: 'Calidad de datos',
        subtitle: 'Baseline reproducible, sync y cobertura por reporte.',
    },
    {
        key: 'dataParity',
        path: appPath('/analytics/data-parity'),
        title: 'Data Parity',
        subtitle: 'Coherencia entre exports de referencia y API interna.',
    },
    {
        key: 'exports',
        path: appPath('/analytics/exports'),
        title: 'Exports',
        subtitle: 'Descargas canónicas y report-aligned para auditoría y consumo humano.',
    },
    {
        key: 'growthInsights',
        path: appPath('/analytics/growth-insights'),
        title: 'Growth & Insights',
        subtitle: 'Configuración de tracking, etiquetas e instrumentos.',
    },
]
