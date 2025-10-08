import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import { HiDownload, HiPlusCircle, HiUpload } from 'react-icons/hi'
import ProductTableSearch from './ProductTableSearch'
import CurrencySelector from '@/components/shared/CurrencySelector'
import ProductFilter from './ProductFilter'
import { apiExportSalesProducts, apiImportSalesProducts } from '@/services/SalesService'
import { getProducts, useAppDispatch, useAppSelector } from '../store'

type ProductTableToolsProps = {
    onAddProduct?: () => void
}

const ProductTableTools = ({ onAddProduct }: ProductTableToolsProps) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

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
        fileInputRef.current?.click()
    }, [importing])

    const onFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file) return
            setImporting(true)
            try {
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
            } catch (error) {
                // eslint-disable-next-line no-console
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
                if (event.target) {
                    event.target.value = ''
                }
            }
        },
        [refreshProducts, t],
    )

    const onExport = useCallback(async () => {
        if (exporting) return
        setExporting(true)
        try {
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
    }, [composeExportPayload, exporting, t])

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
