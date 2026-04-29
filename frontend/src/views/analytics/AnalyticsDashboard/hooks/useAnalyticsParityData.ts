import { useCallback, useEffect, useState } from 'react'

import {
    apiGetAnalyticsReportCatalog,
    apiGetAnalyticsReportReconciliations,
    apiGetAnalyticsReportRuns,
    type AnalyticsReportCatalogEntry,
    type AnalyticsReportReconciliation,
    type AnalyticsReportRun,
} from '@/services/AnalyticsService'

export type AnalyticsParityData = {
    catalog: AnalyticsReportCatalogEntry[]
    runs: AnalyticsReportRun[]
    reconciliations: AnalyticsReportReconciliation[]
}

const defaultParityData: AnalyticsParityData = {
    catalog: [],
    runs: [],
    reconciliations: [],
}

export const useAnalyticsParityData = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsParityData>(defaultParityData)

    const load = useCallback(async () => {
        setLoading(true)
        setRefreshing(true)
        setError(null)

        try {
            const [catalogResponse, runsResponse, reconciliationsResponse] = await Promise.all([
                apiGetAnalyticsReportCatalog<{ catalog: AnalyticsReportCatalogEntry[] }>(),
                apiGetAnalyticsReportRuns<{ runs: AnalyticsReportRun[] }>(100),
                apiGetAnalyticsReportReconciliations<{ reconciliations: AnalyticsReportReconciliation[] }>(100),
            ])

            setData({
                catalog: catalogResponse.data.catalog ?? [],
                runs: runsResponse.data.runs ?? [],
                reconciliations: reconciliationsResponse.data.reconciliations ?? [],
            })
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar la paridad GA4.')
            setData(defaultParityData)
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

