import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Table from '@/components/ui/Table'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Loading from '@/components/shared/Loading'
import {
    apiGetCalendarEventTypes,
    apiCreateCalendarEventType,
    apiUpdateCalendarEventType,
    apiDeleteCalendarEventType,
    apiExportSettings,
    apiImportSettings,
} from '@/services/SettingsService'
import { useTranslation } from 'react-i18next'
import { downloadCsvFile, parseCsvFile } from '@/utils/csv'

const { Tr, Td, TBody, THead, Th } = Table

const DEFAULT_COLOR = '#2563eb'

type CalendarEventType = {
    id: number
    name: string
    color: string
    description?: string | null
}

const normalizeColor = (value: string) => {
    if (!value) {
        return DEFAULT_COLOR
    }
    const trimmed = value.trim()
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        return trimmed.length === 4
            ? `#${trimmed
                  .substring(1)
                  .split('')
                  .map((char) => char + char)
                  .join('')}`
            : trimmed.toLowerCase()
    }
    return trimmed
}

const CalendarEventTypes = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<CalendarEventType[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [creatingName, setCreatingName] = useState('')
    const [creatingColor, setCreatingColor] = useState(DEFAULT_COLOR)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)
    const [savingId, setSavingId] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const load = async (showSpinner = true) => {
        try {
            if (showSpinner) {
                setLoading(true)
            }
            const response = await apiGetCalendarEventTypes<CalendarEventType[]>()
            const data = Array.isArray(response.data) ? response.data : []
            setItems(data)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleExport = async () => {
        try {
            setExporting(true)
            const response = await apiExportSettings<any>()
            const rows = Array.isArray(response.data?.calendarEventTypes)
                ? response.data.calendarEventTypes.map((item: any) => ({
                      name: item?.name ?? '',
                      color: item?.color ?? '',
                      description: item?.description ?? '',
                  }))
                : []
            downloadCsvFile('calendar_event_types.csv', rows)
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
                .map((row) => {
                    const name = String(row.name ?? '').trim()
                    if (!name) {
                        return null
                    }
                    const color = normalizeColor(String(row.color ?? DEFAULT_COLOR))
                    const description = String(row.description ?? '').trim()
                    return {
                        name,
                        color,
                        description: description || null,
                    }
                })
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
            await apiImportSettings({
                calendarEventTypes: payload,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.calendarEventTypes.imported', {
                        defaultValue: 'Tipos de evento importados correctamente.',
                    })}
                </Notification>,
            )
            await load(false)
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

    const resetCreateForm = () => {
        setCreatingName('')
        setCreatingColor(DEFAULT_COLOR)
    }

    const handleCreate = async () => {
        const name = creatingName.trim()
        if (!name) {
            toast.push(
                <Notification type="warning" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.calendarEventTypes.validation.labelRequired', {
                        defaultValue: 'El nombre es obligatorio',
                    })}
                </Notification>,
            )
            return
        }
        try {
            setCreating(true)
            await apiCreateCalendarEventType<boolean, { name: string; color: string }>(
                {
                    name,
                    color: normalizeColor(creatingColor),
                },
            )
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.calendarEventTypes.created', {
                        defaultValue: 'Tipo de evento creado correctamente.',
                    })}
                </Notification>,
            )
            resetCreateForm()
            await load(false)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setCreating(false)
        }
    }

    const startEdit = (item: CalendarEventType) => {
        setEditingId(item.id)
        setEditingName(item.name)
        setEditingColor(item.color || DEFAULT_COLOR)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditingName('')
        setEditingColor(DEFAULT_COLOR)
        setSavingId(null)
    }

    const handleSave = async (id: number) => {
        const name = editingName.trim()
        if (!name) {
            toast.push(
                <Notification type="warning" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.calendarEventTypes.validation.labelRequired', {
                        defaultValue: 'El nombre es obligatorio',
                    })}
                </Notification>,
            )
            return
        }
        try {
            setSavingId(id)
            await apiUpdateCalendarEventType<boolean, { name: string; color: string }>(id, {
                name,
                color: normalizeColor(editingColor),
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.calendarEventTypes.updated', {
                        defaultValue: 'Tipo de evento actualizado correctamente.',
                    })}
                </Notification>,
            )
            cancelEdit()
            await load(false)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSavingId(null)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            setDeletingId(id)
            await apiDeleteCalendarEventType<boolean>(id)
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {t('settings.calendarEventTypes.deleted', {
                        defaultValue: 'Tipo de evento eliminado correctamente.',
                    })}
                </Notification>,
            )
            await load(false)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setDeletingId(null)
        }
    }

    const renderColorPreview = (color: string) => {
        const value = normalizeColor(color)
        return (
            <div className="flex items-center gap-2">
                <span
                    className="inline-block h-5 w-5 rounded border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: value }}
                />
                <span className="text-sm font-mono">{value}</span>
            </div>
        )
    }

    return (
        <Loading loading={loading}>
            <Card>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="mb-1">
                            {t('settings.calendarEventTypes.title', {
                                defaultValue: 'Tipos de evento del calendario',
                            })}
                        </h3>
                        <p className="text-sm opacity-70">
                            {t('settings.calendarEventTypes.subtitle', {
                                defaultValue:
                                    'Configura las opciones disponibles al crear o editar eventos.',
                            })}
                        </p>
                    </div>
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

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6 items-end">
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold mb-2">
                            {t('settings.calendarEventTypes.fields.name', {
                                defaultValue: 'Nombre visible',
                            })}
                        </label>
                        <Input
                            value={creatingName}
                            placeholder={t(
                                'settings.calendarEventTypes.placeholders.label',
                                { defaultValue: 'Ej: Reunión' },
                            )}
                            onChange={(e) => setCreatingName(e.target.value)}
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold mb-2">
                            {t('settings.calendarEventTypes.fields.color', {
                                defaultValue: 'Color',
                            })}
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={creatingColor}
                                onChange={(e) => setCreatingColor(e.target.value)}
                                className="h-10 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
                                aria-label={t('settings.calendarEventTypes.fields.color', {
                                    defaultValue: 'Color',
                                })}
                            />
                            <Input
                                value={creatingColor}
                                onChange={(e) => setCreatingColor(e.target.value)}
                                placeholder="#2563eb"
                            />
                        </div>
                    </div>
                    <div className="flex lg:justify-end">
                        <Button
                            variant="solid"
                            onClick={handleCreate}
                            loading={creating}
                            disabled={creating}
                        >
                            {t('settings.calendarEventTypes.actions.add', {
                                defaultValue: 'Agregar tipo de evento',
                            })}
                        </Button>
                    </div>
                </div>

                <Table>
                    <THead>
                        <Tr>
                            <Th className="w-3/5">
                                {t('settings.calendarEventTypes.fields.name', {
                                    defaultValue: 'Nombre',
                                })}
                            </Th>
                            <Th className="w-1/5">
                                {t('settings.calendarEventTypes.fields.color', {
                                    defaultValue: 'Color',
                                })}
                            </Th>
                            <Th className="text-right w-1/5">
                                {t('text.columns.actions', { defaultValue: 'Acciones' })}
                            </Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {items.map((item) => {
                            const isEditing = editingId === item.id
                            return (
                                <Tr key={item.id}>
                                    <Td>
                                        {isEditing ? (
                                            <Input
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                            />
                                        ) : (
                                            <span className="font-medium">{item.name}</span>
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={editingColor}
                                                    onChange={(e) => setEditingColor(e.target.value)}
                                                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
                                                    aria-label={t('settings.calendarEventTypes.fields.color', {
                                                        defaultValue: 'Color',
                                                    })}
                                                />
                                                <Input
                                                    value={editingColor}
                                                    onChange={(e) => setEditingColor(e.target.value)}
                                                    placeholder="#2563eb"
                                                />
                                            </div>
                                        ) : (
                                            renderColorPreview(item.color)
                                        )}
                                    </Td>
                                    <Td className="text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    loading={savingId === item.id}
                                                    onClick={() => handleSave(item.id)}
                                                >
                                                    {t('text.actions.save', {
                                                        defaultValue: 'Guardar',
                                                    })}
                                                </Button>
                                                <Button size="sm" onClick={cancelEdit}>
                                                    {t('text.actions.cancel', {
                                                        defaultValue: 'Cancelar',
                                                    })}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" onClick={() => startEdit(item)}>
                                                    {t('text.actions.edit', {
                                                        defaultValue: 'Editar',
                                                    })}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="red-600"
                                                    loading={deletingId === item.id}
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={deletingId === item.id}
                                                >
                                                    {t('text.actions.delete', {
                                                        defaultValue: 'Eliminar',
                                                    })}
                                                </Button>
                                            </div>
                                        )}
                                    </Td>
                                </Tr>
                            )
                        })}
                    </TBody>
                </Table>
                {items.length === 0 && !loading && (
                    <div className="mt-4 text-sm opacity-70">
                        {t('settings.calendarEventTypes.empty', {
                            defaultValue: 'Aún no hay tipos de evento configurados.',
                        })}
                    </div>
                )}
            </Card>
        </Loading>
    )
}

export default CalendarEventTypes
