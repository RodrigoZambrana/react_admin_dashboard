import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsBaselineSnapshots,
    apiGetAnalyticsDataQuality,
    type AnalyticsBaselineSnapshot,
    type AnalyticsDataQualityCheck,
    type AnalyticsDataQualitySummary,
} from '@/services/AnalyticsService'

export type AnalyticsDataQualityData = {
    baselineSnapshots: AnalyticsBaselineSnapshot[]
    checks: AnalyticsDataQualityCheck[]
    summaries: AnalyticsDataQualitySummary[]
}

const defaultDataQualityData: AnalyticsDataQualityData = {
    baselineSnapshots: [],
    checks: [],
    summaries: [],
}

export const useAnalyticsDataQualityData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsDataQualityData>(defaultDataQualityData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [baselineResponse, qualityResponse] = await Promise.all([
                apiGetAnalyticsBaselineSnapshots<{ snapshots: AnalyticsBaselineSnapshot[] }>(100),
                apiGetAnalyticsDataQuality<{ checks: AnalyticsDataQualityCheck[]; summaries: AnalyticsDataQualitySummary[] }>(
                    100,
                ),
            ])

            setData({
                baselineSnapshots: baselineResponse.data.snapshots ?? [],
                checks: qualityResponse.data.checks ?? [],
                summaries: qualityResponse.data.summaries ?? [],
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar la data quality de analytics.')
            setData(defaultDataQualityData)
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
