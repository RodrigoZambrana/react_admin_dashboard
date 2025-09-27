import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import {
    apiGetExpenseCategories,
    apiCreateExpenseCategory,
    apiDeleteExpenseCategory,
    apiUpdateExpenseCategory,
} from '@/services/ExpensesService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

type Category = { id: string; name: string }

const { Tr, Td, TBody, THead, Th } = Table

const ExpenseCategories = () => {
    const { t } = useTranslation()
    const [categories, setCategories] = useState<Category[]>([])
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')

    const fetch = async () => {
        const res = await apiGetExpenseCategories<Category[]>()
        setCategories(res.data as unknown as Category[])
    }

    useEffect(() => {
        fetch()
    }, [])

    const onAdd = async () => {
        if (!name.trim()) return
        setLoading(true)
        const id = `cat-${Date.now().toString().slice(-6)}`
        const res = await apiCreateExpenseCategory<boolean, Category>({ id, name })
        setLoading(false)
        if (res.data) {
            setName('')
            toast.push(
                <Notification title={t('expenses.categories.created.title')} type="success">
                    {t('expenses.categories.created.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onDelete = async (id: string) => {
        const res = await apiDeleteExpenseCategory<boolean, { id: string }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('expenses.categories.deleted.title')} type="success">
                    {t('expenses.categories.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    const onEdit = (c: Category) => {
        setEditingId(c.id)
        setEditingName(c.name)
    }

    const onCancel = () => {
        setEditingId(null)
        setEditingName('')
    }

    const onUpdate = async () => {
        if (!editingId) return
        const res = await apiUpdateExpenseCategory<boolean, Category>({ id: editingId, name: editingName })
        if (res.data) {
            toast.push(
                <Notification title={t('expenses.categories.updated.title')} type="success">
                    {t('expenses.categories.updated.desc')}
                </Notification>,
            )
            setEditingId(null)
            setEditingName('')
            fetch()
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Card className="card-shadow">
                <h4 className="mb-4">{t('expenses.categories.title')}</h4>
                <div className="flex gap-2 mb-4 max-w-md">
                    <Input
                        value={name}
                        placeholder={t('expenses.categories.placeholders.name')}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Button loading={loading} onClick={onAdd} variant="solid">
                        {t('expenses.categories.actions.add')}
                    </Button>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('expenses.categories.columns.name')}</Th>
                            <Th className="text-right">{t('text.columns.actions')}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {categories.map((c) => (
                            <Tr key={c.id}>
                                <Td>
                                    {editingId === c.id ? (
                                        <Input
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                        />
                                    ) : (
                                        c.name
                                    )}
                                </Td>
                                <Td className="text-right">
                                    {editingId === c.id ? (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="twoTone" onClick={onUpdate}>
                                                {t('text.actions.save')}
                                            </Button>
                                            <Button size="sm" onClick={onCancel}>
                                                {t('text.actions.cancel')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" onClick={() => onEdit(c)}>
                                                {t('text.actions.edit')}
                                            </Button>
                                            <Button size="sm" color="red-600" onClick={() => onDelete(c.id)}>
                                                {t('text.actions.delete')}
                                            </Button>
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

export default ExpenseCategories
