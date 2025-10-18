import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetProductCategories,
    apiCreateProductCategory,
    apiUpdateProductCategory,
    apiDeleteProductCategory,
    apiExportSettings,
    apiImportSettings,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { downloadCsvFile, parseCsvFile } from '@/utils/csv'

type Category = { id: string; name: string }

const { Tr, Td, TBody, THead, Th } = Table

const ProductCategories = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Category[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const fetch = async () => {
        const res = await apiGetProductCategories<Category[]>()
        setItems(res.data as unknown as Category[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const res = await apiCreateProductCategory<boolean, { name: string }>({
            name,
        })
        setLoading(false)
        if (res.data) {
            setName('')
            toast.push(
                <Notification title={t('settings.productCategories.created.title')} type="success">
                    {t('settings.productCategories.created.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onEdit = (s: Category) => {
        setEditingId(s.id)
        setEditingName(s.name)
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
    }

    const onUpdate = async () => {
        if (!editingId) return
        const res = await apiUpdateProductCategory<boolean, Category>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.productCategories.updated.title')} type="success">
                    {t('settings.productCategories.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    const onDelete = async (id: string) => {
        const res = await apiDeleteProductCategory<boolean, { id: string }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.productCategories.deleted.title')} type="success">
                    {t('settings.productCategories.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const handleExport = async () => {
        try {
            setExporting(true)
            const res = await apiExportSettings<any>()
            const rows = Array.isArray(res.data?.productCategories)
                ? res.data.productCategories.map((category: any) => ({
                      name: category?.name ?? '',
                  }))
                : []
            downloadCsvFile('product_categories.csv', rows)
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
                productCategories: payload,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.productCategories.imported', {
                        defaultValue: 'Categorías importadas correctamente.',
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
        <Card className="card-shadow">
            <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
                <h4>{t('settings.productCategories.title')}</h4>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-4 max-w-xl">
                <Input
                    value={name}
                    placeholder={t('settings.productCategories.placeholders.name')}
                    onChange={(e) => setName(e.target.value)}
                />
                <Button loading={loading} onClick={onAdd} variant="solid">
                    {t('text.actions.add')}
                </Button>
            </div>
            <Table>
                <THead>
                    <Tr>
                        <Th>{t('settings.productCategories.columns.name')}</Th>
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
    )
}

export default ProductCategories
