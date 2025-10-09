import { useMemo } from 'react'
import Select from '@/components/ui/Select'
import { NumericFormat } from 'react-number-format'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import useThemeClass from '@/utils/hooks/useThemeClass'
import type { ColumnDef } from '@/components/shared/DataTable'

export type Order = {
    id: string
    date: number
    customer: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
}

type Params = {
    t: (k: string) => string
    statuses: { id: number; name: string; color: string }[]
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
                    return (
                        <span
                            className={`cursor-pointer select-none font-semibold hover:${textTheme}`}
                            onClick={() => navigate(`/app/sales/order-details/${row.id}`)}
                        >
                            #{row.id}
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
                    const options = statuses.map((x) => ({ value: x.id, label: x.name, color: x.color }))
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{ value: s?.id ?? statusId, label: s?.name ?? String(statusId), color: s?.color ?? 'gray-500' } as any}
                                formatOptionLabel={(option: any) => (
                                    <div className="flex items-center">
                                        <span className={`badge-dot bg-${option.color}`}></span>
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold text-${option.color}`}>{option.label}</span>
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
                    const { totalAmount } = props.row.original
                    return (
                        <NumericFormat
                            displayType="text"
                            value={(Math.round(totalAmount * 100) / 100).toFixed(2)}
                            prefix={'$'}
                            thousandSeparator={true}
                        />
                    )
                },
            },
        ]
    }, [navigate, statuses, t, textTheme, onChangeStatus])
}
