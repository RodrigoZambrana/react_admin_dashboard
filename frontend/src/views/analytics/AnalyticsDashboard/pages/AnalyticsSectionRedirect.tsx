import { Navigate, useParams } from 'react-router-dom'

const redirects: Record<string, string> = {
    overview: '/app/analytics/overview',
    funnel: '/app/analytics/funnel',
    marketing: '/app/analytics/marketing',
    products: '/app/analytics/products',
    behavior: '/app/analytics/behavior',
    conversions: '/app/analytics/conversions',
    connections: '/app/analytics/connections',
    insights: '/app/analytics/insights',
    'data-quality': '/app/analytics/data-quality',
    parity: '/app/analytics/data-quality',
    'growth-insights': '/app/analytics/growth-insights',
}

const AnalyticsSectionRedirect = () => {
    const { section = 'overview' } = useParams<{ section?: string }>()
    return <Navigate replace to={redirects[section] ?? '/app/analytics'} />
}

export default AnalyticsSectionRedirect
