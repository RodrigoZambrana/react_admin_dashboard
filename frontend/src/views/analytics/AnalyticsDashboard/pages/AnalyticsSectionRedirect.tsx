import { Navigate, useParams } from 'react-router-dom'
import { appPath } from '@/constants/route.constant'

const redirects: Record<string, string> = {
    overview: appPath('/analytics/overview'),
    funnel: appPath('/analytics/funnel'),
    marketing: appPath('/analytics/marketing'),
    products: appPath('/analytics/products'),
    behavior: appPath('/analytics/behavior'),
    conversions: appPath('/analytics/conversions'),
    connections: appPath('/analytics/connections'),
    insights: appPath('/analytics/insights'),
    'data-quality': appPath('/analytics/data-quality'),
    parity: appPath('/analytics/data-parity'),
    'data-parity': appPath('/analytics/data-parity'),
    'growth-insights': appPath('/analytics/growth-insights'),
}

const AnalyticsSectionRedirect = () => {
    const { section = 'overview' } = useParams<{ section?: string }>()
    return <Navigate replace to={redirects[section] ?? appPath('/analytics')} />
}

export default AnalyticsSectionRedirect
