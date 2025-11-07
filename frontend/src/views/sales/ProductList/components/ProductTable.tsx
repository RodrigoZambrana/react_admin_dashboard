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
    setSelectedProducts,
    useAppDispatch,
    useAppSelector,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import ProductDeleteConfirmation from './ProductDeleteConfirmation'
import ProductBulkDeleteConfirmation from './ProductBulkDeleteConfirmation'
import { useNavigate } from 'react-router-dom'
import cloneDeep from 'lodash/cloneDeep'
import { deriveInventoryStatus } from '@/utils/inventory'
import { resolveTextDirection } from '@/utils/textDirection'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
    Row,
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
    serieSummary?: string
    widthSummary?: string
    heightSummary?: string
    colorSummary?: string
    glassSummary?: string
    mosquiteroAvailable?: boolean
    parametricSku?: string
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
    const selectedProductIds = useAppSelector(
        (state) => state.salesProductList.data.selectedProductIds,
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

    const isParametric = useMemo(() => {
        const mode = filterData?.mode
        if (Array.isArray(mode)) {
            return mode.length === 1 && mode[0] === 'parametric'
        }
        return mode === 'parametric'
    }, [filterData?.mode])

    useEffect(() => {
        if (!isParametric && selectedProductIds.length) {
            dispatch(setSelectedProducts([]))
            tableRef.current?.resetSelected()
        }
    }, [dispatch, isParametric, selectedProductIds.length])

    useEffect(() => {
        if (!selectedProductIds.length) {
            tableRef.current?.resetSelected()
        }
    }, [selectedProductIds.length])

    const handleRowSelect = useCallback(
        (checked: boolean, row: Product) => {
            const id = String(row.id)
            const current = new Set(selectedProductIds)
            if (checked) {
                current.add(id)
            } else {
                current.delete(id)
            }
            dispatch(setSelectedProducts(Array.from(current)))
        },
        [dispatch, selectedProductIds],
    )

    const handleBulkSelect = useCallback(
        (checked: boolean, rows: Row<Product>[]) => {
            const ids = rows.map((row) => String((row.original as Product).id))
            if (!ids.length) {
                return
            }
            const current = new Set(selectedProductIds)
            ids.forEach((id) => {
                if (checked) {
                    current.add(id)
                } else {
                    current.delete(id)
                }
            })
            dispatch(setSelectedProducts(Array.from(current)))
        },
        [dispatch, selectedProductIds],
    )

    const columns: ColumnDef<Product>[] = useMemo(() => {
        const cols: ColumnDef<Product>[] = [
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
                    const skuValue = props.row.original.productCode
                    return <span className="font-mono text-xs">{skuValue || '-'}</span>
                },
            },
            {
                header: isParametric
                    ? t('sales.productList.columns.serie', { defaultValue: 'Serie' })
                    : t('text.columns.category'),
                accessorKey: 'category',
                cell: (props) => {
                    const row = props.row.original
                    const value = isParametric
                        ? (row.serieSummary && row.serieSummary.trim()) || '—'
                        : row.category || '—'
                    return (
                        <span className={isParametric ? '' : 'capitalize'}>
                            {value}
                        </span>
                    )
                },
            },
        ]

        if (!isParametric) {
            cols.push({
                header: t('text.labels.unitOfMeasure'),
                accessorKey: 'unitOfMeasure',
                enableSorting: false,
                cell: (props) => {
                    const unit = props.row.original.unitOfMeasure ?? DEFAULT_SALES_UNIT
                    return <span>{getSalesUnitLabel(unit, t)}</span>
                },
            })
        }

        if (!isParametric) {
            cols.push(
                {
                    header: t('text.labels.brand'),
                    accessorKey: 'brand',
                    cell: (props) => {
                        const brand = (props.row.original as any).brand
                        return <span>{brand || '—'}</span>
                    },
                },
                {
                    header: t('text.labels.vendor'),
                    accessorKey: 'vendor',
                    cell: (props) => {
                        const vendor = (props.row.original as any).vendor
                        return <span>{vendor || '—'}</span>
                    },
                },
            )
        }

        cols.push(
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
        )

        if (isParametric) {
            cols.push(
                {
                    header: t('sales.productList.columns.width', {
                        defaultValue: 'Ancho (mm)',
                    }),
                    accessorKey: 'widthSummary',
                    cell: (props) => {
                        const value = props.row.original.widthSummary?.trim()
                        return <span>{value || '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.height', {
                        defaultValue: 'Alto (mm)',
                    }),
                    accessorKey: 'heightSummary',
                    cell: (props) => {
                        const value = props.row.original.heightSummary?.trim()
                        return <span>{value || '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.glass', { defaultValue: 'Vidrio' }),
                    accessorKey: 'glassSummary',
                    cell: (props) => {
                        const value = props.row.original.glassSummary
                        return <span>{value && value.trim() ? value : '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.color', { defaultValue: 'Color' }),
                    accessorKey: 'colorSummary',
                    cell: (props) => {
                        const value = props.row.original.colorSummary
                        return <span>{value && value.trim() ? value : '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.mosquitero', { defaultValue: 'Mosquitero' }),
                    accessorKey: 'mosquiteroAvailable',
                    cell: (props) => {
                        const available = Boolean(props.row.original.mosquiteroAvailable)
                        return <span>{available ? t('common.yes', { defaultValue: 'Sí' }) : t('common.no', { defaultValue: 'No' })}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.monoblock', { defaultValue: 'Monoblock' }),
                    accessorKey: 'monoblockAvailable',
                    cell: (props) => {
                        const row = props.row.original
                        const available = Boolean(row.monoblockAvailable)
                        if (!available) {
                            return <span>{t('common.no', { defaultValue: 'No' })}</span>
                        }
                        const details = row.shutterMaterialSummary?.trim()
                        return (
                            <span>
                                {t('common.yes', { defaultValue: 'Sí' })}
                                {details ? ` (${details})` : ''}
                            </span>
                        )
                    },
                },
            )
        } else {
            cols.push(
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
            )
        }

        cols.push(
            {
                header: t('text.columns.published'),
                accessorKey: 'published',
                cell: (props) => {
                    const row = props.row.original
                    const checked = typeof row.published === 'boolean' ? row.published : false
                    const onToggle = async (val: boolean) => {
                        updateProductRow(row.id, { published: val })
                        await apiPutSalesProduct<boolean, { id: number; published: boolean }>({ id: Number(row.id), published: val })
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
        )

        return cols
    }, [fetchData, formatCurrencyValue, isParametric, resolveStockStatus, t, updateProductRow])

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
                selectable={isParametric}
                onCheckBoxChange={isParametric ? handleRowSelect : undefined}
                onIndeterminateCheckBoxChange={
                    isParametric ? handleBulkSelect : undefined
                }
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
            <ProductBulkDeleteConfirmation />
        </>
    )
}

export default ProductTable
