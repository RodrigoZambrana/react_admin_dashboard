import { useEffect, useCallback, useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Select from '@/components/ui/Select'
import Tooltip from '@/components/ui/Tooltip'
import DataTable from '@/components/shared/DataTable'
import {
    getCustomers,
    setTableData,
    setSelectedCustomer,
    setDrawerOpen,
    setCustomerList,
    putCustomer,
    useAppDispatch,
    useAppSelector,
    Customer,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import CustomerEditDialog from './CustomerEditDialog'
import { Link, useNavigate } from 'react-router-dom'
import { HiOutlineUser, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import cloneDeep from 'lodash/cloneDeep'
import type { OnSortParam, ColumnDef } from '@/components/shared/DataTable'
import { useTranslation } from 'react-i18next'
import { apiGetCustomerStatuses } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { apiDeleteCrmCustomer } from '@/services/CrmService'
type StatusOption = {
    value: number | string
    label: string
    color?: string
}

const ActionColumn = ({
    row,
    onRequestDelete,
}: {
    row: Customer
    onRequestDelete: (customer: Customer) => void
}) => {
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
        <div className="flex justify-end items-center gap-1">
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
            <Tooltip title={t('text.actions.delete')}>
                <span
                    className="cursor-pointer p-2 hover:text-red-500"
                    onClick={() => onRequestDelete(row)}
                >
                    <HiOutlineTrash className="text-lg" />
                </span>
            </Tooltip>
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
    const [customerStatuses, setCustomerStatuses] = useState<StatusOption[]>([])
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
        null,
    )
    const [deleteLoading, setDeleteLoading] = useState(false)
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
            try {
                const res = await apiGetCustomerStatuses<
                    { id: string | number; name: string; color?: string }[]
                >()
                const normalized: StatusOption[] = ((res.data as any[]) || []).map(
                    (item) => {
                        const parsed = Number(item.id)
                        const value = Number.isNaN(parsed)
                            ? String(item.id)
                            : parsed
                        return {
                            value,
                            label: item.name,
                            color: item.color,
                        }
                    },
                )
                setCustomerStatuses(normalized)
            } catch (
                // ignore errors, component will fallback to empty list
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                _error
            ) {
                setCustomerStatuses([])
            }
        }
        fetchStatuses()
    }, [])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const handleRequestDelete = useCallback((customer: Customer) => {
        setCustomerToDelete(customer)
    }, [])

    const handleDelete = useCallback(async () => {
        if (!customerToDelete) return
        setDeleteLoading(true)
        try {
            await apiDeleteCrmCustomer<boolean, { id: number | string }>({
                id: customerToDelete.id,
            })
            toast.push(
                <Notification
                    type="success"
                    title={t('text.titles.customerDeleted')}
                >
                    {t('text.messages.customerDeleted')}
                </Notification>,
            )
            fetchData()
        } catch (error) {
            const responseMessage =
                (typeof error === 'object' &&
                    error !== null &&
                    // @ts-expect-error axios style
                    (error.response?.data?.message || error.message)) ||
                t('text.messages.customerDeleteHasOrders')
            const translatedMessage = t(responseMessage, {
                defaultValue: responseMessage,
            })
            toast.push(
                <Notification
                    type="danger"
                    title={t('text.titles.deleteCustomerFailed')}
                >
                    {translatedMessage}
                </Notification>,
            )
        } finally {
            setDeleteLoading(false)
            setCustomerToDelete(null)
        }
    }, [customerToDelete, fetchData, t])

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
                header: t('text.columns.phone'),
                accessorKey: 'phoneNumber',
                cell: (props) => {
                    const row = props.row.original
                    const primaryPhone =
                        (Array.isArray(row.phoneNumbers) && row.phoneNumbers.length
                            ? row.phoneNumbers[0]
                            : row.phoneNumber) || ''
                    return primaryPhone || '-'
                },
            },
            {
                header: t('text.columns.status'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const rawStatusValue =
                        (row as any).statusId ?? (row as any).status ?? null

                    const fallbackLabel =
                        (row as any).statusName ??
                        (row as any).status ??
                        t('text.status.unknown', { defaultValue: 'Sin estado' })

                    const statusOption =
                        customerStatuses.find(
                            (option) =>
                                String(option.value) ===
                                String(rawStatusValue ?? ''),
                        ) ||
                        (rawStatusValue !== null && rawStatusValue !== undefined
                            ? { value: rawStatusValue, label: fallbackLabel }
                            : null)

                    const onChangeStatus = async (option: StatusOption) => {
                        if (!option) return

                        const previousList = data.map((customer) => ({
                            ...customer,
                        }))

                        const updatedCustomer: Customer = {
                            ...row,
                            statusId: option.value,
                            status: option.label,
                            statusName: option.label,
                        }

                        const updatedList = data.map((customer) =>
                            customer.id === row.id ? updatedCustomer : customer,
                        )
                        dispatch(setCustomerList(updatedList))

                        try {
                            await dispatch(putCustomer(updatedCustomer)).unwrap()
                            fetchData()
                        } catch (
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            _error
                        ) {
                            dispatch(setCustomerList(previousList))
                            const errorMessage =
                                (typeof _error === 'object' && _error !== null &&
                                    // @ts-expect-error axios style
                                    (_error.response?.data?.message || _error.message)) ||
                                t('text.messages.updateFailed', {
                                    defaultValue: 'No se pudo actualizar el estado del cliente.',
                                })

                            toast.push(
                                <Notification
                                    type="danger"
                                    title={t('text.titles.updateFailed', {
                                        defaultValue: 'Error al actualizar',
                                    })}
                                >
                                    {errorMessage}
                                </Notification>,
                            )
                        }
                    }

                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={customerStatuses as any}
                                value={(statusOption || null) as any}
                                formatOptionLabel={(opt) => (
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-block h-2.5 w-2.5 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    (opt as StatusOption).color || '#6b7280',
                                            }}
                                        />
                                        <span className="capitalize">
                                            {(opt as StatusOption).label}
                                        </span>
                                    </div>
                                )}
                                onChange={(opt) =>
                                    opt && onChangeStatus(opt as StatusOption)
                                }
                            />
                        </div>
                    )
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => (
                    <ActionColumn
                        row={props.row.original}
                        onRequestDelete={handleRequestDelete}
                    />
                ),
            },
        ],
        [customerStatuses, fetchData, handleRequestDelete, t],
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
            <ConfirmDialog
                isOpen={Boolean(customerToDelete)}
                type="danger"
                title={t('text.titles.deleteCustomer')}
                confirmButtonColor="red-600"
                confirmButtonProps={{ loading: deleteLoading }}
                onClose={() => {
                    if (!deleteLoading) setCustomerToDelete(null)
                }}
                onRequestClose={() => {
                    if (!deleteLoading) setCustomerToDelete(null)
                }}
                onCancel={() => {
                    if (!deleteLoading) setCustomerToDelete(null)
                }}
                onConfirm={handleDelete}
            >
                <p>{t('text.messages.deleteCustomerConfirm')}</p>
            </ConfirmDialog>
        </>
    )
}

export default Customers
