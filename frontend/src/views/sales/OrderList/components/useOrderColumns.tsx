import { useMemo } from 'react'
import { appPath } from '@/constants/route.constant'
import Select from '@/components/ui/Select'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import useThemeClass from '@/utils/hooks/useThemeClass'
import type { ColumnDef } from '@/components/shared/DataTable'
import type { SalesDocumentSummaryComputation } from '@/utils/salesDocumentCalculations'
import { formatOrderMoney } from '@/utils/orderMoney'

export type Order = {
    id: string
    uuid?: string
    orderNumber?: string
    reference?: string
    date: number
    customer: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
    orderCurrency?: string
    paymentSummary?: {
        subTotal?: number
        deliveryFees?: number
        tax?: number
        total?: number
        currency?: string
    }
    computedSummary?: SalesDocumentSummaryComputation
    payments?: {
        summary?: {
            currency?: string
            totalPaidConfirmed?: number
            outstanding?: number
        } | null
    }
}

const resolveDisplayIdentifier = (order: Order): string =>
    order.uuid?.trim() ||
    order.orderNumber?.trim() ||
    order.reference?.trim() ||
    order.id

type Params = {
    t: (k: string) => string
    statuses: { id: number; name: string; dotClass: string; textClass: string; customColor?: string }[]
    onChangeStatus: (row: Order, statusId: number) => void
    selectOnly?: boolean
}

export function useOrderColumns({ t, statuses, onChangeStatus, selectOnly: _selectOnly = true }: Params) {
    const navigate = useNavigate()
    const { textTheme } = useThemeClass()

    // Use formatOptionLabel to unify menu and value rendering and keep alignment

    return useMemo<ColumnDef<Order>[]>(() => {
        return [
            {
                header: t('text.columns.order'),
                accessorKey: 'id',
                cell: (props) => {
                    const row = props.row.original
                    const displayIdentifier = resolveDisplayIdentifier(row)
                    return (
                        <span
                            className={`cursor-pointer select-none font-semibold hover:${textTheme}`}
                            onClick={() => navigate(`${appPath('sales/order-details/')}${displayIdentifier}`)}
                        >
                            #{displayIdentifier}
                        </span>
                    )
                },
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const statusId =
                        typeof (row as any).status === 'string'
                            ? parseInt((row as any).status as unknown as string, 10)
                            : (row as any).status
                    const s = statuses.find((x) => x.id === statusId)
                    const options = statuses.map((x) => ({
                        value: x.id,
                        label: x.name,
                        dotClass: x.dotClass,
                        textClass: x.textClass,
                        customColor: x.customColor,
                    }))
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{
                                    value: s?.id ?? statusId,
                                    label: s?.name ?? String(statusId),
                                    dotClass: s?.dotClass ?? 'bg-gray-400',
                                    textClass: s?.textClass ?? 'text-gray-600',
                                    customColor: s?.customColor,
                                } as any}
                                formatOptionLabel={(option: any) => (
                                    <div className="flex items-center">
                                        <span
                                            className={`badge-dot ${option.dotClass || 'bg-gray-400'}`}
                                            style={option.customColor ? { backgroundColor: option.customColor } : undefined}
                                        ></span>
                                        <span
                                            className={`ml-2 rtl:mr-2 capitalize font-semibold ${option.textClass || 'text-gray-600'}`}
                                            style={option.customColor ? { color: option.customColor } : undefined}
                                        >
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                                style={{
                                    singleValue: (provided: any) => ({
                                        ...provided,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }),
                                    valueContainer: (provided: any) => ({
                                        ...provided,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }),
                                }}
                                onChange={(opt) => onChangeStatus(row, (opt as any).value)}
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.date'),
                accessorKey: 'date',
                cell: (props) => {
                    const row = props.row.original
                    return <span>{dayjs.unix(row.date).format('DD/MM/YYYY')}</span>
                },
            },
            {
                header: t('text.columns.customer'),
                accessorKey: 'customer',
            },
            {
                header: t('text.columns.total'),
                accessorKey: 'totalAmount',
                cell: (props) => {
                    const { totalAmount, orderCurrency } = props.row.original
                    return <span>{formatOrderMoney(totalAmount, orderCurrency)}</span>
                },
            },
        ]
    }, [navigate, statuses, t, textTheme, onChangeStatus])
}
