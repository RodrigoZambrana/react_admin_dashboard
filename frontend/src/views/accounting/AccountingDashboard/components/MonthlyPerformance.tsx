import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import dayjs from 'dayjs'
import classNames from 'classnames'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '../store'
import type { ComponentPropsWithoutRef } from 'react'
import type { MonthlyAccountingStat } from '../store'

type MonthlyPerformanceProps = ComponentPropsWithoutRef<'div'> & {
    data?: MonthlyAccountingStat[]
}

const MonthlyPerformance = ({
    data = [],
    className,
}: MonthlyPerformanceProps) => {
    const { t, i18n } = useTranslation()
    const startDate = useAppSelector(
        (state) => state.accountingDashboard.data.startDate,
    )
    const endDate = useAppSelector(
        (state) => state.accountingDashboard.data.endDate,
    )

    const normalizedData = useMemo(() => {
        if (!Array.isArray(data)) {
            return []
        }
        return data.map((entry) => ({
            month: Number(entry.month ?? 0),
            sales: Number(entry.sales ?? 0),
            expenses: Number(entry.expenses ?? 0),
            taxes: Number(entry.taxes ?? 0),
            netIncome: Number(entry.netIncome ?? 0),
        }))
    }, [data])

    const hasData = useMemo(
        () =>
            normalizedData.some(
                (entry) =>
                    entry.sales > 0 ||
                    entry.expenses > 0 ||
                    entry.taxes > 0 ||
                    entry.netIncome > 0,
        ),
        [normalizedData],
    )

    const categoryLabels = useMemo(() => {
        const locale = i18n.language || dayjs.locale()
        const monthFormatter = new Intl.DateTimeFormat(locale, {
            month: 'short',
            year: 'numeric',
        })
        return normalizedData.map((entry) => {
            const ts =
                entry.month && Number.isFinite(entry.month)
                    ? entry.month
                    : dayjs().startOf('month').unix()
            return monthFormatter.format(dayjs.unix(ts).toDate())
        })
    }, [normalizedData, i18n.language])

    const series = useMemo(
        () => [
            {
                name: t('accounting.dashboard.monthly.series.sales', {
                    defaultValue: 'Ventas',
                }),
                data: normalizedData.map((entry) => entry.sales),
            },
            {
                name: t('accounting.dashboard.monthly.series.expenses', {
                    defaultValue: 'Gastos',
                }),
                data: normalizedData.map((entry) => entry.expenses),
            },
            {
                name: t('accounting.dashboard.monthly.series.taxes', {
                    defaultValue: 'Impuestos',
                }),
                data: normalizedData.map((entry) => entry.taxes),
            },
            {
                name: t('accounting.dashboard.monthly.series.netIncome', {
                    defaultValue: 'Ingresos',
                }),
                data: normalizedData.map((entry) => entry.netIncome),
            },
        ],
        [normalizedData, t],
    )

    return (
        <Card className={classNames(className)}>
            <div className="flex items-center justify-between">
                <div>
                    <h4>
                        {t('accounting.dashboard.monthly.title', {
                            defaultValue: 'Estadísticas mensuales',
                        })}
                    </h4>
                    <p className="text-sm text-gray-500">
                        {t('accounting.dashboard.monthly.subtitle', {
                            defaultValue: 'Resumen acumulado por mes',
                        })}
                    </p>
                </div>
                <span className="text-xs font-semibold uppercase text-gray-500">
                    {t('accounting.dashboard.monthly.rangeLabel', {
                        defaultValue: 'Rango seleccionado',
                    })}{' '}
                    {dayjs.unix(startDate).format('DD MMM YYYY')} -{' '}
                    {dayjs.unix(endDate).format('DD MMM YYYY')}
                </span>
            </div>
            <div className="mt-6">
                {hasData ? (
                    <Chart
                        type="bar"
                        series={series}
                        xAxis={categoryLabels}
                        height="380px"
                        customOptions={{
                            legend: { position: 'top' },
                            plotOptions: {
                                bar: {
                                    columnWidth: '48%',
                                    borderRadius: 6,
                                    distributed: false,
                                },
                            },
                            stroke: {
                                show: true,
                                width: 2,
                                colors: ['transparent'],
                            },
                            dataLabels: { enabled: false },
                            yaxis: {
                                labels: {
                                    formatter: (value: number) =>
                                        Number(value).toLocaleString(
                                            i18n.language || undefined,
                                            {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 2,
                                            },
                                        ),
                                },
                            },
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-300">
                        <div className="h-32 w-full max-w-[320px] rounded-lg border-2 border-dashed border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700/40" />
                        <p className="mt-6 text-sm font-medium">
                            {t('accounting.dashboard.monthly.empty', {
                                defaultValue:
                                    'No hay datos de contabilidad para el período seleccionado',
                            })}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}

export default MonthlyPerformance
