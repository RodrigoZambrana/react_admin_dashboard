import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'

import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import { apiGetAnalyticsMetaMarketingData, type AnalyticsMetaMarketingResponse } from '@/services/AnalyticsService'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'

const statusTone = (status?: string | null) => {
    switch (status) {
        case 'ready':
            return 'bg-emerald-100 text-emerald-700'
        case 'partial':
            return 'bg-amber-100 text-amber-700'
        case 'not_ready':
            return 'bg-rose-100 text-rose-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const formatNumber = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

const AnalyticsMetaMarketingPage = () => {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<AnalyticsMetaMarketingResponse | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            try {
                const to = dayjs().toISOString()
                const from = dayjs().subtract(30, 'day').toISOString()
                const response = await apiGetAnalyticsMetaMarketingData<
                    AnalyticsMetaMarketingResponse,
                    { from?: string; to?: string }
                >({
                    from,
                    to,
                })
                if (active) {
                    setData(response.data)
                }
            } catch (error) {
                console.error(error)
                if (active) {
                    setData(null)
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        void load()
        return () => {
            active = false
        }
    }, [])

    const connection = data?.connection ?? null
    const insights = useMemo(
        () => [
            data?.meta_ads.events.view_content ?? 0,
            data?.meta_ads.events.lead ?? 0,
            data?.meta_ads.events.purchase ?? 0,
        ],
        [data],
    )

    return (
        <AnalyticsPageLayout
            title="Meta Ads"
            subtitle="Estado de conexión, calidad de match y señal de remarketing desde Pixel + CAPI."
        >
            <Loading loading={loading}>
                <div className="flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-4">
                        <Card>
                            <div className="text-sm text-gray-500">Estado de conexión</div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                {connection?.status ?? 'desconocido'}
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                {connection?.target.name ?? 'Meta no materializado todavía'}
                            </div>
                        </Card>
                        <Card>
                            <div className="text-sm text-gray-500">Calidad de match</div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                {formatPercent(data?.matchQuality ?? 0)}
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                Proporción de eventos con identificadores útiles.
                            </div>
                        </Card>
                        <Card>
                            <div className="text-sm text-gray-500">Estado de medición</div>
                            <div className="mt-2 flex items-center gap-2">
                                <Badge
                                    content={data?.measurementStatus ?? 'not_ready'}
                                    innerClass={statusTone(data?.measurementStatus)}
                                />
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                {data?.measurementStatus === 'ready'
                                    ? 'Listo para usar en decisiones de performance.'
                                    : 'La señal todavía es operable, pero no para conclusiones fuertes.'}
                            </div>
                        </Card>
                        <Card>
                            <div className="text-sm text-gray-500">Eventos Meta</div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                {formatNumber(data?.traffic.events ?? 0)}
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                {formatNumber(data?.traffic.sessions ?? 0)} sesiones con señal Meta.
                            </div>
                        </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="xl:col-span-2">
                            <div className="mb-4">
                                <h5 className="mb-1">Señal Meta Ads</h5>
                                <p className="text-sm text-gray-500">
                                    Tráfico, eventos y lectura operativa para remarketing y exclusión.
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        Spend
                                    </div>
                                    <div className="mt-2 text-xl font-semibold">
                                        {formatNumber(data?.meta_ads.spend ?? 0)}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        Clicks
                                    </div>
                                    <div className="mt-2 text-xl font-semibold">
                                        {formatNumber(data?.meta_ads.clicks ?? 0)}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                                        Impressions
                                    </div>
                                    <div className="mt-2 text-xl font-semibold">
                                        {formatNumber(data?.meta_ads.impressions ?? 0)}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <div className="text-xs text-gray-500">ViewContent</div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {formatNumber(data?.meta_ads.events.view_content ?? 0)}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <div className="text-xs text-gray-500">Lead</div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {formatNumber(data?.meta_ads.events.lead ?? 0)}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <div className="text-xs text-gray-500">Purchase</div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {formatNumber(data?.meta_ads.events.purchase ?? 0)}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <div className="mb-4">
                                <h5 className="mb-1">Lectura operativa</h5>
                                <p className="text-sm text-gray-500">
                                    Qué permite hacer esta señal hoy.
                                </p>
                            </div>
                            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                <div>
                                    {insights[0] > 0
                                        ? 'Hay actividad suficiente para remarketing y exclusión de convertidos.'
                                        : 'Todavía falta señal de tráfico Meta para remarketing confiable.'}
                                </div>
                                <div>
                                    {data?.measurementStatus === 'ready'
                                        ? 'La medición ya permite leer performance y optimización.'
                                        : 'La medición todavía no debe usarse para conclusiones duras sobre rentabilidad.'}
                                </div>
                                <div>
                                    {connection?.status === 'ready'
                                        ? 'Pixel + CAPI están habilitados como destino adicional del pipeline.'
                                        : 'La conexión no está lista o todavía falta configuración.'}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsMetaMarketingPage
