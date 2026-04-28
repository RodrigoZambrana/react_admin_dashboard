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
            ? 'No comparison'
            : `${checkoutDeltaPercent >= 0 ? '+' : ''}${checkoutDeltaPercent}% vs previous`

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'View item',
                        value: data?.steps.find((step) => step.eventName === 'view_item')?.sessions ?? 0,
                    },
                    {
                        label: 'Add to cart',
                        value: data?.steps.find((step) => step.eventName === 'add_to_cart')?.sessions ?? 0,
                    },
                    {
                        label: 'Begin checkout',
                        value: data?.steps.find((step) => step.eventName === 'begin_checkout')?.sessions ?? 0,
                    },
                    {
                        label: 'Purchase',
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
                        <h5 className="mb-1">Funnel flow</h5>
                        <p className="text-sm text-gray-500">
                            Normalized sessions by step, using event_facts instead of raw JSON.
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
                        <h5 className="mb-1">Step conversions</h5>
                        <p className="text-sm text-gray-500">
                            Conversion by step and previous period comparison.
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
                                                {step.sessions} sessions, {step.events} events
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {formatPercent(step.conversionFromPrevious)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                from previous step
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
                                        <span>From start: {formatPercent(step.conversionFromStart)}</span>
                                        <span>
                                            Prev: {comparisonMetric?.previous ?? 0} | Current: {comparisonMetric?.current ?? step.sessions}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                <Card>
                    <div className="mb-4">
                        <h5 className="mb-1">Prepared segmentation</h5>
                        <p className="text-sm text-gray-500">
                            Placeholder for future channel and device splits.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                            Channel segmentation can be layered over the same normalized facts.
                        </div>
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                            Device and country breakdowns are already captured in `event_facts`.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default AnalyticsFunnel
