import Card from '@/components/ui/Card'
import { useTranslation } from 'react-i18next'
import { NumericFormat } from 'react-number-format'

type PaymentInfoProps = {
    label?: string
    value?: number
    isLast?: boolean
}

type PaymentSummaryProps = {
    data?: {
        subTotal: number
        tax: number
        deliveryFees: number
        total: number
    }
    taxRate?: number
}

const PaymentInfo = ({ label, value, isLast }: PaymentInfoProps) => {
    return (
        <li
            className={`flex items-center justify-between${
                !isLast ? ' mb-3' : ''
            }`}
        >
            <span>{label}</span>
            <span className="font-semibold">
                <NumericFormat
                    displayType="text"
                    value={(Math.round((value as number) * 100) / 100).toFixed(
                        2,
                    )}
                    prefix={'$'}
                    thousandSeparator={true}
                />
            </span>
        </li>
    )
}

const PaymentSummary = ({ data, taxRate }: PaymentSummaryProps) => {
    const { t } = useTranslation()
    const taxLabel =
        typeof taxRate === 'number'
            ? t('text.labels.taxWithRate', { rate: taxRate })
            : t('text.labels.tax')
    return (
        <Card className="mb-4">
            <h5 className="mb-4">{t('text.titles.paymentSummary')}</h5>
            <ul>
                <PaymentInfo label={t('text.labels.subtotal')} value={data?.subTotal} />
                <PaymentInfo label={t('text.labels.deliveryFee')} value={data?.deliveryFees} />
                <PaymentInfo label={taxLabel} value={data?.tax} />
                <hr className="mb-3" />
                <PaymentInfo isLast label={t('text.columns.total')} value={data?.total} />
            </ul>
        </Card>
    )
}

export default PaymentSummary
