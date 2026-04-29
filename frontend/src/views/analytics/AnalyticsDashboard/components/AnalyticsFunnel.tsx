import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import { useTranslation } from 'react-i18next'

import type { AnalyticsFunnelResponse } from '@/services/AnalyticsService'

type AnalyticsFunnelProps = {
    data?: AnalyticsFunnelResponse
}

const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return 'n/a'
    }
    return `${(value * 100).toFixed(2)}%`
}

const compareTone = (deltaPercent?: number | null) => {
    if (deltaPercent === null || deltaPercent === undefined) {
        return 'bg-gray-100 text-gray-600'
    }
    if (deltaPercent >= 0) {
        return 'bg-emerald-100 text-emerald-700'
    }
    return 'bg-rose-100 text-rose-700'
}

const AnalyticsFunnel = ({ data }: AnalyticsFunnelProps) => {
    const { i18n } = useTranslation()
    const funnelSeries = [
        {
            name: 'Sessions',
            data: (data?.steps ?? []).map((step) => step.sessions),
        },
    ]
    const funnelCategories = (data?.steps ?? []).map((step) => step.eventName)
    const comparison = data?.comparison ?? null
    const checkoutDeltaPercent = comparison?.rates.checkoutToPurchase.deltaPercent
    const comparisonText =
        checkoutDeltaPercent === null || checkoutDeltaPercent === undefined
            ? 'Sin comparación'
            : `${checkoutDeltaPercent >= 0 ? '+' : ''}${checkoutDeltaPercent}% vs período anterior`

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'Vista de producto',
                        value: data?.steps.find((step) => step.eventName === 'view_item')?.sessions ?? 0,
                    },
                    {
                        label: 'Agregar al carrito',
                        value: data?.steps.find((step) => step.eventName === 'add_to_cart')?.sessions ?? 0,
                    },
                    {
                        label: 'Iniciar checkout',
                        value: data?.steps.find((step) => step.eventName === 'begin_checkout')?.sessions ?? 0,
                    },
                    {
                        label: 'Compra',
                        value: data?.steps.find((step) => step.eventName === 'purchase')?.sessions ?? 0,
                    },
                ].map((step) => (
                    <Card key={step.label}>
                        <div className="text-sm text-gray-500">{step.label}</div>
                        <div className="mt-2 text-2xl font-semibold">
                            {new Intl.NumberFormat(i18n.language || undefined).format(step.value)}
                        </div>
                    </Card>
                ))}
            </div>

            <Card>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h5 className="mb-1">Flujo del embudo</h5>
                        <p className="text-sm text-gray-500">
                            Sesiones normalizadas por paso, usando `event_facts` en lugar de JSON crudo.
                        </p>
                    </div>
                    <Badge
                        content={comparisonText}
                        innerClass={compareTone(checkoutDeltaPercent)}
                    />
                </div>
                <Chart
                    type="bar"
                    height={320}
                    series={funnelSeries}
                    xAxis={funnelCategories}
                    customOptions={{
                        plotOptions: {
                            bar: {
                                horizontal: false,
                                borderRadius: 8,
                                columnWidth: '48%',
                            },
                        },
                        dataLabels: {
                            enabled: false,
                        },
                        legend: {
                            position: 'top',
                        },
                        colors: ['#0f766e'],
                    }}
                />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <div className="mb-4">
                        <h5 className="mb-1">Conversión por etapa</h5>
                        <p className="text-sm text-gray-500">
                            Conversión por etapa y comparación contra el período anterior.
                        </p>
                    </div>
                    <div className="space-y-3">
                        {(data?.steps ?? []).map((step, index) => {
                            const comparisonMetric = comparison?.steps?.[step.eventName]
                            const width = index === 0 ? 100 : Math.max(8, (step.sessions / ((data?.steps?.[0]?.sessions ?? 1))) * 100)
                            return (
                                <div key={step.eventName} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{step.eventName}</div>
                                            <div className="text-xs text-gray-500">
                                                {step.sessions} sesiones, {step.events} eventos
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {formatPercent(step.conversionFromPrevious)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                desde la etapa anterior
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-600">
                                        <div
                                            className="h-2 rounded-full bg-teal-500"
                                            style={{ width: `${width}%` }}
                                        />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                        <span>Desde el inicio: {formatPercent(step.conversionFromStart)}</span>
                                        <span>
                                            Previo: {comparisonMetric?.previous ?? 0} | Actual: {comparisonMetric?.current ?? step.sessions}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                <Card>
                    <div className="mb-4">
                        <h5 className="mb-1">Segmentación preparada</h5>
                        <p className="text-sm text-gray-500">
                            Placeholder para futuros cortes por canal y dispositivo.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                            La segmentación por canal puede construirse sobre las mismas facts normalizadas.
                        </div>
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                            Los cortes por dispositivo y país ya quedan capturados en `event_facts`.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default AnalyticsFunnel
