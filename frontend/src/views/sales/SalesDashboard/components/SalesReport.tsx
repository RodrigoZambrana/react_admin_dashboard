import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import dayjs from 'dayjs'
import { useCallback, useMemo } from 'react'
import { useAppSelector } from '../store'
import { useTranslation } from 'react-i18next'

type SalesReportProps = {
    data?: {
        series?: {
            name: string
            data: number[]
        }[]
        categories?: number[]
        granularity?: 'hour' | 'day' | 'month'
    }
    className?: string
}

const SalesReport = ({ className, data = {} }: SalesReportProps) => {
    const { t, i18n } = useTranslation()
    const dateRangePreset = useAppSelector(
        (state) => state.salesDashboard.data.dateRangePreset,
    )
    const startDate = useAppSelector(
        (state) => state.salesDashboard.data.startDate,
    )
    const endDate = useAppSelector(
        (state) => state.salesDashboard.data.endDate,
    )

    const formatYAxisLabel = useCallback(
        (value: number | string) => {
            const numericValue = Number(value)
            if (Number.isNaN(numericValue)) {
                return '0'
            }
            return numericValue.toLocaleString(i18n.language || undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            })
        },
        [i18n.language],
    )

    const normalizedData = useMemo(() => {
        const granularity = data.granularity ?? 'day'
        const categories = Array.isArray(data.categories)
            ? data.categories
            : []
        const series = Array.isArray(data.series) ? data.series : []

        const start = dayjs.unix(startDate).startOf('month')
        const end = dayjs.unix(endDate).startOf('month')
        const spansMultipleMonths = end.diff(start, 'month') > 0

        const shouldGroupToMonths =
            granularity !== 'month' &&
            (dateRangePreset === 'thisYear' ||
                (dateRangePreset === 'custom' && spansMultipleMonths))

        if (!shouldGroupToMonths) {
            return {
                granularity,
                categories,
                series,
            }
        }

        const monthOrder: number[] = []
        const monthIndexMap = new Map<number, number>()

        categories.forEach((categoryTs, index) => {
            const tsNumber = Number(categoryTs)
            if (Number.isNaN(tsNumber)) {
                return
            }
            const monthTs = dayjs
                .unix(tsNumber)
                .startOf('month')
                .unix()
            if (!monthIndexMap.has(monthTs)) {
                monthIndexMap.set(monthTs, monthOrder.length)
                monthOrder.push(monthTs)
            }
        })

        const groupedSeries = series.map((serie) => {
            const aggregated = new Array(monthOrder.length).fill(0)
            serie.data.forEach((value, idx) => {
                const categoryTs = Number(categories[idx])
                if (Number.isNaN(categoryTs)) {
                    return
                }
                const monthTs = dayjs
                    .unix(categoryTs)
                    .startOf('month')
                    .unix()
                const monthIndex = monthIndexMap.get(monthTs)
                if (monthIndex === undefined) {
                    return
                }
                aggregated[monthIndex] += Number(value) || 0
            })
            return {
                ...serie,
                data: aggregated,
            }
        })

        return {
            granularity: 'month' as const,
            categories: monthOrder,
            series: groupedSeries,
        }
    }, [data.categories, data.series, dateRangePreset, endDate, startDate])

    const salesSeries = useMemo(() => {
        if (!Array.isArray(normalizedData.series)) {
            return []
        }

        return normalizedData.series
            .filter((serie) => Array.isArray(serie.data))
            .map((serie) => {
                const sanitizedData = serie.data.map((value) => {
                    const numericValue =
                        typeof value === 'number' ? value : Number(value)
                    return Number.isFinite(numericValue) ? numericValue : 0
                })

                const normalizedName = (serie.name || '').toLowerCase()
                let translatedName = serie.name?.trim() || ''
                if (normalizedName.includes('net') && normalizedName.includes('income')) {
                    translatedName = t('sales.dashboard.salesReport.netIncomeLine')
                } else if (normalizedName.includes('revenue') || normalizedName.includes('venta') || normalizedName.includes('sale')) {
                    translatedName = t('sales.dashboard.salesReport.revenueLine')
                } else if (!translatedName) {
                    translatedName = t('sales.dashboard.salesReport.title')
                }

                return {
                    ...serie,
                    name: translatedName,
                    data: sanitizedData,
                }
            })
    }, [normalizedData.series, t])

    const formattedCategories = useMemo(() => {
        if (normalizedData.categories.length === 0) {
            return []
        }

        const { granularity } = normalizedData
        const start = dayjs.unix(startDate)
        const end = dayjs.unix(endDate)
        const spansMultipleMonths =
            end.startOf('day').diff(start.startOf('day'), 'month') > 0
        const spansMultipleYears =
            end.startOf('day').diff(start.startOf('day'), 'year') > 0
        const currentLocale = i18n.language || dayjs.locale()
        const monthFormatter = new Intl.DateTimeFormat(currentLocale, {
            month: 'short',
        })
        const monthYearFormatter = new Intl.DateTimeFormat(currentLocale, {
            month: 'short',
            year: 'numeric',
        })

        return normalizedData.categories.map((category) => {
            const ts = Number(category)
            if (Number.isNaN(ts)) {
                return ''
            }
            const current = dayjs.unix(ts).locale(
                currentLocale.toLowerCase().split('-')[0],
            )

            if (granularity === 'hour') {
                return current.format('HH:mm')
            }
            if (granularity === 'month') {
                if (spansMultipleYears) {
                    return monthYearFormatter.format(current.toDate())
                }
                return monthFormatter.format(current.toDate())
            }

            switch (dateRangePreset) {
                case 'today':
                    return current.format('HH:mm')
                case 'thisMonth':
                    return current.format('DD')
                case 'thisWeek':
                    return current.format('ddd DD')
                case 'thisYear':
                    return current.format('DD MMM')
                case 'last15Days':
                    return spansMultipleMonths || spansMultipleYears
                        ? current.format('DD MMM')
                        : current.format('DD')
                default:
                    if (spansMultipleYears) {
                        return current.format('DD MMM YYYY')
                    }
                    if (spansMultipleMonths) {
                        return current.format('DD MMM')
                    }
                    return current.format('DD MMM')
            }
        })
    }, [
        normalizedData.categories,
        normalizedData.granularity,
        dateRangePreset,
        endDate,
        startDate,
        i18n.language,
    ])

    const hasSeriesData = useMemo(() => {
        if (salesSeries.length === 0) {
            return false
        }
        return salesSeries.some((serie) =>
            (serie.data ?? []).some((value) => Number(value) > 0),
        )
    }, [salesSeries])

    return (
        <Card className={className}>
            <div className="flex items-center justify-between">
                <h4>{t('sales.dashboard.salesReport.title')}</h4>
                <Button size="sm">{t('sales.dashboard.salesReport.export')}</Button>
            </div>
            {hasSeriesData ? (
                <Chart
                    series={salesSeries}
                    xAxis={formattedCategories}
                    height="380px"
                    customOptions={{
                        legend: { show: true },
                        yaxis: {
                            labels: {
                                formatter: (val: number | string) =>
                                    formatYAxisLabel(val),
                            },
                        },
                    }}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-300">
                    <div className="h-32 w-full max-w-[320px] rounded-lg border-2 border-dashed border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700/40" />
                    <p className="mt-6 text-sm font-medium">
                        {t('sales.dashboard.salesReport.empty')}
                    </p>
                </div>
            )}
        </Card>
    )
}

export default SalesReport
