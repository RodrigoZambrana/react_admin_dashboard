import { useEffect, useState } from 'react'
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
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

type Category = { id: string; name: string }

const { Tr, Td, TBody, THead, Th } = Table

const ProductCategories = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Category[]>([])
    const [name, setName] = useState('')
    const [id, setId] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')

    const fetch = async () => {
        const res = await apiGetProductCategories<Category[]>()
        setItems(res.data as unknown as Category[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!id.trim() || !name.trim()) return
        setLoading(true)
        const res = await apiCreateProductCategory<boolean, Category>({ id, name })
        setLoading(false)
        if (res.data) {
            setId('')
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

    return (
        <Card className="card-shadow">
            <h4 className="mb-4">{t('settings.productCategories.title')}</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-4 max-w-2xl">
                <Input value={id} placeholder={t('settings.productCategories.placeholders.id')} onChange={(e) => setId(e.target.value)} />
                <Input value={name} placeholder={t('settings.productCategories.placeholders.name')} onChange={(e) => setName(e.target.value)} />
                <Button loading={loading} onClick={onAdd} variant="solid">
                    {t('text.actions.add')}
                </Button>
            </div>
            <Table>
                <THead>
                    <Tr>
                        <Th>{t('settings.productCategories.columns.id')}</Th>
                        <Th>{t('settings.productCategories.columns.name')}</Th>
                        <Th className="text-right">{t('text.columns.actions')}</Th>
                    </Tr>
                </THead>
                <TBody>
                    {items.map((s) => (
                        <Tr key={s.id}>
                            <Td>{s.id}</Td>
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

