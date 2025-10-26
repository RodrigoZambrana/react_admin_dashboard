import { useMemo } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import { useAppSelector } from '@/store'
import dayjs from 'dayjs'
import { HiOutlineDocumentText, HiOutlineTrash } from 'react-icons/hi'
import Tooltip from '@/components/ui/Tooltip'

type PaymentRecord = {
    id: number
    orderId: number
    amount: number
    currency: string
    type: string
    status: string
    reference: string | null
    method: string | null
    paymentMethodId: number | null
    date: string
    notes: string | null
    createdAt: string
    updatedAt: string
    attachments: Array<{
        id: number
        name: string
        type: string | null
        size: number | null
        createdAt: string
        url: string
    }>
}

type OrderPaymentsCardProps = {
    orderId?: number
    orderCurrency?: string
    payments?: {
        summary: {
            totalPaidConfirmed: number
            outstanding: number
            currency: string
        } | null
        records: PaymentRecord[]
    }
    onAddPayment: () => void
    onDeleteAttachment?: (attachmentId: number) => Promise<void>
}

const ATTACHMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']

const OrderPaymentsCard = ({
    orderId,
    orderCurrency,
    payments,
    onAddPayment,
    onDeleteAttachment,
}: OrderPaymentsCardProps) => {
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const currencyForFormat = normalizeCurrencyCode(orderCurrency, defaultCurrency) || defaultCurrency

    const formatAmount = useMemo(
        () => (value?: number) =>
            formatCurrency(value, currencyForFormat, i18n.language, {
                fallbackCurrency: defaultCurrency,
            }),
        [currencyForFormat, i18n.language, defaultCurrency],
    )

    const handleDeleteAttachment = async (attachmentId: number) => {
        if (!onDeleteAttachment) {
            return
        }
        await onDeleteAttachment(attachmentId)
    }

    const attachmentLabel = (attachment: PaymentRecord['attachments'][number]) => {
        const extMatch = attachment.name.split('.').pop()?.toLowerCase()
        const extension =
            extMatch && ATTACHMENT_EXTENSIONS.includes(extMatch)
                ? extMatch.toUpperCase()
                : attachment.type?.split('/').pop()?.toUpperCase()
        return extension ? `${attachment.name} (${extension})` : attachment.name
    }

    return (
        <Card className="mb-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h5 className="mb-1">
                        {t('sales.orders.payments.title', {
                            defaultValue: 'Payments',
                        })}
                    </h5>
                    {orderId && (
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                            {t('sales.orders.payments.orderLabel', {
                                defaultValue: 'Order #{id}',
                                id: orderId,
                            })}
                        </p>
                    )}
                </div>
                <Button size="sm" variant="solid" onClick={onAddPayment}>
                    {t('sales.orders.payments.add', {
                        defaultValue: 'Add payment',
                    })}
                </Button>
            </div>
            {payments?.records?.length ? (
                <div className="space-y-3">
                    {payments.records.map((payment) => {
                        const typeLabel = t(`accounting.payments.type.${payment.type.toLowerCase()}`, {
                            defaultValue: payment.type,
                        })
                        const statusLabel = t(`accounting.payments.status.${payment.status.toLowerCase()}`, {
                            defaultValue: payment.status,
                        })
                        return (
                            <div
                                key={payment.id}
                                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <h6 className="font-semibold text-gray-800 dark:text-gray-100">
                                        {formatAmount(payment.amount)}
                                    </h6>
                                    <div className="text-sm text-gray-500 dark:text-gray-300">
                                        {t('sales.orders.payments.date', { defaultValue: 'Date' })}:{' '}
                                        {dayjs(payment.date).format('DD/MM/YYYY')}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-300">
                                        {t('sales.orders.payments.idLabel', { defaultValue: 'Payment ID' })}{' '}
                                        #{payment.id}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide">
                                    <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                                        {typeLabel}
                                    </span>
                                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-200">
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 grid gap-1 text-sm text-gray-600 dark:text-gray-300">
                                {payment.method && (
                                    <div>
                                        <span className="font-medium">
                                            {t('sales.orders.payments.method', {
                                                defaultValue: 'Method',
                                            })}
                                            :{' '}
                                        </span>
                                        {payment.method}
                                    </div>
                                )}
                                {payment.reference && (
                                    <div>
                                        <span className="font-medium">
                                            {t('text.columns.reference')}
                                            :{' '}
                                        </span>
                                        {payment.reference}
                                    </div>
                                )}
                                {payment.notes && (
                                    <div>
                                        <span className="font-medium">
                                            {t('text.columns.notes')}
                                            :{' '}
                                        </span>
                                        {payment.notes}
                                    </div>
                                )}
                            </div>
                            {payment.attachments.length > 0 && (
                                <div className="mt-3">
                                    <h6 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        {t('sales.orders.payments.attachments', {
                                            defaultValue: 'Attachments',
                                        })}
                                    </h6>
                                    <ul className="space-y-2">
                                        {payment.attachments.map((attachment) => (
                                            <li
                                                key={attachment.id}
                                                className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800/60 px-3 py-2 rounded-md"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineDocumentText className="text-lg text-gray-500 dark:text-gray-300" />
                                                    <a
                                                        href={attachment.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:underline text-gray-700 dark:text-gray-200"
                                                    >
                                                        {attachmentLabel(attachment)}
                                                    </a>
                                                </div>
                                                {onDeleteAttachment && (
                                                    <Tooltip title={t('text.actions.delete')}>
                                                        <button
                                                            type="button"
                                                            className="text-red-500 hover:text-red-600"
                                                            onClick={() =>
                                                                handleDeleteAttachment(attachment.id)
                                                            }
                                                        >
                                                            <HiOutlineTrash />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-300">
                    {t('sales.orders.payments.empty', {
                        defaultValue: 'No payments recorded yet.',
                    })}
                </div>
            )}
        </Card>
    )
}

export default OrderPaymentsCard
