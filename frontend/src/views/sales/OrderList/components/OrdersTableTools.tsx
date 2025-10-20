import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { HiDownload, HiOutlineTrash, HiPlusCircle, HiUpload } from 'react-icons/hi'
import OrderTableSearch from './OrderTableSearch'
import { getOrders, setDeleteMode, useAppDispatch, useAppSelector } from '../store'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { apiExportSalesOrders, apiImportSalesOrders } from '@/services/SalesService'

const BatchDeleteButton = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const onBatchDelete = () => {
        dispatch(setDeleteMode('batch'))
    }

    return (
        <Button
            variant="solid"
            color="red-600"
            size="sm"
            icon={<HiOutlineTrash />}
            onClick={onBatchDelete}
        >
            {t('text.actions.batchDelete')}
        </Button>
    )
}

const OrdersTableTools = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const selectedRows = useAppSelector(
        (state) => state.salesOrderList.data.selectedRows,
    )
    const tableData = useAppSelector(
        (state) => state.salesOrderList.data.tableData,
    )
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const refreshOrders = useCallback(() => {
        if (!tableData) return
        const { pageIndex, pageSize, sort, query } = tableData
        dispatch(
            getOrders({
                pageIndex,
                pageSize,
                sort,
                query,
            }),
        )
    }, [dispatch, tableData])

    const composeExportParams = useCallback(() => {
        const params: Record<string, unknown> = {}
        const query = tableData?.query
        if (typeof query === 'string' && query.trim()) {
            params.query = query.trim()
        }
        const sort = tableData?.sort
        if (sort) {
            params.sort = { ...sort }
            if (sort.key !== undefined && sort.key !== '') {
                params.sortKey = sort.key
            }
            if (sort.order === 'asc' || sort.order === 'desc') {
                params.sortOrder = sort.order
            }
        }
        return params
    }, [tableData])

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
                const response = await apiImportSalesOrders<{
                    success?: boolean
                    imported?: number
                    failed?: number
                    errors?: { row: number; message: string }[]
                }>(formData)
                const payload = (response?.data ?? {}) as {
                    success?: boolean
                    imported?: number
                    failed?: number
                    errors?: { row: number; message: string }[]
                }
                const importedCount = Number(payload.imported ?? 0)
                const failedCount = Number(payload.failed ?? 0)
                const errors = Array.isArray(payload.errors) ? payload.errors : []
                const hasErrors = errors.length > 0
                const notificationType: 'success' | 'warning' = hasErrors
                    ? 'warning'
                    : 'success'
                const summaryMessage = hasErrors
                    ? t('sales.orders.importSuccessWithErrors', {
                          defaultValue:
                              'Pedidos importados: {{imported}}. Registros con error: {{failed}}.',
                          imported: importedCount,
                          failed: failedCount,
                      })
                    : t('sales.orders.importSuccess', {
                          defaultValue: 'Se importaron {{imported}} pedidos.',
                          imported: importedCount,
                      })
                toast.push(
                    <Notification
                        title={t('text.actions.import', {
                            defaultValue: 'Importar',
                        })}
                        type={notificationType}
                        duration={hasErrors ? 6000 : 3000}
                    >
                        <div>
                            <div>{summaryMessage}</div>
                            {hasErrors &&
                                errors.slice(0, 3).map((err, idx) => (
                                    <div key={`${err.row}-${idx}`} className="text-xs mt-1">
                                        {t('sales.orders.importErrorRow', {
                                            defaultValue:
                                                'Fila {{row}}: {{message}}',
                                            row: err?.row ?? '?',
                                            message: err?.message ?? '',
                                        })}
                                    </div>
                                ))}
                            {hasErrors && errors.length > 3 && (
                                <div className="text-xs mt-2 opacity-80">
                                    {t('sales.orders.importErrorMore', {
                                        defaultValue:
                                            'Se omitieron {{count}} errores adicionales.',
                                        count: errors.length - 3,
                                    })}
                                </div>
                            )}
                        </div>
                    </Notification>,
                    { placement: 'top-center' },
                )
                refreshOrders()
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('orders/import', error)
                const responseMessage =
                    (error as any)?.response?.data?.message ??
                    (error as any)?.message ??
                    ''
                const translatedMessage =
                    typeof responseMessage === 'string' && responseMessage
                        ? t(responseMessage, {
                              defaultValue: responseMessage,
                          })
                        : t('sales.orders.importError', {
                              defaultValue:
                                  'No fue posible importar los pedidos.',
                          })
                toast.push(
                    <Notification
                        title={t('text.actions.import', {
                            defaultValue: 'Importar',
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
        [refreshOrders, t],
    )

    const onExport = useCallback(async () => {
        if (exporting) return
        setExporting(true)
        try {
            const params = composeExportParams()
            const response = await apiExportSalesOrders<Blob, Record<string, unknown>>(params)
            const blob = response.data instanceof Blob
                ? response.data
                : new Blob([String(response.data ?? '')], { type: 'text/csv;charset=utf-8;' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            const timestamp = dayjs().format('YYYYMMDD-HHmmss')
            link.href = url
            link.setAttribute('download', `orders-${timestamp}.csv`)
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
                    {t('sales.orders.exportSuccess', {
                        defaultValue: 'Archivo CSV generado correctamente.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        } catch (error) {
            toast.push(
                <Notification
                    title={t('text.actions.export')}
                    type="danger"
                    duration={3000}
                >
                    {t('sales.orders.exportError', {
                        defaultValue: 'No fue posible generar el CSV.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setExporting(false)
        }
    }, [composeExportParams, exporting, t])

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onFileChange}
            />
            <Link className="w-full lg:w-auto" to="/app/sales/order-new">
                <Button className="w-full whitespace-nowrap lg:w-auto" variant="solid" size="sm" icon={<HiPlusCircle />}>
                    {t('text.actions.add')}
                </Button>
            </Link>
            {selectedRows.length > 0 && <BatchDeleteButton />}
            <Button
                block
                size="sm"
                icon={<HiUpload />}
                loading={importing}
                disabled={importing}
                onClick={onImportClick}
            >
                {t('text.actions.import', { defaultValue: 'Importar' })}
            </Button>
            <Button
                block
                size="sm"
                icon={<HiDownload />}
                loading={exporting}
                disabled={exporting}
                onClick={onExport}
            >
                {t('text.actions.export')}
            </Button>
            <OrderTableSearch />
        </div>
    )
}

export default OrdersTableTools
