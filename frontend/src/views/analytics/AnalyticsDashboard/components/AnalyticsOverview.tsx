import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import { useTranslation } from 'react-i18next'

import type { AnalyticsOverviewResponse } from '@/services/AnalyticsService'

type AnalyticsOverviewProps = {
    data?: AnalyticsOverviewResponse
}

const comparisonTone = (deltaPercent?: number | null) => {
    if (deltaPercent === null || deltaPercent === undefined) {
        return 'bg-gray-100 text-gray-600'
    }
    if (deltaPercent >= 0) {
        return 'bg-emerald-100 text-emerald-700'
    }
    return 'bg-rose-100 text-rose-700'
}

const formatCompactNumber = (value: number, locale?: string) =>
    new Intl.NumberFormat(locale || undefined, {
        maximumFractionDigits: 2,
    }).format(value)

const AnalyticsOverview = ({ data }: AnalyticsOverviewProps) => {
    const { i18n } = useTranslation()
    const comparison = data?.comparison ?? null

    const kpis = [
        {
            label: 'Revenue',
            value: formatCompactNumber(data?.revenue ?? 0, i18n.language),
            delta: comparison?.revenue.deltaPercent,
        },
        {
            label: 'Orders',
            value: formatCompactNumber(data?.orders ?? 0, i18n.language),
            delta: comparison?.orders.deltaPercent,
        },
        {
            label: 'Conversion rate',
            value: `${((data?.conversionRate ?? 0) * 100).toFixed(2)}%`,
            delta: comparison?.conversionRate.deltaPercent,
        },
        {
            label: 'Avg ticket',
            value: formatCompactNumber(data?.avgTicket ?? 0, i18n.language),
            delta: comparison?.avgTicket.deltaPercent,
        },
    ]

    const revenueSeries = [
        {
            name: 'Revenue',
            data: (data?.timeseries ?? []).map((entry) => entry.revenue),
        },
    ]

    const revenueCategories = (data?.timeseries ?? []).map((entry) =>
        new Intl.DateTimeFormat(i18n.language || undefined, {
            month: 'short',
            day: 'numeric',
        }).format(new Date(entry.date)),
    )

    const bestChannel = data?.channels?.[0]
    const bestProduct = data?.topProducts?.[0]
    const revenueDeltaPercent = comparison?.revenue.deltaPercent
    const revenueComparisonText =
        revenueDeltaPercent === null || revenueDeltaPercent === undefined
            ? 'No comparison'
            : `${revenueDeltaPercent >= 0 ? '+' : ''}${revenueDeltaPercent}% vs previous`

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                    <Card key={kpi.label}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm text-gray-500">{kpi.label}</div>
                                <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                    {kpi.value}
                                </div>
                            </div>
                            <Badge
                                content={
                                    kpi.delta === null || kpi.delta === undefined
                                        ? 'n/a'
                                        : `${kpi.delta >= 0 ? '+' : ''}${kpi.delta.toFixed(2)}%`
                                }
                                innerClass={comparisonTone(kpi.delta)}
                            />
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Revenue over time</h5>
                            <p className="text-sm text-gray-500">
                                Current period vs selected range with business context.
                            </p>
                        </div>
                    <Badge
                        content={revenueComparisonText}
                        innerClass={comparisonTone(revenueDeltaPercent)}
                    />
                </div>
                    <Chart
                        type="area"
                        height={320}
                        series={revenueSeries}
                        xAxis={revenueCategories}
                        customOptions={{
                            stroke: {
                                curve: 'smooth',
                                width: 3,
                            },
                            dataLabels: {
                                enabled: false,
                            },
                            legend: {
                                position: 'top',
                            },
                            colors: ['#6366f1', '#0f766e'],
                        }}
                    />
                </Card>

                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="mb-2 text-sm text-gray-500">Top channel</div>
                        <div className="text-lg font-semibold">
                            {bestChannel?.utmSource ?? data?.topChannel ?? 'Unknown'}
                        </div>
                        <div className="mt-3 text-sm text-gray-500">
                            Revenue: {formatCompactNumber(bestChannel?.revenue ?? 0, i18n.language)}
                        </div>
                        <div className="text-sm text-gray-500">
                            Orders: {formatCompactNumber(bestChannel?.orders ?? 0, i18n.language)}
                        </div>
                    </Card>
                    <Card>
                        <div className="mb-2 text-sm text-gray-500">Top product</div>
                        <div className="text-lg font-semibold">
                            {bestProduct?.name ?? bestProduct?.productId ?? data?.topProduct ?? 'Unknown'}
                        </div>
                        <div className="mt-3 text-sm text-gray-500">
                            Revenue: {formatCompactNumber(bestProduct?.revenue ?? 0, i18n.language)}
                        </div>
                        <div className="text-sm text-gray-500">
                            Views: {formatCompactNumber(bestProduct?.views ?? 0, i18n.language)}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <div className="mb-4">
                        <h5 className="mb-1">Channel mix</h5>
                        <p className="text-sm text-gray-500">
                            Revenue and orders by UTM source.
                        </p>
                    </div>
                    <div className="space-y-3">
                        {(data?.channels ?? []).slice(0, 5).map((channel) => (
                            <div
                                key={channel.utmSource ?? 'unknown'}
                                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40"
                            >
                                <div>
                                    <div className="font-medium">
                                        {channel.utmSource ?? 'unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatCompactNumber(channel.sessions, i18n.language)} sessions
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <div>{formatCompactNumber(channel.revenue, i18n.language)}</div>
                                    <div className="text-xs text-gray-500">
                                        {formatCompactNumber(channel.orders, i18n.language)} orders
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <div className="mb-4">
                        <h5 className="mb-1">Business insights</h5>
                        <p className="text-sm text-gray-500">
                            Rule-based signals generated from normalized data.
                        </p>
                    </div>
                    <div className="space-y-3">
                        {(data?.insights ?? []).length ? (
                            data?.insights.map((insight) => (
                                <div
                                    key={insight.code}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-medium">{insight.code}</div>
                                        <Badge
                                            content={insight.severity}
                                            innerClass={
                                                insight.severity === 'warning'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-sky-100 text-sky-700'
                                            }
                                        />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500">
                                        {insight.message}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700/40">
                                No active insight rules for this range.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default AnalyticsOverview
