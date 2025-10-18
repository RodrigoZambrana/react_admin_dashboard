import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetPaymentMethods,
    apiCreatePaymentMethod,
    apiUpdatePaymentMethod,
    apiDeletePaymentMethod,
    apiExportSettings,
    apiImportSettings,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { downloadCsvFile, parseCsvFile } from '@/utils/csv'

type Method = { id: string; name: string }

const { Tr, Td, TBody, THead, Th } = Table

const PaymentMethods = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Method[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const fetch = async () => {
        const res = await apiGetPaymentMethods<Method[]>()
        setItems(res.data as unknown as Method[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const res = await apiCreatePaymentMethod<boolean, { name: string }>(
            { name },
        )
        setLoading(false)
        if (res.data) {
            setName('')
            toast.push(
                <Notification title={t('settings.paymentMethods.created.title')} type="success">
                    {t('settings.paymentMethods.created.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onEdit = (m: Method) => {
        setEditingId(m.id)
        setEditingName(m.name)
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
    }

    const onUpdate = async () => {
        if (editingId === null) return
        const res = await apiUpdatePaymentMethod<boolean, Method>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.paymentMethods.updated.title')} type="success">
                    {t('settings.paymentMethods.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    const onDelete = async (id: string) => {
        const res = await apiDeletePaymentMethod<boolean, { id: string }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.paymentMethods.deleted.title')} type="success">
                    {t('settings.paymentMethods.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const handleExport = async () => {
        try {
            setExporting(true)
            const res = await apiExportSettings<any>()
            const rows = Array.isArray(res.data?.paymentMethods)
                ? res.data.paymentMethods.map((method: any) => ({
                      name: method?.name ?? '',
                  }))
                : []
            downloadCsvFile('payment_methods.csv', rows)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setExporting(false)
        }
    }

    const triggerImport = () => {
        fileInputRef.current?.click()
    }

    const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) {
            return
        }
        try {
            setImporting(true)
            const rows = await parseCsvFile<Record<string, string | null>>(file)
            const payload = rows
                .map((row) => ({
                    name: String(row.name ?? '').trim(),
                }))
                .filter((row) => row.name.length)
            await apiImportSettings({
                paymentMethods: payload,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.paymentMethods.imported', {
                        defaultValue: 'Métodos importados correctamente.',
                    })}
                </Notification>,
            )
            fetch()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Card className="card-shadow">
                <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
                    <h4>{t('settings.paymentMethods.title')}</h4>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="twoTone"
                            loading={exporting}
                            onClick={handleExport}
                        >
                            {t('text.actions.export')}
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            loading={importing}
                            onClick={triggerImport}
                        >
                            {t('text.actions.import', { defaultValue: 'Importar' })}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleImportChange}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 max-w-xl">
                    <Input
                        value={name}
                        placeholder={t('settings.paymentMethods.placeholders.name')}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.paymentMethods.columns.name')}</Th>
                            <Th className="text-right">{t('text.columns.actions')}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {items.map((m) => (
                            <Tr key={m.id}>
                                <Td>
                                    {editingId === m.id ? (
                                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                                    ) : (
                                        m.name
                                    )}
                                </Td>
                                <Td className="text-right">
                                    {editingId === m.id ? (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="twoTone" onClick={onUpdate}>{t('text.actions.save')}</Button>
                                            <Button size="sm" onClick={onCancel}>{t('text.actions.cancel')}</Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" onClick={() => onEdit(m)}>{t('text.actions.edit')}</Button>
                                            <Button size="sm" color="red-600" onClick={() => onDelete(m.id)}>{t('text.actions.delete')}</Button>
                                        </div>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </div>
    )
}

export default PaymentMethods
