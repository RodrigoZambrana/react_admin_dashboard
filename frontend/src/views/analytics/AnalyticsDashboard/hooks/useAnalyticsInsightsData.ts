import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsInsights,
    apiGetAnalyticsInsightsHistory,
    apiGetAnalyticsOpportunities,
    apiGetAnalyticsSummary,
    type AnalyticsInsightHistory,
    type AnalyticsInsightsResponse,
    type AnalyticsOpportunitiesResponse,
    type AnalyticsSummaryResponse,
} from '@/services/AnalyticsService'

export type AnalyticsInsightsData = {
    summary: AnalyticsSummaryResponse | null
    bundle: AnalyticsInsightsResponse | null
    opportunities: AnalyticsOpportunitiesResponse | null
    history: AnalyticsInsightHistory[]
}

const defaultInsightsData: AnalyticsInsightsData = {
    summary: null,
    bundle: null,
    opportunities: null,
    history: [],
}

export const useAnalyticsInsightsData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsInsightsData>(defaultInsightsData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [summaryResponse, insightsResponse, opportunitiesResponse, historyResponse] =
                await Promise.all([
                    apiGetAnalyticsSummary<AnalyticsSummaryResponse>(),
                    apiGetAnalyticsInsights<AnalyticsInsightsResponse>(),
                    apiGetAnalyticsOpportunities<AnalyticsOpportunitiesResponse>(),
                    apiGetAnalyticsInsightsHistory<{ history: AnalyticsInsightHistory[] }>(50),
                ])

            setData({
                summary: summaryResponse.data ?? null,
                bundle: insightsResponse.data ?? null,
                opportunities: opportunitiesResponse.data ?? null,
                history: historyResponse.data.history ?? [],
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar los insights de analytics.')
            setData(defaultInsightsData)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    return {
        loading,
        refreshing,
        error,
        data,
        reload: load,
    }
}
