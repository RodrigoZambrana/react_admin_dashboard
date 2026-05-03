import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appPath } from '@/constants/route.constant'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import Container from '@/components/shared/Container'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Loading from '@/components/shared/Loading'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ExpenseAttachmentsField from '@/views/expenses/components/ExpenseAttachmentsField'
import { apiGetExpense, type ExpenseAttachment } from '@/services/ExpensesService'
import { useAppSelector } from '@/store'
import { resolveTextDirection } from '@/utils/textDirection'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

type ExpenseDetailRecord = {
    id: string
    vendor: string
    title: string
    amount: number
    date: number
    categoryName: string
    statusName: string
    statusColor?: string | null
    paymentMethodName: string
    paymentReference?: string
    note?: string
    currency?: string | null
    taxCreditEligible: boolean
}

const FieldItem = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
        </span>
        <span className="text-sm text-gray-900 dark:text-gray-100 break-words">{value}</span>
    </div>
)

const ExpenseDetail = () => {
    const { expenseId } = useParams()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<ExpenseDetailRecord | null>(null)
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([])
    const fallbackCurrency = useMemo(
        () => normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU',
        [storeCurrency],
    )

    const fetchExpense = useCallback(async (id: string) => {
        setLoading(true)
        setError(null)
        try {
            const response = await apiGetExpense<any, { id: string }>({ id })
            const payload = response.data
            if (!payload) {
                setData(null)
                setAttachments([])
                setError('expenses.detail.notFound')
                return
            }
            const normalized: ExpenseDetailRecord = {
                id: String(payload.id ?? id),
                vendor: payload.vendor || payload.title || '',
                title: payload.title || payload.vendor || '',
                amount: Number(payload.amount ?? 0),
                date: Number(payload.date ?? 0),
                categoryName: payload.categoryName || '',
                statusName: payload.statusName || '',
                statusColor: payload.statusColor || null,
                paymentMethodName: payload.paymentMethodName || '',
                paymentReference: payload.paymentReference || '',
                note: payload.note || payload.description || '',
                currency: payload.currency || null,
                taxCreditEligible:
                    payload?.taxCreditEligible !== undefined && payload?.taxCreditEligible !== null
                        ? Boolean(payload.taxCreditEligible)
                        : true,
            }
            setData(normalized)
            setAttachments(Array.isArray(payload.attachments) ? payload.attachments : [])
        } catch {
            setError('expenses.detail.loadError')
            setData(null)
            setAttachments([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!expenseId) {
            setLoading(false)
            setError('expenses.detail.invalidId')
            return
        }
        fetchExpense(expenseId)
    }, [expenseId, fetchExpense])

    const formattedAmount = useMemo(() => {
        const amount = data?.amount ?? 0
        const currency = data?.currency ?? fallbackCurrency
        return formatCurrency(amount, currency, i18n.language, {
            fallbackCurrency,
        })
    }, [data, fallbackCurrency, i18n.language])

    const handleEdit = () => {
        if (data) {
            navigate(`${appPath('accounting/expenses/edit/')}${data.id}`)
        }
    }

    const handleBack = () => {
        navigate(appPath('/accounting/expenses/list'))
    }

    const detailItems = useMemo(
        () => [
            {
                label: t('text.columns.vendor', { defaultValue: 'Proveedor' }),
                value: data?.vendor || t('common.labels.notSpecified', { defaultValue: 'No indicado' }),
            },
            {
                label: t('text.columns.category', { defaultValue: 'Categoría' }),
                value: data?.categoryName || t('common.labels.notSpecified', { defaultValue: 'No indicado' }),
            },
            {
                label: t('text.columns.paymentMethod', { defaultValue: 'Método de pago' }),
                value:
                    data?.paymentMethodName ||
                    t('common.labels.notSpecified', { defaultValue: 'No indicado' }),
            },
            {
                label: t('expenses.detail.fields.paymentReference', {
                    defaultValue: 'Referencia de pago',
                }),
                value: data?.paymentReference || '-',
            },
            {
                label: t('text.columns.taxCreditEligible', {
                    defaultValue: 'Genera crédito fiscal',
                }),
                value: data?.taxCreditEligible
                    ? t('common.labels.yes', { defaultValue: 'Sí' })
                    : t('common.labels.no', { defaultValue: 'No' }),
            },
            {
                label: t('text.columns.date'),
                value: data?.date
                    ? dayjs.unix(data.date).format('DD/MM/YYYY')
                    : t('common.labels.notSpecified', { defaultValue: 'No indicado' }),
            },
        ],
        [
            data?.vendor,
            data?.categoryName,
            data?.paymentMethodName,
            data?.paymentReference,
            data?.taxCreditEligible,
            data?.date,
            t,
        ],
    )

    const statusBadge = data?.statusName ? (
        <div className="flex items-center gap-2">
            <Badge
                className="!w-2.5 !h-2.5"
                style={{ backgroundColor: data.statusColor || '#6b7280' }}
            />
            <span className="capitalize text-sm">{data.statusName}</span>
        </div>
    ) : (
        <span className="text-sm text-gray-500">{t('common.labels.notSpecified', { defaultValue: 'No indicado' })}</span>
    )

    return (
        <Container className="h-full">
            <Loading loading={loading} type="cover">
                {data ? (
                    <div className="flex flex-col gap-4">
                        <AdaptableCard>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div>
                                        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                            {data.title || t('expenses.detail.title', { defaultValue: 'Detalle de gasto' })}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            #{data.id}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="plain" onClick={handleBack}>
                                            {t('text.actions.back', { defaultValue: 'Volver' })}
                                        </Button>
                                        <Button variant="solid" onClick={handleEdit}>
                                            {t('text.actions.edit', { defaultValue: 'Editar' })}
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    <FieldItem
                                        label={t('text.columns.amount')}
                                        value={
                                            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                {formattedAmount}
                                            </span>
                                        }
                                    />
                                    <FieldItem
                                        label={t('text.columns.status')}
                                        value={statusBadge}
                                    />
                                    {detailItems.map((item) => (
                                        <FieldItem key={item.label} label={item.label} value={item.value} />
                                    ))}
                                </div>
                                {data.note && (
                                    <div className="mt-2">
                                        <h6 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                            {t('text.columns.comments')}
                                        </h6>
                                        <p
                                            className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line"
                                            dir={resolveTextDirection(data.note)}
                                        >
                                            {data.note}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </AdaptableCard>

                        <AdaptableCard>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <h6 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                        {t('text.titles.attachments')}
                                    </h6>
                                    {attachments.length > 0 && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('expenses.detail.attachmentsCount', {
                                                defaultValue: '{{count}} adjuntos',
                                                count: attachments.length,
                                            })}
                                        </span>
                                    )}
                                </div>
                                <ExpenseAttachmentsField
                                    attachments={attachments}
                                    onChange={setAttachments}
                                    readOnly
                                />
                            </div>
                        </AdaptableCard>
                    </div>
                ) : (
                    !loading && (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <DoubleSidedImage
                                src="/img/others/img-2.png"
                                darkModeSrc="/img/others/img-2-dark.png"
                                alt={t('common.notFound.expense', { defaultValue: 'Gasto no encontrado' })}
                            />
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                                {t(error || 'expenses.detail.notFound', {
                                    defaultValue: 'No pudimos encontrar el gasto solicitado.',
                                })}
                            </h3>
                            <Button variant="twoTone" onClick={handleBack}>
                                {t('text.actions.back', { defaultValue: 'Volver' })}
                            </Button>
                        </div>
                    )
                )}
            </Loading>
        </Container>
    )
}

export default ExpenseDetail
