import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
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

// Basic state colors first (green, amber, red), then optional extras
const basicColorOptions = [
    { value: 'emerald-500', label: 'Green' },
    { value: 'amber-500', label: 'Amber' },
    { value: 'red-500', label: 'Red' },
]
const extraColorOptions = [
    { value: 'cyan-500', label: 'Cyan' },
    { value: 'blue-500', label: 'Blue' },
    { value: 'violet-500', label: 'Violet' },
    { value: 'gray-500', label: 'Gray' },
]
const colorOptions = [...basicColorOptions, ...extraColorOptions]

const OrderStatuses = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<Status[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [color, setColor] = useState<string>('emerald-500')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState<string>('')

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
        const res = await apiCreateOrderStatus<boolean, Status>({ id, name, color })
        setLoading(false)
        if (res.data) {
            setName('')
            setColor('emerald-500')
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
        setEditingColor(s.color || 'emerald-500')
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
    }

    const onUpdate = async () => {
        if (editingId === null) return
        const res = await apiUpdateOrderStatus<boolean, Status>({ id: editingId, name: editingName, color: editingColor })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.orderStatuses.updated.title')} type="success">
                    {t('settings.orderStatuses.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            setEditingColor('')
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
                <div className="flex gap-3 mb-4 max-w-2xl items-center">
                    <Input value={name} placeholder={t('settings.orderStatuses.placeholders.name')} onChange={(e) => setName(e.target.value)} />
                    <div className="w-[220px]">
                        <Select
                            options={colorOptions}
                            value={colorOptions.find((c) => c.value === color) as any}
                            onChange={(opt) => setColor((opt as any).value)}
                            formatOptionLabel={(opt: any) => (
                                <div className="flex items-center">
                                    <span className={`badge-dot bg-${opt.value}`}></span>
                                    <span className="ml-2 rtl:mr-2">{opt.label}</span>
                                </div>
                            )}
                        />
                    </div>
                    {/* Live color preview */}
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-6 rounded border border-gray-200 dark:border-gray-600 bg-${color}`}></div>
                        <span className="text-sm opacity-80">{t('text.columns.color')}: {color}</span>
                    </div>
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.orderStatuses.columns.name')}</Th>
                            <Th>{t('text.columns.color')}</Th>
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
                                <Td>
                                    {editingId === s.id ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-[220px]">
                                                <Select
                                                    options={colorOptions}
                                                    value={colorOptions.find((c) => c.value === editingColor) as any}
                                                    onChange={(opt) => setEditingColor((opt as any).value)}
                                                    formatOptionLabel={(opt: any) => (
                                                        <div className="flex items-center">
                                                            <span className={`badge-dot bg-${opt.value}`}></span>
                                                            <span className="ml-2 rtl:mr-2">{opt.label}</span>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                            {/* Live color preview for edit */}
                                            <div className={`w-8 h-6 rounded border border-gray-200 dark:border-gray-600 bg-${editingColor}`}></div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center">
                                            <span className={`badge-dot bg-${s.color || 'gray-500'}`}></span>
                                            <span className="ml-2 rtl:mr-2 capitalize">{s.color || '-'}</span>
                                        </div>
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
