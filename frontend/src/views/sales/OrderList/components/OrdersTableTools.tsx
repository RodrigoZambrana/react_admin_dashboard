import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { HiDownload, HiOutlineTrash, HiPlusCircle, HiUpload } from 'react-icons/hi'
import OrderTableSearch from './OrderTableSearch'
import {
    getOrders,
    setDeleteMode,
    useAppDispatch,
    useSalesOrderListData,
} from '../store'
import {
    apiExportSalesOrders,
    apiImportSalesOrders,
} from '@/services/SalesService'
import { useSalesDocumentI18n } from '../../context/useSalesDocumentI18n'

const BatchDeleteButton = () => {
    const { t } = useSalesDocumentI18n()
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
            data-testid="admin-order-list-batch-delete"
        >
            {t('text.actions.batchDelete')}
        </Button>
    )
}

const OrdersTableTools = () => {
    const { t, tDoc, resource, routes } = useSalesDocumentI18n()
    const dispatch = useAppDispatch()
    const salesOrderState = useSalesOrderListData()
    const { selectedRows, tableData } = salesOrderState
    const currentResource = tableData.resource ?? resource
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
                resource: currentResource,
            }),
        )
    }, [currentResource, dispatch, tableData])

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
                }>(formData, resource)
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
                    ? tDoc('importSuccessWithErrors', {
                          defaultValue:
                              'Documentos importados: {{imported}}. Registros con error: {{failed}}.',
                          imported: importedCount,
                          failed: failedCount,
                      })
                    : tDoc('importSuccess', {
                          defaultValue: 'Se importaron {{imported}} documentos.',
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
                                        {tDoc('importErrorRow', {
                                            defaultValue: 'Fila {{row}}: {{message}}',
                                            row: err?.row ?? '?',
                                            message: err?.message ?? '',
                                        })}
                                    </div>
                                ))}
                            {hasErrors && errors.length > 3 && (
                                <div className="text-xs mt-2 opacity-80">
                                    {tDoc('importErrorMore', {
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
                console.error(`${resource}/import`, error)
                const responseMessage =
                    (error as any)?.response?.data?.message ??
                    (error as any)?.message ??
                    ''
                const translatedMessage =
                    typeof responseMessage === 'string' && responseMessage
                        ? t(responseMessage, {
                              defaultValue: responseMessage,
                          })
                        : tDoc('importError', {
                              defaultValue:
                                  'No fue posible importar los documentos.',
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
        [refreshOrders, resource, t, tDoc],
    )

    const onExport = useCallback(async () => {
        if (exporting) return
        setExporting(true)
        try {
            const params = composeExportParams()
            const response = await apiExportSalesOrders<Blob, Record<string, unknown>>(
                params,
                resource,
            )
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
            link.setAttribute('download', `${resource}-${timestamp}.csv`)
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
                    {tDoc('exportSuccess', {
                        defaultValue: 'Archivo CSV generado correctamente.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        } catch {
            toast.push(
                <Notification
                    title={t('text.actions.export')}
                    type="danger"
                    duration={3000}
                >
                    {tDoc('exportError', {
                        defaultValue: 'No fue posible generar el CSV.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setExporting(false)
        }
    }, [composeExportParams, exporting, resource, t, tDoc])

    return (
        <div
            className="flex flex-col gap-4 lg:flex-row lg:items-center"
            data-testid="admin-order-list-tools"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                data-testid="admin-order-list-import-input"
                onChange={onFileChange}
            />
            <Link className="w-full lg:w-auto" to={routes.create}>
                <Button
                    className="w-full whitespace-nowrap lg:w-auto"
                    variant="solid"
                    size="sm"
                    icon={<HiPlusCircle />}
                    data-testid="admin-order-list-new"
                >
                    {tDoc('addAction', { defaultValue: 'Agregar Pedido' })}
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
                data-testid="admin-order-list-import"
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
                data-testid="admin-order-list-export"
            >
                {t('text.actions.export')}
            </Button>
            <div data-testid="admin-order-list-search">
                <OrderTableSearch />
            </div>
        </div>
    )
}

export default OrdersTableTools
