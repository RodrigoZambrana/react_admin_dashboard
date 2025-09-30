import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useTranslation } from 'react-i18next'
import {
    apiGetCustomerStatuses,
    apiCreateCustomerStatus,
    apiUpdateCustomerStatus,
    apiDeleteCustomerStatus,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
type CustomerStatusItem = {
    id: string
    name: string
    color?: string
}

type ColorOption = {
    value: string
    label: string
}

const ColorDot = ({ color }: { color?: string }) => (
    <span
        className="badge-dot"
        style={{ backgroundColor: color && color.startsWith('#') ? color : '#6b7280' }}
    />
)

const DEFAULT_COLOR = '#22c55e'

const { Tr, Td, TBody, THead, Th } = Table

const CustomerStatuses = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<CustomerStatusItem[]>([])
    const [name, setName] = useState('')
    const [color, setColor] = useState<string>(DEFAULT_COLOR)
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState<string>(DEFAULT_COLOR)

    const fetch = async () => {
        const res = await apiGetCustomerStatuses<CustomerStatusItem[]>()
        setItems(
            (res.data as CustomerStatusItem[]).map((item) => ({
                id: String(item.id),
                name: item.name,
                color: item.color || '#6b7280',
            })),
        )
    }

    useEffect(() => {
        fetch()
    }, [])

    const colorOptions = useMemo<ColorOption[]>(
        () => [
            {
                value: DEFAULT_COLOR,
                label: t('settings.customerStatuses.colors.green', {
                    defaultValue: 'Verde',
                }),
            },
            {
                value: '#ef4444',
                label: t('settings.customerStatuses.colors.red', {
                    defaultValue: 'Rojo',
                }),
            },
            {
                value: '#3b82f6',
                label: t('settings.customerStatuses.colors.blue', {
                    defaultValue: 'Azul',
                }),
            },
            {
                value: '#f59e0b',
                label: t('settings.customerStatuses.colors.amber', {
                    defaultValue: 'Ámbar',
                }),
            },
            {
                value: '#a855f7',
                label: t('settings.customerStatuses.colors.purple', {
                    defaultValue: 'Morado',
                }),
            },
            {
                value: '#10b981',
                label: t('settings.customerStatuses.colors.teal', {
                    defaultValue: 'Turquesa',
                }),
            },
        ],
        [t],
    )

    const resolveColorOption = (value: string): ColorOption =>
        colorOptions.find((opt) => opt.value === value) || {
            value,
            label: value.toUpperCase(),
        }

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const res = await apiCreateCustomerStatus<boolean, {
            name: string
            color: string
        }>({ name, color })
        setLoading(false)
        if (res.data) {
            setName('')
            setColor(DEFAULT_COLOR)
            toast.push(
                <Notification title={t('settings.customerStatuses.created.title')} type="success">
                    {t('settings.customerStatuses.created.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onEdit = (s: CustomerStatusItem) => {
        setEditingId(s.id)
        setEditingName(s.name)
        setEditingColor(s.color || '#6b7280')
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
        setEditingColor(DEFAULT_COLOR)
    }

    const onUpdate = async () => {
        if (!editingId) return
        const res = await apiUpdateCustomerStatus<boolean, {
            id: string
            name: string
            color: string
        }>({ id: editingId, name: editingName, color: editingColor })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.customerStatuses.updated.title')} type="success">
                    {t('settings.customerStatuses.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            setEditingColor(DEFAULT_COLOR)
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
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 mb-4 max-w-3xl items-center">
                    <Input
                        value={name}
                        placeholder={t('settings.customerStatuses.placeholders.name')}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Select<ColorOption>
                        options={colorOptions}
                        value={resolveColorOption(color) as any}
                        onChange={(opt) => opt && setColor(opt.value)}
                        size="sm"
                        formatOptionLabel={(opt) => (
                            <div className="flex items-center gap-2">
                                <ColorDot color={opt.value} />
                                <span>{opt.label}</span>
                            </div>
                        )}
                    />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('text.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.customerStatuses.columns.name')}</Th>
                            <Th>{t('settings.customerStatuses.columns.color')}</Th>
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
                                        <Select<ColorOption>
                                            options={colorOptions}
                                            value={resolveColorOption(editingColor) as any}
                                            onChange={(opt) =>
                                                opt && setEditingColor(opt.value)
                                            }
                                            size="sm"
                                            formatOptionLabel={(opt) => (
                                                <div className="flex items-center gap-2">
                                                    <ColorDot color={opt.value} />
                                                    <span>{opt.label}</span>
                                                </div>
                                            )}
                                        />
                                    ) : (
                                        <ColorDot color={s.color} />
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
