import Card from '@/components/ui/Card'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { normalizeCurrencyCode } from '@/utils/currency'
import type { FxSnapshot } from '@/adapters/sales'
import type { ComponentPropsWithoutRef } from 'react'

type FxSnapshotSummaryProps = ComponentPropsWithoutRef<'div'> & {
    snapshot?: FxSnapshot | null
    orderCurrency?: string
}

const toRateEntries = (snapshot?: FxSnapshot | null) => {
    if (!snapshot || !snapshot.base || !snapshot.rates) {
        return []
    }
    return Object.entries(snapshot.rates)
}

const FxSnapshotSummary = ({
    snapshot,
    orderCurrency,
    className,
    ...rest
}: FxSnapshotSummaryProps) => {
    const { t, i18n } = useTranslation()

    if (!snapshot || !snapshot.base) {
        return null
    }

    const normalizedBase =
        normalizeCurrencyCode(snapshot.base, orderCurrency) ||
        snapshot.base.toUpperCase()

    const entries = toRateEntries(snapshot)
        .map(([code, value]) => {
            const normalizedCode =
                normalizeCurrencyCode(code, normalizedBase) ||
                code.toUpperCase()
            const numeric = Number(value)
            if (!Number.isFinite(numeric)) {
                return null
            }
            return {
                currency: normalizedCode,
                rate: numeric,
            }
        })
        .filter((entry) => entry && entry.currency)
        .filter((entry) => entry?.currency !== normalizedBase) as {
        currency: string
        rate: number
    }[]

    if (entries.length === 0) {
        return null
    }

    const formattedGeneratedAt = snapshot.generatedAt
        ? dayjs(snapshot.generatedAt).locale(i18n.language).format('DD/MM/YYYY HH:mm')
        : null

    return (
        <Card className={className} {...rest}>
            <h5 className="mb-4">{t('text.titles.conversionSnapshot')}</h5>
            <dl className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">
                        {t('text.labels.baseCurrency')}
                    </dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-100">
                        {normalizedBase}
                    </dd>
                </div>
                {formattedGeneratedAt && (
                    <div className="flex items-center justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">
                            {t('text.labels.snapshotGeneratedAt')}
                        </dt>
                        <dd className="font-semibold text-gray-800 dark:text-gray-100">
                            {formattedGeneratedAt}
                        </dd>
                    </div>
                )}
            </dl>
            <div className="mt-4">
                <h6 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('text.labels.conversionRates')}
                </h6>
                <div className="mt-2 space-y-1 text-sm">
                    {entries.map((entry) => (
                        <div
                            key={entry.currency}
                            className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-1 dark:border-gray-700 dark:bg-gray-700/40"
                        >
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                                {entry.currency}
                            </span>
                            <span className="text-gray-700 dark:text-gray-200">
                                {entry.rate.toLocaleString(i18n.language, {
                                    minimumFractionDigits: 4,
                                    maximumFractionDigits: 4,
                                })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export default FxSnapshotSummary
