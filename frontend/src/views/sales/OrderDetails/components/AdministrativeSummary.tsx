import { useCallback, useState } from 'react'
import Card from '@/components/ui/Card'
import { HiChevronDown } from 'react-icons/hi'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

type AdministrativeItem = {
    id: string
    name: string
    quantity: number
    unitCost: number
    lineCost: number
    currency?: string
}

type AdministrativeSummaryProps = {
    title: string
    items: AdministrativeItem[]
    currency?: string
    totalCost: number
    netIncome: number
    totalCostLabel: string
    netIncomeLabel: string
}

const AdministrativeSummary = ({
    title,
    items,
    currency,
    totalCost,
    netIncome,
    totalCostLabel,
    netIncomeLabel,
}: AdministrativeSummaryProps) => {
    const { t, i18n } = useTranslation()
    const [expanded, setExpanded] = useState(false)

    const fallbackCurrency = currency || 'UYU'

    const formatAmount = useCallback(
        (amount: number, currencyOverride?: string) =>
            formatCurrency(
                amount,
                normalizeCurrencyCode(currencyOverride, fallbackCurrency) || fallbackCurrency,
                i18n.language,
                { fallbackCurrency },
            ),
        [fallbackCurrency, i18n.language],
    )

    const hasItems = items.length > 0

    return (
        <Card bodyClass="p-0 overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
                <span className="font-semibold text-gray-700 dark:text-gray-200">{title}</span>
                <HiChevronDown
                    className={classNames(
                        'text-xl text-gray-500 transition-transform duration-200',
                        expanded ? 'rotate-180' : 'rotate-0',
                    )}
                />
            </button>
            {expanded && (
                <div className="space-y-4 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                    {hasItems ? (
                        <div className="space-y-3 text-sm">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-3 text-gray-700 dark:text-gray-200"
                                >
                                    <div>
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('sales.orders.administrative.lineDetail', {
                                                defaultValue: '{{qty}} × {{unitCost}}',
                                                qty: item.quantity,
                                                unitCost: formatAmount(item.unitCost, item.currency),
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold">
                                        {formatAmount(item.lineCost, item.currency)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {t('sales.orders.administrative.empty', {
                                defaultValue: 'No cost data available',
                            })}
                        </div>
                    )}
                    <div className="space-y-2 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                            <span>{totalCostLabel}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                                {formatAmount(totalCost)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-700 dark:text-gray-100">
                            <span className="font-medium">{netIncomeLabel}</span>
                            <span className="font-semibold">
                                {formatAmount(netIncome)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    )
}

export default AdministrativeSummary
