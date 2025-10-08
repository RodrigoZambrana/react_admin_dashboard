import { useCallback, useMemo } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '../store'

type ExpensesReportProps = {
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

const ExpensesReport = ({ className, data = {} }: ExpensesReportProps) => {
    const { t, i18n } = useTranslation()
    const dateRangePreset = useAppSelector(
        (state) => state.expensesDashboard.data.dateRangePreset,
    )
    const startDate = useAppSelector(
        (state) => state.expensesDashboard.data.startDate,
    )
    const endDate = useAppSelector(
        (state) => state.expensesDashboard.data.endDate,
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

    const sanitizedSeries = useMemo(() => {
        const rawSeries = Array.isArray(data.series) ? data.series : []
        return rawSeries.map((serie) => ({
            ...serie,
            data: (serie.data ?? []).map((value) => {
                if (typeof value === 'number') {
                    return Number.isFinite(value) ? value : 0
                }
                const numericValue = Number(value)
                return Number.isFinite(numericValue) ? numericValue : 0
            }),
        }))
    }, [data.series])

    const sanitizedCategories = useMemo(() => {
        if (!Array.isArray(data.categories)) {
            return [] as number[]
        }
        return data.categories.map((category) => {
            const numericCategory = Number(category)
            return Number.isFinite(numericCategory) ? numericCategory : 0
        })
    }, [data.categories])

    const normalizedData = useMemo(() => {
        const granularity = data.granularity ?? 'day'
        const categories = sanitizedCategories
        const series = sanitizedSeries

        const startMonth = dayjs.unix(startDate).startOf('month')
        const endMonth = dayjs.unix(endDate).startOf('month')
        const spansMultipleMonths = endMonth.diff(startMonth, 'month') > 0

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

        categories.forEach((categoryTs) => {
            const monthTs = dayjs.unix(categoryTs).startOf('month').unix()
            if (!monthIndexMap.has(monthTs)) {
                monthIndexMap.set(monthTs, monthOrder.length)
                monthOrder.push(monthTs)
            }
        })

        const aggregatedSeries = series.map((serie) => {
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
            series: aggregatedSeries,
        }
    }, [
        sanitizedCategories,
        sanitizedSeries,
        data.granularity,
        dateRangePreset,
        endDate,
        startDate,
    ])

    const formattedCategories = useMemo(() => {
        if (normalizedData.categories.length === 0) {
            return []
        }
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
            const current = dayjs
                .unix(category)
                .locale(currentLocale.toLowerCase().split('-')[0])

            if (
                normalizedData.granularity === 'hour' ||
                dateRangePreset === 'today'
            ) {
                return current.format('HH:mm')
            }
            if (normalizedData.granularity === 'month') {
                if (spansMultipleYears) {
                    return monthYearFormatter.format(current.toDate())
                }
                return monthFormatter.format(current.toDate())
            }

            switch (dateRangePreset) {
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
                case 'custom': {
                    if (spansMultipleYears) {
                        return current.format('DD MMM YYYY')
                    }
                    if (spansMultipleMonths) {
                        return current.format('DD MMM')
                    }
                    return current.format('DD MMM')
                }
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
        dateRangePreset,
        endDate,
        normalizedData.granularity,
        i18n.language,
        startDate,
    ])

    const hasSeriesData = useMemo(() => {
        if (normalizedData.series.length === 0) {
            return false
        }
        return normalizedData.series.some((serie) =>
            (serie.data ?? []).some((value) => Number(value) > 0),
        )
    }, [normalizedData.series])

    return (
        <Card className={className}>
            <div className="flex items-center justify-between">
                <h4>{t('expenses.dashboard.expensesReport.title')}</h4>
                <Button size="sm">
                    {t('expenses.dashboard.expensesReport.export')}
                </Button>
            </div>
            {hasSeriesData ? (
                <Chart
                    series={normalizedData.series}
                    xAxis={formattedCategories}
                    height="380px"
                    customOptions={{
                        legend: { show: false },
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
                        {t('expenses.dashboard.expensesReport.empty')}
                    </p>
                </div>
            )}
        </Card>
    )
}

export default ExpensesReport
