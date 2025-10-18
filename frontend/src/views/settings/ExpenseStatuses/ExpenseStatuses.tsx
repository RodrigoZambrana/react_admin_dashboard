import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetExpenseStatuses,
    apiCreateExpenseStatus,
    apiUpdateExpenseStatus,
    apiDeleteExpenseStatus,
    apiExportSettings,
    apiImportSettings,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { downloadCsvFile, parseCsvFile } from '@/utils/csv'

type Status = { id: number; name: string; color: string }

const { Tr, Td, TBody, THead, Th } = Table

const ExpenseStatuses = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Status[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const fetch = async () => {
        const res = await apiGetExpenseStatuses<Status[]>()
        setItems(res.data as unknown as Status[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const id = items.length ? Math.max(...items.map((x) => x.id)) + 1 : 0
        const res = await apiCreateExpenseStatus<boolean, Status>({ id, name, color: '' })
        setLoading(false)
        if (res.data) {
            setName('')
            toast.push(
                <Notification title={t('settings.expenseStatuses.created.title')} type="success">
                    {t('settings.expenseStatuses.created.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onEdit = (s: Status) => {
        setEditingId(s.id)
        setEditingName(s.name)
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
    }

    const onUpdate = async () => {
        if (editingId === null) return
        const res = await apiUpdateExpenseStatus<boolean, Status>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.expenseStatuses.updated.title')} type="success">
                    {t('settings.expenseStatuses.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    const onDelete = async (id: number) => {
        const res = await apiDeleteExpenseStatus<boolean, { id: number }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.expenseStatuses.deleted.title')} type="success">
                    {t('settings.expenseStatuses.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const handleExport = async () => {
        try {
            setExporting(true)
            const res = await apiExportSettings<any>()
            const rows = Array.isArray(res.data?.expenseStatuses)
                ? res.data.expenseStatuses.map((status: any) => ({
                      name: status?.name ?? '',
                      color: status?.color ?? '',
                  }))
                : []
            downloadCsvFile('expense_statuses.csv', rows)
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
                    color: String(row.color ?? '').trim() || null,
                }))
                .filter((row) => row.name.length)
            await apiImportSettings({
                expenseStatuses: payload,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.expenseStatuses.imported', {
                        defaultValue: 'Estados importados correctamente.',
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
                    <h4>{t('settings.expenseStatuses.title')}</h4>
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
                <div className="flex gap-2 mb-4 max-w-md">
                    <Input value={name} placeholder={t('settings.expenseStatuses.placeholders.name')} onChange={(e) => setName(e.target.value)} />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.expenseStatuses.columns.name')}</Th>
                            <Th className="text-right">{t('text.columns.actions')}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {items.map((s) => (
                            <Tr key={s.id}>
                                <Td>
                                    {editingId === s.id ? (
                                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                                    ) : (
                                        s.name
                                    )}
                                </Td>
                                <Td className="text-right">
                                    {editingId === s.id ? (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="twoTone" onClick={onUpdate}>{t('text.actions.save')}</Button>
                                            <Button size="sm" onClick={onCancel}>{t('text.actions.cancel')}</Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" onClick={() => onEdit(s)}>{t('text.actions.edit')}</Button>
                                            <Button size="sm" color="red-600" onClick={() => onDelete(s.id)}>{t('text.actions.delete')}</Button>
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

export default ExpenseStatuses
