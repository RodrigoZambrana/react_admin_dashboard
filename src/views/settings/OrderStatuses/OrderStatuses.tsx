import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetOrderStatuses,
    apiCreateOrderStatus,
    apiUpdateOrderStatus,
    apiDeleteOrderStatus,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

type Status = { id: number; name: string; color: string }

const { Tr, Td, TBody, THead, Th } = Table

const OrderStatuses = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Status[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')

    const fetch = async () => {
        const res = await apiGetOrderStatuses<Status[]>()
        setItems(res.data as unknown as Status[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const id = items.length ? Math.max(...items.map((x) => x.id)) + 1 : 0
        const res = await apiCreateOrderStatus<boolean, Status>({ id, name, color: '' })
        setLoading(false)
        if (res.data) {
            setName('')
            toast.push(
                <Notification title={t('settings.orderStatuses.created.title')} type="success">
                    {t('settings.orderStatuses.created.desc')}
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
        const res = await apiUpdateOrderStatus<boolean, Status>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.orderStatuses.updated.title')} type="success">
                    {t('settings.orderStatuses.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    const onDelete = async (id: number) => {
        const res = await apiDeleteOrderStatus<boolean, { id: number }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.orderStatuses.deleted.title')} type="success">
                    {t('settings.orderStatuses.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Card className="card-shadow">
                <h4 className="mb-4">{t('settings.orderStatuses.title')}</h4>
                <div className="flex gap-2 mb-4 max-w-md">
                    <Input value={name} placeholder={t('settings.orderStatuses.placeholders.name')} onChange={(e) => setName(e.target.value)} />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.orderStatuses.columns.name')}</Th>
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

export default OrderStatuses

