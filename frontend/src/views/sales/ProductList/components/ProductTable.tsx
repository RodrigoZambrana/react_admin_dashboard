import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import { apiPutSalesProduct } from '@/services/SalesService'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import { FiPackage } from 'react-icons/fi'
import Switcher from '@/components/ui/Switcher'
import {
    getProducts,
    setTableData,
    setSelectedProduct,
    toggleDeleteConfirmation,
    updateProductList,
    useAppDispatch,
    useAppSelector,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import ProductDeleteConfirmation from './ProductDeleteConfirmation'
import { useNavigate } from 'react-router-dom'
import cloneDeep from 'lodash/cloneDeep'
import { deriveInventoryStatus } from '@/utils/inventory'
import { resolveTextDirection } from '@/utils/textDirection'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
} from '@/components/shared/DataTable'
import {
    DEFAULT_SALES_UNIT,
    getSalesUnitLabel,
    type SalesUnit,
} from '@/constants/product.constant'

type Product = {
    id: string
    name: string
    productCode: string
    img: string
    category: string
    salePrice: number
    costPrice: number
    stock: number
    status: number
    published?: boolean
    brand?: string
    vendor?: string
    permanentStock?: boolean
    currency?: string
    unitOfMeasure?: SalesUnit
    specifications?: string
}

const ActionColumn = ({ row }: { row: Product }) => {
    const dispatch = useAppDispatch()
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()

    const onEdit = () => {
        navigate(`/app/products/edit/${row.id}`)
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
    const { t, i18n } = useTranslation()
    const tableRef = useRef<DataTableResetHandle>(null)

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

    const updateProductRow = useCallback(
        (id: string, updates: Partial<Product>) => {
            const nextState = data.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
            )
            dispatch(updateProductList(nextState))
        },
        [data, dispatch],
    )

    const fetchData = useCallback(() => {
        dispatch(getProducts({ pageIndex, pageSize, sort, query, filterData }))
    }, [dispatch, pageIndex, pageSize, sort, query, filterData])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (tableRef) {
            tableRef.current?.resetSorting()
        }
    }, [filterData])

    const tableData = useMemo(
        () => ({ pageIndex, pageSize, sort, query, total }),
        [pageIndex, pageSize, sort, query, total],
    )

    const defaultCurrency = useAppSelector((state) => state.currency.code)
    const fallbackCurrency = useMemo(
        () => normalizeCurrencyCode(defaultCurrency, 'UYU') || 'UYU',
        [defaultCurrency],
    )

    const formatCurrencyValue = useCallback(
        (amount: number, currency?: string) =>
            formatCurrency(amount, currency, i18n.language, {
                fallbackCurrency,
            }),
        [fallbackCurrency, i18n.language],
    )

    const resolveStockStatus = useMemo(() => {
        const styles = {
            0: {
                labelKey: 'text.status.inStock',
                dotClass: 'bg-emerald-500',
                textClass: 'text-emerald-500',
            },
            1: {
                labelKey: 'text.status.limited',
                dotClass: 'bg-amber-500',
                textClass: 'text-amber-500',
            },
            2: {
                labelKey: 'text.status.outOfStock',
                dotClass: 'bg-red-500',
                textClass: 'text-red-500',
            },
        } as const

        return (stockValue: number, permanent: boolean) => {
            const normalized = Number.isNaN(stockValue) ? 0 : stockValue
            const status = deriveInventoryStatus(normalized, permanent)
            return styles[status]
        }
    }, [])

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
                header: t('text.labels.codeSku') || 'Code (SKU)',
                accessorKey: 'productCode',
                cell: (props) => {
                    const { productCode } = props.row.original
                    return <span className="font-mono text-xs">{productCode || '-'}</span>
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
                header: t('text.labels.unitOfMeasure'),
                accessorKey: 'unitOfMeasure',
                enableSorting: false,
                cell: (props) => {
                    const unit = props.row.original.unitOfMeasure ?? DEFAULT_SALES_UNIT
                    return (
                        <span>
                            {getSalesUnitLabel(unit, t)}
                        </span>
                    )
                },
            },
            {
                header: t('text.labels.brand'),
                accessorKey: 'brand',
                cell: (props) => {
                    const brand = (props.row.original as any).brand
                    return <span>{brand || '-'}</span>
                },
            },
            {
                header: t('text.labels.vendor'),
                accessorKey: 'vendor',
                cell: (props) => {
                    const vendor = (props.row.original as any).vendor
                    return <span>{vendor || '-'}</span>
                },
            },
            {
                header: t('text.columns.specifications', {
                    defaultValue: 'Especificaciones',
                }),
                accessorKey: 'specifications',
                enableSorting: false,
                cell: (props) => {
                    const raw = props.row.original.specifications
                    const text =
                        typeof raw === 'string' && raw.trim().length > 0
                            ? raw.trim()
                            : '—'
                    return (
                        <span
                            className="whitespace-pre-wrap text-sm"
                            dir={resolveTextDirection(text)}
                        >
                            {text}
                        </span>
                    )
                },
            },
            {
                header: t('text.columns.stock'),
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    const stockValue = Number(row.stock ?? 0)
                    const permanent = Boolean((row as any).permanentStock)
                    const status = resolveStockStatus(
                        Number.isNaN(stockValue) ? 0 : stockValue,
                        permanent,
                    )
                    return (
                        <div className="flex items-center gap-2">
                            <span className={`badge-dot ${status.dotClass}`} />
                            <span
                                className={`capitalize font-semibold ${status.textClass}`}
                            >
                                {t(status.labelKey)}
                            </span>
                        </div>
                    )
                },
            },
            {
                header: t('text.labels.permanentStock'),
                accessorKey: 'permanentStock',
                cell: (props) => {
                    const row = props.row.original
                    const checked = Boolean((row as any).permanentStock)
                    const onToggle = async (val: boolean) => {
                        updateProductRow(row.id, { permanentStock: val })
                        await apiPutSalesProduct<
                            boolean,
                            { id: number; permanentStock: boolean }
                        >({ id: Number(row.id), permanentStock: val })
                        fetchData()
                    }
                    return (
                        <div className="min-w-[120px]">
                            <Switcher
                                checked={checked}
                                onChange={(v) => onToggle(v)}
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
                    const checked = typeof row.published === 'boolean' ? row.published : false
                    const onToggle = async (val: boolean) => {
                        updateProductRow(row.id, { published: val })
                        await apiPutSalesProduct<boolean, { id: number; published: boolean }>({ id: Number(row.id), published: val })
                        // refresh to reflect server state
                        fetchData()
                    }
                    return (
                        <div className="min-w-[120px]">
                            <Switcher checked={checked} onChange={(v) => onToggle(v)} />
                        </div>
                    )
                },
            },
            {
                header: t('text.columns.costPrice'),
                accessorKey: 'costPrice',
                cell: (props) => {
                    const { costPrice, currency: rowCurrency } = props.row.original
                    return <span>{formatCurrencyValue(costPrice, rowCurrency)}</span>
                },
            },
            {
                header: t('text.columns.salePrice'),
                accessorKey: 'salePrice',
                cell: (props) => {
                    const { salePrice, currency: rowCurrency } = props.row.original
                    return <span>{formatCurrencyValue(salePrice, rowCurrency)}</span>
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => <ActionColumn row={props.row.original} />,
            },
        ],
        [t, resolveStockStatus, updateProductRow, formatCurrencyValue, fetchData],
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
