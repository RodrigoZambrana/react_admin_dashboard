import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsDataParity,
    apiGetAnalyticsUsage,
    type AnalyticsDataParityResponse,
    type AnalyticsUsageResponse,
} from '@/services/AnalyticsService'

export type AnalyticsDataParityData = {
    parity: AnalyticsDataParityResponse | null
    usage: AnalyticsUsageResponse | null
}

const defaultDataParityData: AnalyticsDataParityData = {
    parity: null,
    usage: null,
}

export const useAnalyticsDataParityData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsDataParityData>(defaultDataParityData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [parityResponse, usageResponse] = await Promise.all([
                apiGetAnalyticsDataParity<AnalyticsDataParityResponse>(100),
                apiGetAnalyticsUsage<AnalyticsUsageResponse>(100),
            ])

            setData({
                parity: parityResponse.data,
                usage: usageResponse.data,
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar el dashboard de data parity.')
            setData(defaultDataParityData)
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
