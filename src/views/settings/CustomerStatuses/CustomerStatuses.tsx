import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetCustomerStatuses,
    apiCreateCustomerStatus,
    apiUpdateCustomerStatus,
    apiDeleteCustomerStatus,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

type Status = { id: string; name: string; color: string }

const { Tr, Td, TBody, THead, Th } = Table

const CustomerStatuses = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Status[]>([])
    const [name, setName] = useState('')
    const [id, setId] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')

    const fetch = async () => {
        const res = await apiGetCustomerStatuses<Status[]>()
        setItems(res.data as unknown as Status[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!id.trim() || !name.trim()) return
        setLoading(true)
        const res = await apiCreateCustomerStatus<boolean, Status>({ id, name, color: '' })
        setLoading(false)
        if (res.data) {
            setId('')
            setName('')
            toast.push(
                <Notification title={t('settings.customerStatuses.created.title')} type="success">
                    {t('settings.customerStatuses.created.desc')}
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
        if (!editingId) return
        const res = await apiUpdateCustomerStatus<boolean, Status>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.customerStatuses.updated.title')} type="success">
                    {t('settings.customerStatuses.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    const onDelete = async (id: string) => {
        const res = await apiDeleteCustomerStatus<boolean, { id: string }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.customerStatuses.deleted.title')} type="success">
                    {t('settings.customerStatuses.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Card className="card-shadow">
                <h4 className="mb-4">{t('settings.customerStatuses.title')}</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-4 max-w-2xl">
                    <Input value={id} placeholder={t('settings.customerStatuses.placeholders.id')} onChange={(e) => setId(e.target.value)} />
                    <Input value={name} placeholder={t('settings.customerStatuses.placeholders.name')} onChange={(e) => setName(e.target.value)} />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.customerStatuses.columns.id')}</Th>
                            <Th>{t('settings.customerStatuses.columns.name')}</Th>
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
        </div>
    )
}

export default CustomerStatuses

