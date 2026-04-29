export type AnalyticsSectionKey =
    | 'home'
    | 'overview'
    | 'funnel'
    | 'marketing'
    | 'products'
    | 'behavior'
    | 'conversions'
    | 'connections'
    | 'dataQuality'
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
        path: '/app/analytics',
        title: 'Analítica',
        subtitle: 'Centro de métricas, segmentación y evolución del negocio.',
    },
    {
        key: 'overview',
        path: '/app/analytics/overview',
        title: 'Resumen',
        subtitle: 'Revenue, órdenes, conversión y evolución temporal.',
    },
    {
        key: 'funnel',
        path: '/app/analytics/funnel',
        title: 'Embudo',
        subtitle: 'Del view_item al purchase con comparación histórica.',
    },
    {
        key: 'marketing',
        path: '/app/analytics/marketing',
        title: 'Marketing',
        subtitle: 'CAC, ROAS y atribución por canal.',
    },
    {
        key: 'products',
        path: '/app/analytics/products',
        title: 'Productos',
        subtitle: 'Productos con más intención, vistas y revenue.',
    },
    {
        key: 'behavior',
        path: '/app/analytics/behavior',
        title: 'Comportamiento',
        subtitle: 'Sesiones, navegación y engagement.',
    },
    {
        key: 'conversions',
        path: '/app/analytics/conversions',
        title: 'Conversiones',
        subtitle: 'Drivers de conversión y caídas por etapa.',
    },
    {
        key: 'connections',
        path: '/app/analytics/connections',
        title: 'Conexiones',
        subtitle: 'Fuentes externas, sync runs e insights operativos.',
    },
    {
        key: 'insights',
        path: '/app/analytics/insights',
        title: 'Insights IA',
        subtitle: 'Resumen ejecutivo, oportunidades y evidencia priorizada.',
    },
    {
        key: 'dataQuality',
        path: '/app/analytics/data-quality',
        title: 'Calidad de datos',
        subtitle: 'Baseline reproducible, sync y cobertura por reporte.',
    },
    {
        key: 'growthInsights',
        path: '/app/analytics/growth-insights',
        title: 'Growth & Insights',
        subtitle: 'Configuración de tracking, etiquetas e instrumentos.',
    },
]
