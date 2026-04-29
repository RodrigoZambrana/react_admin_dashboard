import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsDataTrust,
    apiGetAnalyticsHealth,
    apiGetAnalyticsHealthHistory,
    apiGetAnalyticsHealthStatus,
    type AnalyticsDataTrustResponse,
    type AnalyticsHealthHistoryItem,
    type AnalyticsHealthOverviewResponse,
    type AnalyticsHealthStatusResponse,
} from '@/services/AnalyticsService'

export type AnalyticsSystemHealthData = {
    status: AnalyticsHealthStatusResponse | null
    overview: AnalyticsHealthOverviewResponse | null
    history: AnalyticsHealthHistoryItem[]
    dataTrust: AnalyticsDataTrustResponse | null
}

const defaultSystemHealthData: AnalyticsSystemHealthData = {
    status: null,
    overview: null,
    history: [],
    dataTrust: null,
}

export const useAnalyticsSystemHealthData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsSystemHealthData>(defaultSystemHealthData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [statusResponse, overviewResponse, historyResponse, dataTrustResponse] = await Promise.all([
                apiGetAnalyticsHealthStatus<AnalyticsHealthStatusResponse>(),
                apiGetAnalyticsHealth<AnalyticsHealthOverviewResponse, { limit: string }>({
                    limit: '20',
                }),
                apiGetAnalyticsHealthHistory<{ history: AnalyticsHealthHistoryItem[] }>(50),
                apiGetAnalyticsDataTrust<AnalyticsDataTrustResponse>(10),
            ])

            setData({
                status: statusResponse.data ?? null,
                overview: overviewResponse.data ?? null,
                history: historyResponse.data.history ?? [],
                dataTrust: dataTrustResponse.data ?? null,
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar la salud del sistema de analytics.')
            setData(defaultSystemHealthData)
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
