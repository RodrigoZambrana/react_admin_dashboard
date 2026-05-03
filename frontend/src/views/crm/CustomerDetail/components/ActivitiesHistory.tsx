import { useState } from 'react'
import { appPath } from '@/constants/route.constant'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    createColumnHelper,
} from '@tanstack/react-table'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import type { CustomerActivity } from '../store'

const { Tr, Th, Td, THead, TBody, Sorter } = Table

const columnHelper = createColumnHelper<CustomerActivity>()

const columns = (t: (k: string) => string, customerId?: string | number | null) => [
    columnHelper.accessor('title', {
        header: t('text.columns.activity', { defaultValue: 'Actividad' }),
        cell: (props) => {
            const row = props.row.original
            const linkTarget = `${appPath('calendar/activities/details')}?id=${row.id}${
                customerId ? `&customerId=${customerId}` : ''
            }`
            return (
                <Link
                    to={linkTarget}
                    className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
                >
                    {row.title || t('calendar.labels.untitled', { defaultValue: 'Actividad sin título' })}
                </Link>
            )
        },
    }),
    columnHelper.accessor('type', {
        header: t('text.columns.type', { defaultValue: 'Tipo' }),
        cell: (props) => {
            const row = props.row.original
            if (!row.type && !row.color) {
                return <span className="text-sm text-gray-500">{t('calendar.eventTypes.other', { defaultValue: 'Otro' })}</span>
            }
            return (
                <div className="flex items-center gap-2">
                    {row.color ? <Badge className="!w-2.5 !h-2.5" style={{ backgroundColor: row.color }} /> : <Badge className="!w-2.5 !h-2.5 bg-gray-400" />}
                    <span className="capitalize">{row.type}</span>
                </div>
            )
        },
    }),
    columnHelper.accessor('startDate', {
        header: t('text.columns.date'),
        cell: (props) => {
            const row = props.row.original
            return <span>{dayjs.unix(row.startDate).format('DD/MM/YYYY')}</span>
        },
    }),
    columnHelper.display({
        id: 'actions',
        header: t('text.columns.actions'),
        cell: (props) => {
            const row = props.row.original
            const linkTarget = `${appPath('calendar/activities/details')}?id=${row.id}${
                customerId ? `&customerId=${customerId}` : ''
            }`
            return (
                <div className="flex justify-end">
                    <Link to={linkTarget}>
                        <Button size="xs" variant="twoTone">
                            {t('text.actions.view')}
                        </Button>
                    </Link>
                </div>
            )
        },
    }),
]

const ActivitiesHistory = () => {
    const crmDetails = useSelector((state: any) => state.crmCustomerDetails?.data)
    const data: CustomerActivity[] = crmDetails?.activitiesData ?? []

    const [sorting, setSorting] = useState<
        {
            id: string
            desc: boolean
        }[]
    >([])

    const { t } = useTranslation()
    const customerId = crmDetails?.profileData?.id ?? null

    const table = useReactTable({
        data,
        columns: columns(t, customerId),
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <div className="mb-0">
            <h6 className="mb-4">
                {t('text.titles.activityHistory', { defaultValue: 'Histórico de actividades' })}
            </h6>
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <Th key={header.id} colSpan={header.colSpan}>
                                    {header.isPlaceholder ? null : (
                                        <div
                                            className={
                                                header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                                            }
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                            <Sorter sort={header.column.getIsSorted()} />
                                        </div>
                                    )}
                                </Th>
                            ))}
                        </Tr>
                    ))}
                </THead>
                <TBody>
                    {table
                        .getRowModel()
                        .rows.slice(0, 10)
                        .map((row) => (
                            <Tr key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <Td key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </Td>
                                ))}
                            </Tr>
                        ))}
                </TBody>
            </Table>
        </div>
    )
}

export default ActivitiesHistory
