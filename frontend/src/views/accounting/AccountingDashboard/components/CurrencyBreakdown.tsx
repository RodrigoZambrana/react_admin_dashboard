import Card from '@/components/ui/Card'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentPropsWithoutRef } from 'react'
import type { AccountingDashboardData, CurrencyBreakdown, MonthlyAccountingStat } from '../store'

type CurrencyBreakdownProps = ComponentPropsWithoutRef<'div'> & {
    totals?: AccountingDashboardData['totals']
    monthly?: MonthlyAccountingStat[]
}

type CurrencyKey = keyof CurrencyBreakdown

const CURRENCY_ORDER: CurrencyKey[] = ['IUSD', 'UYU', 'OTHER']

type TableMetricKey = 'sales' | 'expenses' | 'taxes' | 'balance' | 'liquidIncome'

const formatNumber = (value: number, locale?: string) =>
    Number(value || 0).toLocaleString(locale || undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })

const CurrencyBreakdown = ({ totals, monthly, className }: CurrencyBreakdownProps) => {
    const { t, i18n } = useTranslation()

    const metricDefinitions: { key: TableMetricKey; label: string }[] = useMemo(
        () => [
            {
                key: 'sales',
                label: t('accounting.dashboard.currencies.table.sales', { defaultValue: 'Ventas' }),
            },
            {
                key: 'expenses',
                label: t('accounting.dashboard.currencies.table.expenses', { defaultValue: 'Gastos' }),
            },
            {
                key: 'taxes',
                label: t('accounting.dashboard.currencies.table.taxes', { defaultValue: 'Impuestos' }),
            },
            {
                key: 'balance',
                label: t('accounting.dashboard.currencies.table.balance', { defaultValue: 'Saldo' }),
            },
            {
                key: 'liquidIncome',
                label: t('accounting.dashboard.currencies.table.liquidIncome', {
                    defaultValue: 'Ingreso líquido',
                }),
            },
        ],
        [t],
    )

    const currencyLabels: Record<CurrencyKey, string> = useMemo(
        () => ({
            IUSD: t('accounting.dashboard.currencies.labels.iusd', {
                defaultValue: 'IUSD',
            }),
            UYU: t('accounting.dashboard.currencies.labels.uyu', {
                defaultValue: 'UYU',
            }),
            OTHER: t('accounting.dashboard.currencies.labels.other', {
                defaultValue: 'Otros',
            }),
        }),
        [t],
    )

    const totalRows = useMemo(() => {
        if (!totals) {
            return []
        }
        return CURRENCY_ORDER.map((code) => {
            const sales = Number(totals.salesByCurrency?.[code] ?? 0)
            const expenses = Number(totals.expensesByCurrency?.[code] ?? 0)
            const taxes = Number(totals.taxesByCurrency?.[code] ?? 0)
            const balance = Number(totals.balanceByCurrency?.[code] ?? sales - expenses)
            const liquidIncome = Number(totals.netIncomeByCurrency?.[code] ?? sales - (expenses + taxes))
            return {
                key: code,
                label: currencyLabels[code],
                metrics: {
                    sales,
                    expenses,
                    taxes,
                    balance,
                    liquidIncome,
                },
            }
        })
    }, [totals, currencyLabels])

    const hasTotalData = totalRows.some((row) =>
        metricDefinitions.some((metric) => Number(row.metrics[metric.key]) !== 0),
    )

    const monthlyRows = useMemo(() => {
        if (!Array.isArray(monthly) || monthly.length === 0) {
            return []
        }
        const formatter = new Intl.DateTimeFormat(i18n.language || dayjs.locale(), {
            month: 'short',
            year: 'numeric',
        })
        return monthly.map((entry) => ({
            monthKey: String(entry.month),
            monthLabel: formatter.format(dayjs.unix(Number(entry.month || 0)).toDate()),
            breakdown: CURRENCY_ORDER.map((code) => {
                const sales = Number(entry.salesByCurrency?.[code] ?? 0)
                const expenses = Number(entry.expensesByCurrency?.[code] ?? 0)
                const taxes = Number(entry.taxesByCurrency?.[code] ?? 0)
                const liquidIncome = Number(entry.netIncomeByCurrency?.[code] ?? sales - (expenses + taxes))
                const balance = Number(sales - expenses)
                return {
                    key: `${entry.month}-${code}`,
                    label: currencyLabels[code],
                    metrics: {
                        sales,
                        expenses,
                        taxes,
                        balance,
                        liquidIncome,
                    },
                }
            }),
        }))
    }, [monthly, i18n.language, currencyLabels])

    const renderTableHeader = () => (
        <div className="grid grid-cols-6 gap-3 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-200">
            <span>{t('accounting.dashboard.currencies.table.currency', { defaultValue: 'Moneda' })}</span>
            {metricDefinitions.map((metric) => (
                <span key={metric.key} className="text-right">
                    {metric.label}
                </span>
            ))}
        </div>
    )

    const renderTableRows = (
        rows: Array<{
            key: string
            label: string
            metrics: Record<TableMetricKey, number>
        }>,
    ) =>
        rows.map((row, rowIndex) => (
            <div
                key={row.key}
                className={`grid grid-cols-6 gap-3 px-4 py-2 text-sm ${
                    rowIndex % 2 === 0
                        ? 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                        : 'bg-gray-50 text-gray-700 dark:bg-gray-800/70 dark:text-gray-200'
                }`}
            >
                <span className="font-medium">{row.label}</span>
                {metricDefinitions.map((metric) => (
                    <span key={metric.key} className="text-right">
                        {formatNumber(row.metrics[metric.key], i18n.language)}
                    </span>
                ))}
            </div>
        ))

    return (
        <Card className={className}>
            <h4>
                {t('accounting.dashboard.currencies.title', {
                    defaultValue: 'Movimientos por moneda',
                })}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-300">
                {t('accounting.dashboard.currencies.subtitle', {
                    defaultValue: 'Compara ventas, gastos, impuestos y resultados por tipo de moneda',
                })}
            </p>

            <div className="mt-6 space-y-6">
                <section>
                    <h5 className="text-sm font-semibold text-gray-600 dark:text-gray-200">
                        {t('accounting.dashboard.currencies.totalsTitle', {
                            defaultValue: 'Totales por moneda',
                        })}
                    </h5>
                    <div className="mt-3">
                        {hasTotalData ? (
                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                                {renderTableHeader()}
                                {renderTableRows(totalRows)}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                {t('accounting.dashboard.currencies.totalsEmpty', {
                                    defaultValue: 'Aún no hay movimientos registrados.',
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <section>
                    <h5 className="text-sm font-semibold text-gray-600 dark:text-gray-200">
                        {t('accounting.dashboard.currencies.monthlyTitle', {
                            defaultValue: 'Detalle mensual',
                        })}
                    </h5>
                    <div className="mt-3 space-y-4 max-h-80 overflow-y-auto pr-1">
                        {monthlyRows.length > 0 ? (
                            monthlyRows.map((row) => {
                                const hasData = row.breakdown.some((entry) =>
                                    metricDefinitions.some(
                                        (metric) => Number(entry.metrics[metric.key] || 0) !== 0,
                                    ),
                                )
                                return (
                                    <div
                                        key={row.monthKey}
                                        className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                                            {row.monthLabel}
                                        </div>
                                        <div className="mt-3">
                                            {hasData ? (
                                                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                                                    {renderTableHeader()}
                                                    {renderTableRows(row.breakdown)}
                                                </div>
                                            ) : (
                                                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                                    {t('accounting.dashboard.currencies.monthlyEmpty', {
                                                        defaultValue: 'Sin movimientos registrados.',
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                {t('accounting.dashboard.currencies.monthlyEmpty', {
                                    defaultValue: 'No hay movimientos para mostrar.',
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </Card>
    )
}

export default CurrencyBreakdown

