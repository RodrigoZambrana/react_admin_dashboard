import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsConnections,
    apiGetAnalyticsInsights,
    apiGetAnalyticsSyncRuns,
    type AnalyticsConnection,
    type AnalyticsInsight,
    type AnalyticsSyncRun,
} from '@/services/AnalyticsService'

export type AnalyticsOperationsData = {
    connections: AnalyticsConnection[]
    runs: AnalyticsSyncRun[]
    insights: AnalyticsInsight[]
}

const defaultOperationsData: AnalyticsOperationsData = {
    connections: [],
    runs: [],
    insights: [],
}

export const useAnalyticsOperationsData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsOperationsData>(defaultOperationsData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [connectionsResponse, runsResponse, insightsResponse] = await Promise.all([
                apiGetAnalyticsConnections<{ connections: AnalyticsConnection[] }>(),
                apiGetAnalyticsSyncRuns<{ runs: AnalyticsSyncRun[] }>(25),
                apiGetAnalyticsInsights<{ insights: AnalyticsInsight[] }>(25),
            ])

            setData({
                connections: connectionsResponse.data.connections ?? [],
                runs: runsResponse.data.runs ?? [],
                insights: insightsResponse.data.insights ?? [],
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar el panel operativo de analytics.')
            setData(defaultOperationsData)
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
