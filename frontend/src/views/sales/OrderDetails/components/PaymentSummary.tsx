import Card from '@/components/ui/Card'
import classNames from 'classnames'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

type PaymentInfoProps = {
    label?: string
    value?: number
    isLast?: boolean
    format: (value?: number) => string
}

type PaymentSummaryProps = {
    data?: {
        subTotal: number
        tax: number
        deliveryFees: number
        total: number
        currency?: string
    }
    taxRate?: number
    currency?: string
    paymentsSummary?: {
        totalPaidConfirmed: number
        outstanding: number
        currency: string
    } | null
}

const PaymentInfo = ({ label, value, isLast, format }: PaymentInfoProps) => {
    return (
        <li
            className={`flex items-center justify-between${
                !isLast ? ' mb-3' : ''
            }`}
        >
            <span>{label}</span>
            <span className="font-semibold">
                {format(value)}
            </span>
        </li>
    )
}

const PaymentSummary = ({ data, taxRate, currency, paymentsSummary }: PaymentSummaryProps) => {
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const normalizedCurrency = normalizeCurrencyCode(
        currency ?? data?.currency,
        defaultCurrency,
    )
    const formatValue = useMemo(
        () => (value?: number) =>
            formatCurrency(value, normalizedCurrency, i18n.language, {
                fallbackCurrency: defaultCurrency,
            }),
        [normalizedCurrency, i18n.language, defaultCurrency],
    )
    const taxLabel =
        typeof taxRate === 'number'
            ? t('text.labels.taxWithRate', { rate: taxRate })
            : t('text.labels.tax')
    const totalLabel = t('sales.orders.summary.totalDue', {
        defaultValue: 'Total due',
    })
    const paidAmount = paymentsSummary?.totalPaidConfirmed ?? 0
    const outstanding = paymentsSummary?.outstanding ?? (Number(data?.total ?? 0) - paidAmount)
    const remainingClass =
        outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
    const totalPaidLabel = t('sales.orders.payments.totalPaid', {
        defaultValue: 'Total paid',
    })
    const remainingLabel = t('sales.orders.payments.remaining', {
        defaultValue: 'Remaining',
    })
    const paymentsCurrency = paymentsSummary?.currency
        ? normalizeCurrencyCode(paymentsSummary.currency)
        : undefined
    const paidCurrency = normalizedCurrency ?? paymentsCurrency ?? defaultCurrency
    const formatPaid = useMemo(
        () => (value?: number) =>
            formatCurrency(value, paidCurrency, i18n.language, {
                fallbackCurrency: defaultCurrency,
            }),
        [paidCurrency, i18n.language, defaultCurrency],
    )

    return (
        <Card className="mb-4">
            <h5 className="mb-4">{t('text.titles.paymentSummary')}</h5>
            <ul>
                <PaymentInfo
                    label={t('text.labels.subtotal')}
                    value={data?.subTotal}
                    format={formatValue}
                />
                <PaymentInfo
                    label={t('text.labels.deliveryFee')}
                    value={data?.deliveryFees}
                    format={formatValue}
                />
                <PaymentInfo
                    label={taxLabel}
                    value={data?.tax}
                    format={formatValue}
                />
                <hr className="mb-3" />
                <PaymentInfo
                    isLast
                    label={totalLabel}
                    value={data?.total}
                    format={formatValue}
                />
            </ul>
            <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                        {totalPaidLabel}
                    </span>
                    <span className="font-semibold">{formatPaid(paidAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                        {remainingLabel}
                    </span>
                    <span className={classNames('font-semibold', remainingClass)}>
                        {formatPaid(outstanding)}
                    </span>
                </div>
            </div>
        </Card>
    )
}

export default PaymentSummary
