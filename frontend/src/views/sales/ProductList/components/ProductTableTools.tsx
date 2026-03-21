import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import { HiDownload, HiPlusCircle, HiUpload, HiOutlineTrash } from 'react-icons/hi'
import ProductTableSearch from './ProductTableSearch'
import CurrencySelector from '@/components/shared/CurrencySelector'
import ProductFilter from './ProductFilter'
import { apiExportParametricMatrix, apiExportSalesProducts, apiImportParametricProducts, apiImportSalesProducts } from '@/services/SalesService'
import { getProducts, toggleBulkDeleteConfirmation, useAppDispatch, useAppSelector } from '../store'
import Select from '@/components/ui/Select'
import { clientConfig } from '@/configs/clientConfig'

type ParametricProductsImportSummary = {
    productsCreated: number
    productsUpdated: number
    matrixRows: number
    warnings?: string[]
}

type ProductTableToolsProps = {
    onAddProduct?: () => void
    isParametricView?: boolean
}

const ProductTableTools = ({ onAddProduct, isParametricView = false }: ProductTableToolsProps) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importContext, setImportContext] = useState<'products' | 'parametric'>('products')
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const supportsParametric = clientConfig.slug === 'urucortinas'
    const parametricEnabled = isParametricView && supportsParametric

    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )
    const productList = useAppSelector((state) => state.salesProductList.data.productList)
    const selectedProductIds = useAppSelector(
        (state) => state.salesProductList.data.selectedProductIds,
    )
    const hasSelection = selectedProductIds.length > 0

    const parametricOptions = useMemo(
        () =>
            parametricEnabled
                ? productList.map((product) => ({ value: product.id, label: product.name }))
                : [],
        [parametricEnabled, productList],
    )
    const [selectedParametricProduct, setSelectedParametricProduct] = useState<{ value: string; label: string } | null>(null)

    useEffect(() => {
        if (!parametricEnabled) {
            setSelectedParametricProduct(null)
            return
        }
        if (!parametricOptions.length) {
            setSelectedParametricProduct(null)
            return
        }
        if (!selectedParametricProduct) {
            setSelectedParametricProduct(parametricOptions[0])
            return
        }
        if (parametricOptions.every((option) => option.value !== selectedParametricProduct.value)) {
            setSelectedParametricProduct(parametricOptions[0])
        }
    }, [parametricEnabled, parametricOptions, selectedParametricProduct])

    const refreshProducts = useCallback(() => {
        if (!tableData) return
        dispatch(
            getProducts({
                pageIndex: tableData.pageIndex,
                pageSize: tableData.pageSize,
                sort: tableData.sort,
                query: tableData.query,
                filterData,
            }),
        )
    }, [dispatch, filterData, tableData])

    const composeExportPayload = useCallback(() => {
        const payload: Record<string, unknown> = {
            pageIndex: tableData?.pageIndex ?? 1,
            pageSize: tableData?.pageSize ?? 50,
        }
        const query = tableData?.query
        if (typeof query === 'string' && query.trim()) {
            payload.query = query.trim()
        }
        const sort = tableData?.sort
        if (sort) {
            payload.sort = { ...sort }
        }
        if (filterData) {
            payload.filterData = filterData
        }
        return payload
    }, [filterData, tableData])

    const onImportClick = useCallback(() => {
        if (importing) return
        if (parametricEnabled) {
            setImportContext('parametric')
            fileInputRef.current?.click()
            return
        }
        setImportContext('products')
        fileInputRef.current?.click()
    }, [importing, parametricEnabled])

    const onFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file) return
            setImporting(true)
            try {
                if (importContext === 'parametric') {
                    const formData = new FormData()
                    formData.append('file', file)
                    const response =
                        await apiImportParametricProducts<ParametricProductsImportSummary>(formData)
                    const summary = (response?.data ?? response) as ParametricProductsImportSummary
                    toast.push(
                        <Notification
                            title={t('sales.productForm.parametric.importSuccess', {
                                defaultValue: 'Matrix imported successfully',
                            })}
                            type="success"
                            duration={summary.warnings?.length ? 5000 : 3200}
                        >
                            <div>
                                <div>
                                    {t('sales.productForm.parametric.importProductsSummary', {
                                        defaultValue:
                                            'Products processed: {{created}} new · {{updated}} updated · {{rows}} matrix rows.',
                                        created: summary.productsCreated,
                                        updated: summary.productsUpdated,
                                        rows: summary.matrixRows,
                                    })}
                                </div>
                                {summary.warnings && summary.warnings.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <div className="font-semibold">
                                            {t('sales.productForm.parametric.importProductsWarnings', {
                                                defaultValue: 'Warnings ({{count}}):',
                                                count: summary.warnings.length,
                                            })}
                                        </div>
                                        {summary.warnings.slice(0, 3).map((warning, idx) => (
                                            <div key={`parametric-warning-${idx}`}>{warning}</div>
                                        ))}
                                        {summary.warnings.length > 3 && (
                                            <div className="opacity-80">
                                                {t('sales.productList.importErrorMore', {
                                                    defaultValue: 'Omitted {{count}} additional errors.',
                                                    count: summary.warnings.length - 3,
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Notification>,
                        { placement: 'top-center' },
                    )
                    refreshProducts()
                    event.target.value = ''
                } else {
                    const formData = new FormData()
                    formData.append('file', file)
                    const response = await apiImportSalesProducts<{
                        success?: boolean
                        imported?: number
                        created?: number
                        updated?: number
                        failed?: number
                        errors?: { row: number; message: string }[]
                    }>(formData)
                    const payload = (response?.data ?? {}) as {
                        success?: boolean
                        imported?: number
                        created?: number
                        updated?: number
                        failed?: number
                        errors?: { row: number; message: string }[]
                    }
                    const importedCount = Number(payload.imported ?? 0)
                    const createdCount = Number(payload.created ?? 0)
                    const updatedCount = Number(payload.updated ?? 0)
                    const failedCount = Number(payload.failed ?? 0)
                    const errors = Array.isArray(payload.errors) ? payload.errors : []
                    const hasErrors = errors.length > 0
                    const notificationType: 'success' | 'warning' = hasErrors ? 'warning' : 'success'
                    const summaryMessage = hasErrors
                        ? t('sales.productList.importSuccessWithErrors', {
                              defaultValue:
                                  'Products processed: {{imported}} (created: {{created}}, updated: {{updated}}). Rows with errors: {{failed}}.',
                              imported: importedCount,
                              created: createdCount,
                              updated: updatedCount,
                              failed: failedCount,
                          })
                        : t('sales.productList.importSuccess', {
                              defaultValue:
                                  'Products processed: {{imported}} (created: {{created}}, updated: {{updated}}).',
                              imported: importedCount,
                              created: createdCount,
                              updated: updatedCount,
                          })
                    toast.push(
                        <Notification
                            title={t('text.actions.import', {
                                defaultValue: 'Import',
                            })}
                            type={notificationType}
                            duration={hasErrors ? 6000 : 3000}
                        >
                            <div>
                                <div>{summaryMessage}</div>
                                {hasErrors &&
                                    errors.slice(0, 3).map((err, idx) => (
                                        <div key={`${err.row}-${idx}`} className="text-xs mt-1">
                                            {t('sales.productList.importErrorRow', {
                                                defaultValue: 'Row {{row}}: {{message}}',
                                                row: err?.row ?? '?',
                                                message: err?.message ?? '',
                                            })}
                                        </div>
                                    ))}
                                {hasErrors && errors.length > 3 && (
                                    <div className="text-xs mt-2 opacity-80">
                                        {t('sales.productList.importErrorMore', {
                                            defaultValue: 'Omitted {{count}} additional errors.',
                                            count: errors.length - 3,
                                        })}
                                    </div>
                                )}
                            </div>
                        </Notification>,
                        { placement: 'top-center' },
                    )
                    refreshProducts()
                }
            } catch (error) {
                console.error('products/import', error)
                const responseMessage =
                    (error as any)?.response?.data?.message ??
                    (error as any)?.message ??
                    ''
                const translatedMessage =
                    typeof responseMessage === 'string' && responseMessage
                        ? t(responseMessage, {
                              defaultValue: responseMessage,
                          })
                        : parametricEnabled
                        ? t('sales.productForm.parametric.importErrorDescription', {
                              defaultValue: 'Please verify the file format and try again.',
                          })
                        : t('sales.productList.importError', {
                              defaultValue: 'Unable to import the products.',
                          })
                toast.push(
                    <Notification
                        title={t('text.actions.import', {
                            defaultValue: 'Import',
                        })}
                        type="danger"
                        duration={3500}
                    >
                        {translatedMessage}
                    </Notification>,
                    { placement: 'top-center' },
                )
            } finally {
                setImporting(false)
                setImportContext('products')
                if (event.target) {
                    event.target.value = ''
                }
            }
        },
        [importContext, parametricEnabled, refreshProducts, t],
    )

    const onExport = useCallback(async () => {
        if (exporting) return
        if (parametricEnabled && !selectedParametricProduct?.value) {
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.importUnavailable', {
                        defaultValue: 'Seleccioná un producto paramétrico',
                    })}
                    type="warning"
                >
                    {t('sales.productForm.parametric.importSelectProduct', {
                        defaultValue: 'Elegí un producto antes de exportar la matriz.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        setExporting(true)
        try {
            if (parametricEnabled) {
                const targetId = Number(selectedParametricProduct?.value)
                if (!targetId) {
                    throw new Error('missing_target')
                }
                const response = await apiExportParametricMatrix(targetId)
                const data = response?.data ?? response
                const blob =
                    data instanceof Blob
                        ? data
                        : new Blob([data], {
                              type: 'text/csv;charset=utf-8',
                          })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', `parametric-matrix-${targetId}.csv`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.setTimeout(() => window.URL.revokeObjectURL(url), 500)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.export', { defaultValue: 'Export matrix' })}
                        type="success"
                        duration={2500}
                    >
                        {t('sales.productForm.parametric.exportSuccess', {
                            defaultValue: 'Se generó la matriz paramétrica.',
                        })}
                    </Notification>,
                    { placement: 'top-center' },
                )
            } else {
                const payload = composeExportPayload()
                const response = await apiExportSalesProducts<
                    Blob,
                    Record<string, unknown>
                >(payload)
                const blob =
                    response.data instanceof Blob
                        ? response.data
                        : new Blob([String(response.data ?? '')], {
                              type: 'text/csv;charset=utf-8;',
                          })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                const timestamp = dayjs().format('YYYYMMDD-HHmmss')
                link.href = url
                link.setAttribute('download', `products-${timestamp}.csv`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.setTimeout(() => window.URL.revokeObjectURL(url), 500)
                toast.push(
                    <Notification
                        title={t('text.actions.export')}
                        type="success"
                        duration={2500}
                    >
                        {t('sales.productList.exportSuccess', {
                            defaultValue: 'Product CSV generated successfully.',
                        })}
                    </Notification>,
                    { placement: 'top-center' },
                )
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('products/export', error)
            toast.push(
                <Notification
                    title={t('text.actions.export')}
                    type="danger"
                    duration={3000}
                >
                    {t('sales.productList.exportError', {
                        defaultValue: 'Unable to generate the CSV file.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setExporting(false)
        }
    }, [composeExportPayload, exporting, parametricEnabled, selectedParametricProduct, t])

    return (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onFileChange}
            />
            <ProductTableSearch />
            <ProductFilter />
            <CurrencySelector size="sm" />
            {parametricEnabled && (
                <>
                    <Select
                        className="min-w-[220px]"
                        options={parametricOptions}
                        placeholder={t('sales.productForm.parametric.selectProduct', {
                            defaultValue: 'Seleccioná un producto',
                        })}
                        value={selectedParametricProduct}
                        onChange={(value) => setSelectedParametricProduct(String(value ?? ''))}
                        isDisabled={!parametricOptions.length}
                    />
                    <Button
                        block
                        size="sm"
                        type="button"
                        variant="twoTone"
                        icon={<HiOutlineTrash />}
                        disabled={!hasSelection}
                        onClick={() => dispatch(toggleBulkDeleteConfirmation(true))}
                    >
                        {t('text.actions.deleteSelected', {
                            defaultValue: 'Delete selected',
                        })}
                    </Button>
                </>
            )}
            <Button
                block
                size="sm"
                icon={<HiUpload />}
                loading={importing}
                disabled={importing}
                className="md:mx-2 md:mb-0 mb-4"
                onClick={onImportClick}
            >
                {t('text.actions.import', { defaultValue: 'Import' })}
            </Button>
            <Button
                block
                size="sm"
                icon={<HiDownload />}
                loading={exporting}
                disabled={exporting}
                className="md:mx-2 md:mb-0 mb-4"
                onClick={onExport}
            >
                {t('text.actions.export')}
            </Button>
            <Button
                block
                size="sm"
                type="button"
                variant="solid"
                icon={<HiPlusCircle />}
                className="md:mx-2 md:mb-0 mb-4"
                onClick={() => onAddProduct?.()}
            >
                {t('text.actions.addProduct')}
            </Button>
        </div>
    )
}

export default ProductTableTools
