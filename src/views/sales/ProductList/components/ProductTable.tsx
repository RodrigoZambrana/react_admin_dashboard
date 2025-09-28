import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { apiGetProductStatuses } from '@/services/SettingsService'
import { apiPutSalesProduct } from '@/services/SalesService'
import { useState } from 'react'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import { FiPackage } from 'react-icons/fi'
import Switcher from '@/components/ui/Switcher'
import {
    getProducts,
    setTableData,
    setSelectedProduct,
    toggleDeleteConfirmation,
    useAppDispatch,
    useAppSelector,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import ProductDeleteConfirmation from './ProductDeleteConfirmation'
import { useNavigate } from 'react-router-dom'
import cloneDeep from 'lodash/cloneDeep'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
} from '@/components/shared/DataTable'

type Product = {
    id: string
    name: string
    productCode: string
    img: string
    category: string
    price: number
    stock: number
    status: number
    published?: boolean
}

const inventoryDefaultStatuses = [
    { id: 0, name: 'En stock', color: 'emerald-500' },
    { id: 1, name: 'Limitado', color: 'amber-500' },
    { id: 2, name: 'Sin stock', color: 'red-500' },
]

const ActionColumn = ({ row }: { row: Product }) => {
    const dispatch = useAppDispatch()
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()

    const onEdit = () => {
        navigate(`/app/sales/product-edit/${row.id}`)
    }

    const onDelete = () => {
        dispatch(toggleDeleteConfirmation(true))
        dispatch(setSelectedProduct(row.id))
    }

    return (
        <div className="flex justify-end text-lg">
            <span
                className={`cursor-pointer p-2 hover:${textTheme}`}
                onClick={onEdit}
            >
                <HiOutlinePencil />
            </span>
            <span
                className="cursor-pointer p-2 hover:text-red-500"
                onClick={onDelete}
            >
                <HiOutlineTrash />
            </span>
        </div>
    )
}

const ProductColumn = ({ row }: { row: Product }) => {
    const avatar = row.img ? (
        <Avatar src={row.img} />
    ) : (
        <Avatar icon={<FiPackage />} />
    )

    return (
        <div className="flex items-center">
            {avatar}
            <span className={`ml-2 rtl:mr-2 font-semibold`}>{row.name}</span>
        </div>
    )
}

const ProductTable = () => {
    const { t } = useTranslation()
    const tableRef = useRef<DataTableResetHandle>(null)
    const [productStatuses, setProductStatuses] = useState(
        inventoryDefaultStatuses,
    )

    const dispatch = useAppDispatch()

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )

    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

    const loading = useAppSelector(
        (state) => state.salesProductList.data.loading,
    )

    const data = useAppSelector(
        (state) => state.salesProductList.data.productList,
    )

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, pageSize, sort])

    useEffect(() => {
        if (tableRef) {
            tableRef.current?.resetSorting()
        }
    }, [filterData])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const fetchData = () => {
        dispatch(getProducts({ pageIndex, pageSize, sort, query, filterData }))
    }

    useEffect(() => {
        const fetchStatuses = async () => {
            const res = await apiGetProductStatuses<
                { id: number | string; name: string; color: string }[]
            >()
            const normalized = (res.data as any[]).map((s) => ({
                ...s,
                id: Number(s.id),
            }))
            if (normalized.length) setProductStatuses(normalized as any)
        }
        fetchStatuses()
    }, [])

    const currency = useAppSelector((state) => state.currency.code)

    const columns: ColumnDef<Product>[] = useMemo(
        () => [
            {
                header: t('text.columns.name'),
                accessorKey: 'name',
                cell: (props) => {
                    const row = props.row.original
                    return <ProductColumn row={row} />
                },
            },
            {
                header: t('text.columns.category'),
                accessorKey: 'category',
                cell: (props) => {
                    const row = props.row.original
                    return <span className="capitalize">{row.category}</span>
                },
            },
            {
                header: t('text.columns.quantity'),
                accessorKey: 'stock',
                sortable: true,
            },
            {
                header: t('text.columns.stock'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const statusId =
                        typeof (row as any).status === 'string'
                            ? parseInt((row as any).status as unknown as string, 10)
                            : (row as any).status
                    const s = productStatuses.find((x) => x.id === statusId)
                    const options = productStatuses.map((x) => ({
                        value: x.id,
                        label: x.name,
                        color: x.color,
                    }))
                    const onChange = async (opt: any) => {
                        await apiPutSalesProduct<boolean, { id: string; status: number }>(
                            { id: row.id, status: opt.value },
                        )
                        fetchData()
                    }
                    return (
                        <div className="min-w-[140px]">
                            <Select
                                size="sm"
                                options={options}
                                value={{
                                    value: s?.id ?? statusId,
                                    label: s?.name ?? String(statusId),
                                    color: s?.color ?? 'gray-500',
                                } as any}
                                formatOptionLabel={(option: any, { context }: { context: 'menu' | 'value' }) => (
                                    <div className="flex items-center">
                                        <span className={`badge-dot bg-${option.color}`}></span>
                                        <span className={`ml-2 rtl:mr-2 capitalize font-semibold ${context === 'value' ? `text-${option.color}` : ''}`}>
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
                                onChange={onChange}
                            />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.published'),
                accessorKey: 'published',
                cell: (props) => {
                    const row = props.row.original
                    const checked = typeof row.published === 'boolean' ? row.published : true
                    const onToggle = async (val: boolean) => {
                        await apiPutSalesProduct<boolean, { id: string; published: boolean }>({ id: row.id, published: val })
                        // refresh to reflect server state
                        fetchData()
                    }
                    return (
                        <div className="min-w-[120px]">
                            <Switcher defaultChecked={checked} onChange={(v) => onToggle(v)} />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.price'),
                accessorKey: 'price',
                cell: (props) => {
                    const { price } = props.row.original
                    return <span>{currency} {price}</span>
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => <ActionColumn row={props.row.original} />,
            },
        ],
        [t, currency],
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
                ref={tableRef}
                columns={columns}
                data={data}
                skeletonAvatarColumns={[0]}
                skeletonAvatarProps={{ className: 'rounded-md' }}
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
            <ProductDeleteConfirmation />
        </>
    )
}

export default ProductTable
