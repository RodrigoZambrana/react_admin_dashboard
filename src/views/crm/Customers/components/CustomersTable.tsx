import { useEffect, useCallback, useMemo } from 'react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import {
    getCustomers,
    setTableData,
    setSelectedCustomer,
    setDrawerOpen,
    useAppDispatch,
    useAppSelector,
    Customer,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import CustomerEditDialog from './CustomerEditDialog'
import { Link, useNavigate } from 'react-router-dom'
import { HiOutlineUser, HiOutlineEye } from 'react-icons/hi'
import dayjs from 'dayjs'
import cloneDeep from 'lodash/cloneDeep'
import type { OnSortParam, ColumnDef } from '@/components/shared/DataTable'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { apiGetCustomerStatuses } from '@/services/SettingsService'
import ApiService from '@/services/ApiService'

const defaultCustomerStatuses = [
    { id: 'active', name: 'Activo', color: 'emerald-500' },
    { id: 'blocked', name: 'Bloqueado', color: 'red-500' },
    { id: 'pending', name: 'Pendiente', color: 'amber-500' },
]

const ActionColumn = ({ row }: { row: Customer }) => {
    const { textTheme } = useThemeClass()
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const onEdit = () => {
        dispatch(setDrawerOpen())
        dispatch(setSelectedCustomer(row))
    }

    const onView = useCallback(() => {
        navigate(`/app/crm/customer-details?id=${row.id}`)
    }, [navigate, row])

    return (
        <div className="flex justify-end items-center">
            <Tooltip title={t('text.actions.view')}>
                <span
                    className={`cursor-pointer p-2 hover:${textTheme}`}
                    onClick={onView}
                >
                    <HiOutlineEye className="text-lg" />
                </span>
            </Tooltip>
            <div
                className={`${textTheme} cursor-pointer select-none font-semibold`}
                onClick={onEdit}
            >
                {t('text.actions.edit')}
            </div>
        </div>
    )
}

const NameColumn = ({ row }: { row: Customer }) => {
    const { textTheme } = useThemeClass()

    return (
        <div className="flex items-center">
            <Avatar size={28} shape="circle" src={row.img || undefined} icon={<HiOutlineUser />} />
            <Link
                className={`hover:${textTheme} ml-2 rtl:mr-2 font-semibold`}
                to={`/app/crm/customer-details?id=${row.id}`}
            >
                {row.name}
            </Link>
        </div>
    )
}

const Customers = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const data = useAppSelector((state) => state.crmCustomers.data.customerList)
    const loading = useAppSelector((state) => state.crmCustomers.data.loading)
    const [customerStatuses, setCustomerStatuses] = useState(defaultCustomerStatuses)
    const filterData = useAppSelector(
        (state) => state.crmCustomers.data.filterData,
    )

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.crmCustomers.data.tableData,
    )

    const fetchData = useCallback(() => {
        dispatch(getCustomers({ pageIndex, pageSize, sort, query, filterData }))
    }, [pageIndex, pageSize, sort, query, filterData, dispatch])

    useEffect(() => {
        fetchData()
    }, [fetchData, pageIndex, pageSize, sort, filterData])

    useEffect(() => {
        const fetchStatuses = async () => {
            const res = await apiGetCustomerStatuses<
                { id: string; name: string; color: string }[]
            >()
            if ((res.data as any[]).length) setCustomerStatuses(res.data as any)
        }
        fetchStatuses()
    }, [])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const columns: ColumnDef<Customer>[] = useMemo(
        () => [
            {
                header: t('text.columns.name'),
                accessorKey: 'name',
                cell: (props) => {
                    const row = props.row.original
                    return <NameColumn row={row} />
                },
            },
            {
                header: t('text.columns.email'),
                accessorKey: 'email',
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const s = customerStatuses.find((x) => x.id === row.status)
                    const options = customerStatuses.map((x) => ({ value: x.id, label: x.name, color: x.color }))
                    const onChange = async (opt: any) => {
                        await ApiService.fetchData({ url: '/crm/customers', method: 'put', data: { id: row.id, status: opt.value } })
                        fetchData()
                    }
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{ value: s?.id ?? row.status, label: s?.name ?? String(row.status), color: s?.color ?? 'gray-500' } as any}
                                formatOptionLabel={(option: any, { context }: { context: 'menu' | 'value' }) => (
                                    <div className="flex items-center">
                                        <span className={`badge-dot bg-${option.color}`}></span>
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold ${context === 'value' ? `text-${option.color}` : ''}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                                style={{
                                    singleValue: (provided: any) => ({ ...provided, display: 'flex', alignItems: 'center' }),
                                    valueContainer: (provided: any) => ({ ...provided, display: 'flex', alignItems: 'center' }),
                                }}
                                onChange={onChange}
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.lastOnline'),
                accessorKey: 'lastOnline',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex items-center">
                            {dayjs.unix(row.lastOnline).format('MM/DD/YYYY')}
                        </div>
                    )
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => <ActionColumn row={props.row.original} />,
            },
        ],
        [t],
    )

    const onPaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        dispatch(setTableData(newTableData))
    }

    const onSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        dispatch(setTableData(newTableData))
    }

    const onSort = (sort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = sort
        dispatch(setTableData(newTableData))
    }

    return (
        <>
            <DataTable
                columns={columns}
                data={data}
                skeletonAvatarColumns={[0]}
                skeletonAvatarProps={{ width: 28, height: 28 }}
                loading={loading}
                pagingData={{
                    total: tableData.total as number,
                    pageIndex: tableData.pageIndex as number,
                    pageSize: tableData.pageSize as number,
                }}
                onPaginationChange={onPaginationChange}
                onSelectChange={onSelectChange}
                onSort={onSort}
            />
            <CustomerEditDialog />
        </>
    )
}

export default Customers
