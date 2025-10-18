import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import { NumericFormat } from 'react-number-format'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentPropsWithoutRef } from 'react'
import type { CurrencySummary as CurrencySummaryType } from '../store'

type CurrencySummaryProps = ComponentPropsWithoutRef<'div'> & {
    data?: CurrencySummaryType[]
}

type MetricKey = 'sales' | 'expenses' | 'taxes' | 'liquidIncome'
const METRIC_KEYS: MetricKey[] = ['sales', 'expenses', 'taxes', 'liquidIncome']

const CurrencySummary = ({ data = [], className }: CurrencySummaryProps) => {
    const { t, i18n } = useTranslation()

    const currencyLabels = useMemo(() => {
        const intlFormatter = new Intl.DisplayNames([i18n.language || 'es'], {
            type: 'currency',
        })

        const fallback = (code: string) =>
            intlFormatter.of(code) || code.toUpperCase()

        return {
            IUSD: fallback('USD'),
            UYU: fallback('UYU'),
            OTHER: t('accounting.dashboard.currencies.labels.other', {
                defaultValue: 'Otros',
            }),
        } as Record<string, string>
    }, [i18n.language, t])

    const filteredData = useMemo(
        () =>
            Array.isArray(data)
                ? data.filter((entry) => entry.currency !== 'OTHER')
                : [],
        [data],
    )

    const metrics = useMemo(
        () =>
            METRIC_KEYS.map((key) => ({
                key,
                label: t(`accounting.dashboard.summary.metrics.${key}`, {
                    defaultValue: key,
                }),
            })),
        [t],
    )

    const chartSeries = useMemo(() => {
        if (!Array.isArray(filteredData) || filteredData.length === 0) {
            return []
        }
        return filteredData.map((entry) => ({
            name: currencyLabels[entry.currency] ?? entry.currency,
            data: METRIC_KEYS.map((metricKey) => Number(entry[metricKey] ?? 0)),
        }))
    }, [filteredData, currencyLabels])

    const hasData = chartSeries.some((serie) =>
        serie.data.some((value) => Number(value) !== 0),
    )

    if (!Array.isArray(filteredData) || filteredData.length === 0) {
        return (
            <Card className={className}>
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-300">
                    {t('accounting.dashboard.summary.empty', {
                        defaultValue: 'No hay movimientos registrados para mostrar.',
                    })}
                </div>
            </Card>
        )
    }

    return (
        <div className={className}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {filteredData.map((entry) => {
                    const label =
                        currencyLabels[entry.currency] ?? entry.currency
                    return (
                        <Card key={entry.currency}>
                            <div className="flex items-center justify-between">
                                <h6 className="font-semibold text-sm">
                                    {t('accounting.dashboard.summary.cardTitle', {
                                        defaultValue: 'Resumen {{currency}}',
                                        currency: label,
                                    })}
                                </h6>
                                <span className="text-xs uppercase text-gray-500 dark:text-gray-300">
                                    {entry.currency}
                                </span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {metrics.map((metric) => (
                                    <div key={metric.key} className="flex flex-col">
                                        <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-300">
                                            {metric.label}
                                        </span>
                                        <span className="text-base font-semibold">
                                            <NumericFormat
                                                thousandSeparator
                                                displayType="text"
                                                value={Number(entry[metric.key] ?? 0)}
                                                prefix="$"
                                                decimalScale={2}
                                                fixedDecimalScale
                                            />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )
                })}
            </div>

            <Card className="mt-4">
                <h5 className="font-semibold">
                    {t('accounting.dashboard.summary.chartTitle', {
                        defaultValue: 'Comparativo por moneda',
                    })}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                    {t('accounting.dashboard.summary.chartSubtitle', {
                        defaultValue:
                            'Ventas, gastos, impuestos, saldo e ingreso líquido agrupados por moneda.',
                    })}
                </p>
                <div className="mt-6">
                    {hasData ? (
                        <Chart
                            type="bar"
                            series={chartSeries}
                            xAxis={metrics.map((metric) => metric.label)}
                            height="360px"
                            customOptions={{
                                plotOptions: {
                                    bar: {
                                        columnWidth: '45%',
                                    },
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
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                            {t('accounting.dashboard.summary.chartEmpty', {
                                defaultValue:
                                    'Sin datos suficientes para construir el gráfico.',
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}

export default CurrencySummary
