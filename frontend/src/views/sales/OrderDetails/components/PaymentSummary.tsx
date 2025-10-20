import Card from '@/components/ui/Card'
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

const PaymentSummary = ({ data, taxRate, currency }: PaymentSummaryProps) => {
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
        </Card>
    )
}

export default PaymentSummary
