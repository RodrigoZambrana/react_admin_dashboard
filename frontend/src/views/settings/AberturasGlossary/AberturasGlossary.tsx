import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Drawer from '@/components/ui/Drawer'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import useConfirmation from '@/hooks/useConfirmation'
import {
    apiCreateAberturasGlossaryItem,
    apiDeleteAberturasGlossaryItem,
    apiGetAberturasGlossary,
    apiUpdateAberturasGlossaryItem,
} from '@/services/SettingsService'
import glossarySeed from '../../../../../docs/glosario_normalizado.json'

type GlossaryCategory = 'tipo' | 'serie' | 'color' | 'vidrio'

type GlossaryItem = {
    id: number
    category: GlossaryCategory
    label: string
    value: string
    adjustPct: number | null
    metadata: Record<string, unknown> | null
}

type GlossaryResponse = Record<string, GlossaryItem[]>

const { TabList, TabNav, TabContent } = Tabs
const { Tr, Th, Td, THead, TBody } = Table

const categories: Array<{ key: GlossaryCategory; translation: string }> = [
    { key: 'tipo', translation: 'settings.aberturas.tabs.types' },
    { key: 'serie', translation: 'settings.aberturas.tabs.series' },
    { key: 'color', translation: 'settings.aberturas.tabs.colors' },
    { key: 'vidrio', translation: 'settings.aberturas.tabs.glass' },
]

type FormValues = {
    id?: number
    label: string
    value: string
    adjustPct: number | null
}

const buildInitialValues = (item?: GlossaryItem): FormValues => ({
    id: item?.id,
    label: item?.label ?? '',
    value: item?.value ?? '',
    adjustPct: item?.adjustPct ?? null,
})

const shouldShowAdjustment = (category: GlossaryCategory) => category === 'color'

type GlossarySeedFile = {
    maps?: {
        tipos_abertura?: Record<string, string>
        series?: Record<string, string>
        colores?: Record<
            string,
            {
                normalized?: string
                adjust_pct?: number
            }
        >
        vidrios?: Record<string, string>
    }
}

type SeedItem = {
    category: GlossaryCategory
    label: string
    value: string
    adjustPct?: number
}

const normalizeSeedItems = (seed: GlossarySeedFile | undefined): SeedItem[] => {
    if (!seed?.maps) {
        return []
    }
    const items: SeedItem[] = []
    Object.entries(seed.maps.tipos_abertura ?? {}).forEach(([label, normalized]) => {
        items.push({ category: 'tipo', label, value: normalized })
    })
    Object.entries(seed.maps.series ?? {}).forEach(([label, normalized]) => {
        items.push({ category: 'serie', label, value: normalized })
    })
    Object.entries(seed.maps.colores ?? {}).forEach(([label, payload]) => {
        items.push({
            category: 'color',
            label,
            value: payload?.normalized ?? label,
            adjustPct: typeof payload?.adjust_pct === 'number' ? payload.adjust_pct : undefined,
        })
    })
    Object.entries(seed.maps.vidrios ?? {}).forEach(([label, normalized]) => {
        items.push({ category: 'vidrio', label, value: normalized })
    })
    return items
}

const defaultSeedItems = normalizeSeedItems(glossarySeed as GlossarySeedFile)

const AberturasGlossary = () => {
    const { t } = useTranslation()
    const confirm = useConfirmation()

    const [loading, setLoading] = useState(false)
    const [seeding, setSeeding] = useState(false)
    const [data, setData] = useState<GlossaryResponse>({})
    const [activeTab, setActiveTab] = useState<GlossaryCategory>('tipo')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<GlossaryItem | undefined>(undefined)

    const validationSchema = useMemo(
        () =>
            Yup.object().shape({
                label: Yup.string()
                    .trim()
                    .required(
                        t('settings.aberturas.form.errors.label', {
                            defaultValue: 'Label is required',
                        }),
                    ),
                value: Yup.string()
                    .trim()
                    .required(
                        t('settings.aberturas.form.errors.value', {
                            defaultValue: 'Value is required',
                        }),
                    ),
                adjustPct: shouldShowAdjustment(activeTab)
                    ? Yup.number()
                          .typeError(
                              t('settings.aberturas.form.errors.adjustNumber', {
                                  defaultValue: 'Enter a valid number',
                              }),
                          )
                          .min(
                              -100,
                              t('settings.aberturas.form.errors.adjustRange', {
                                  defaultValue: 'Minimum -100%',
                              }),
                          )
                          .max(
                              200,
                              t('settings.aberturas.form.errors.adjustRange', {
                                  defaultValue: 'Maximum 200%',
                              }),
                          )
                    : Yup.mixed().nullable().optional(),
            }),
        [activeTab, t],
    )

    const seedFromLocalGlossary = useCallback(async () => {
        if (!defaultSeedItems.length) {
            return false
        }
        setSeeding(true)
        try {
            for (const item of defaultSeedItems) {
                await apiCreateAberturasGlossaryItem(item.category, {
                    label: item.label,
                    value: item.value,
                    adjustPct: item.adjustPct,
                })
            }
            toast.push(
                <Notification
                    title={t('settings.aberturas.notifications.seedSuccess', {
                        defaultValue: 'Glossary initialized',
                    })}
                    type="success"
                />,
            )
            return true
        } catch (error) {
            console.error('[aberturas] seed error', error)
            toast.push(
                <Notification
                    title={t('settings.aberturas.notifications.seedErrorTitle', {
                        defaultValue: 'Unable to create glossary entries',
                    })}
                    type="danger"
                >
                    {t('settings.aberturas.notifications.seedErrorDescription', {
                        defaultValue: 'Review docs/glosario_normalizado.json and try again.',
                    })}
                </Notification>,
            )
            return false
        } finally {
            setSeeding(false)
        }
    }, [t])

    const fetchGlossary = useCallback(
        async (attemptSeed = true) => {
            setLoading(true)
            try {
                const response = await apiGetAberturasGlossary<Record<string, GlossaryItem[]>>()
                const payload = (response?.data ?? response ?? {}) as GlossaryResponse
                const hasRecords = Object.values(payload ?? {}).some(
                    (items) => Array.isArray(items) && items.length > 0,
                )
                if (!hasRecords && attemptSeed) {
                    const seeded = await seedFromLocalGlossary()
                    if (seeded) {
                        await fetchGlossary(false)
                        return
                    }
                }
                setData(payload ?? {})
            } catch (error) {
                console.error('[aberturas] failed to load glossary', error)
                toast.push(
                    <Notification
                        title={t('settings.aberturas.notifications.loadErrorTitle', {
                            defaultValue: 'Unable to load glossary',
                        })}
                        type="danger"
                    >
                        {t('settings.aberturas.notifications.loadErrorDescription', {
                            defaultValue: 'Please try again later.',
                        })}
                    </Notification>,
                )
            } finally {
                setLoading(false)
            }
        },
        [seedFromLocalGlossary, t],
    )

    useEffect(() => {
        fetchGlossary()
    }, [fetchGlossary])

    const items = useMemo(() => data[activeTab] ?? [], [activeTab, data])

    const handleOpenCreate = () => {
        setEditingItem(undefined)
        setDrawerOpen(true)
    }

    const handleOpenEdit = (item: GlossaryItem) => {
        setEditingItem(item)
        setDrawerOpen(true)
    }

    const handleDelete = async (item: GlossaryItem) => {
        const confirmed = await confirm.open({
            title: t('settings.aberturas.confirmDeleteTitle', { defaultValue: 'Delete item' }),
            content: t('settings.aberturas.confirmDeleteDescription', {
                defaultValue: 'Are you sure you want to delete “{{label}}”? This action cannot be undone.',
                label: item.label,
            }),
        })
        if (!confirmed) {
            return
        }
        try {
            await apiDeleteAberturasGlossaryItem(item.id)
            toast.push(
                <Notification
                    title={t('settings.aberturas.notifications.deleteSuccess', {
                        defaultValue: 'Item deleted',
                    })}
                    type="success"
                />,
            )
            fetchGlossary()
        } catch (error) {
            console.error('[aberturas] delete error', error)
            toast.push(
                <Notification
                    title={t('settings.aberturas.notifications.deleteErrorTitle', {
                        defaultValue: 'Unable to delete item',
                    })}
                    type="danger"
                >
                    {t('settings.aberturas.notifications.deleteErrorDescription', {
                        defaultValue: 'Please try again later.',
                    })}
                </Notification>,
            )
        }
    }

    const handleSubmit = async (values: FormValues) => {
        const payload = {
            label: values.label.trim(),
            value: values.value.trim(),
            adjustPct: shouldShowAdjustment(activeTab) ? values.adjustPct ?? 0 : undefined,
        }
        try {
            if (values.id) {
                await apiUpdateAberturasGlossaryItem(values.id, { ...payload, category: activeTab })
                toast.push(
                    <Notification
                        title={t('settings.aberturas.notifications.updateSuccess', {
                            defaultValue: 'Item updated',
                        })}
                        type="success"
                    />,
                )
            } else {
                await apiCreateAberturasGlossaryItem(activeTab, payload)
                toast.push(
                    <Notification
                        title={t('settings.aberturas.notifications.createSuccess', {
                            defaultValue: 'Item created',
                        })}
                        type="success"
                    />,
                )
            }
            setDrawerOpen(false)
            fetchGlossary()
        } catch (error) {
            console.error('[aberturas] save error', error)
            toast.push(
                <Notification
                    title={t('settings.aberturas.notifications.saveErrorTitle', {
                        defaultValue: 'Unable to save item',
                    })}
                    type="danger"
                >
                    {t('settings.aberturas.notifications.saveErrorDescription', {
                        defaultValue: 'Please review the data and try again.',
                    })}
                </Notification>,
            )
        }
    }

    return (
        <AdaptableCard bodyClass="p-0">
            <div className="p-4 flex items-center justify-between gap-3 border-b">
                <div>
                    <h3 className="text-lg font-semibold">
                        {t('settings.aberturas.title', { defaultValue: 'Aberturas glossary' })}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('settings.aberturas.description', {
                            defaultValue: 'Manage the normalized values used by the openings parametric matrix.',
                        })}
                    </p>
                </div>
                <Button size="sm" variant="solid" onClick={handleOpenCreate}>
                    {t('settings.aberturas.actions.add', { defaultValue: 'Add item' })}
                </Button>
            </div>
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value as GlossaryCategory)}>
                <TabList>
                    {categories.map((category) => (
                        <TabNav key={category.key} value={category.key}>
                            {t(category.translation, {
                                defaultValue: category.key,
                            })}
                        </TabNav>
                    ))}
                </TabList>
                <div className="p-4">
                    {categories.map((category) => (
                        <TabContent key={category.key} value={category.key}>
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Spinner size={24} />
                                </div>
                            ) : (
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>{t('settings.aberturas.table.label', { defaultValue: 'Label' })}</Th>
                                            <Th>{t('settings.aberturas.table.value', { defaultValue: 'Normalized value' })}</Th>
                                            {category.key === 'color' && (
                                                <Th>{t('settings.aberturas.table.adjust', { defaultValue: 'Adjust %' })}</Th>
                                            )}
                                            <Th className="w-32 text-right">
                                                {t('settings.aberturas.table.actions', { defaultValue: 'Actions' })}
                                            </Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {(data[category.key] ?? []).map((item) => (
                                            <Tr key={item.id}>
                                                <Td>{item.label}</Td>
                                                <Td>{item.value}</Td>
                                                {category.key === 'color' && (
                                                    <Td>{item.adjustPct !== null ? `${item.adjustPct}%` : '—'}</Td>
                                                )}
                                                <Td className="text-right space-x-2">
                                                    <Button
                                                        size="xs"
                                                        variant="plain"
                                                        icon={<HiOutlinePencil />}
                                                        onClick={() => handleOpenEdit(item)}
                                                    />
                                                    <Button
                                                        size="xs"
                                                        variant="plain"
                                                        tone="danger"
                                                        icon={<HiOutlineTrash />}
                                                        onClick={() => handleDelete(item)}
                                                    />
                                                </Td>
                                            </Tr>
                                        ))}
                                        {(data[category.key] ?? []).length === 0 && (
                                            <Tr>
                                                <Td colSpan={category.key === 'color' ? 4 : 3}>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                                                        {t('settings.aberturas.table.empty', {
                                                            defaultValue: 'No items yet. Add the first entry to get started.',
                                                        })}
                                                    </div>
                                                </Td>
                                            </Tr>
                                        )}
                                    </TBody>
                                </Table>
                            )}
                        </TabContent>
                    ))}
                </div>
            </Tabs>
            <Drawer
                isOpen={drawerOpen}
                width={420}
                bodyClass="p-0"
                onClose={() => setDrawerOpen(false)}
                onRequestClose={() => setDrawerOpen(false)}
                title={
                    editingItem
                        ? t('settings.aberturas.drawer.editTitle', {
                              defaultValue: 'Edit item',
                          })
                        : t('settings.aberturas.drawer.addTitle', {
                              defaultValue: 'Add item',
                          })
                }
            >
                <div className="p-6">
                    <Formik
                        initialValues={buildInitialValues(editingItem)}
                        enableReinitialize
                        validationSchema={validationSchema}
                        onSubmit={handleSubmit}
                    >
                        {({ values, handleChange, handleBlur, setFieldValue, errors, touched }) => (
                            <Form className="space-y-4">
                                <div>
                                    <Input
                                        name="label"
                                        value={values.label}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        label={t('settings.aberturas.form.label', { defaultValue: 'Label' })}
                                        placeholder={t('settings.aberturas.form.labelPlaceholder', {
                                            defaultValue: 'Display label',
                                        })}
                                        invalid={touched.label && Boolean(errors.label)}
                                        errorMessage={touched.label ? (errors.label as string) : undefined}
                                    />
                                </div>
                                <div>
                                    <Input
                                        name="value"
                                        value={values.value}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        label={t('settings.aberturas.form.value', { defaultValue: 'Normalized value' })}
                                        placeholder={t('settings.aberturas.form.valuePlaceholder', {
                                            defaultValue: 'Value stored in the matrix',
                                        })}
                                        invalid={touched.value && Boolean(errors.value)}
                                        errorMessage={touched.value ? (errors.value as string) : undefined}
                                    />
                                </div>
                                {shouldShowAdjustment(activeTab) && (
                                    <div>
                                        <Input
                                            type="number"
                                            name="adjustPct"
                                            value={values.adjustPct ?? ''}
                                            onChange={(event) => {
                                                const nextValue = event.target.value
                                                setFieldValue('adjustPct', nextValue === '' ? null : Number(nextValue))
                                            }}
                                            label={t('settings.aberturas.form.adjust', {
                                                defaultValue: 'Adjustment percentage',
                                            })}
                                            placeholder="0"
                                            suffix="%"
                                            invalid={touched.adjustPct && Boolean(errors.adjustPct)}
                                            errorMessage={touched.adjustPct ? (errors.adjustPct as string) : undefined}
                                        />
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" size="sm" variant="plain" onClick={() => setDrawerOpen(false)}>
                                        {t('common.cancel', { defaultValue: 'Cancel' })}
                                    </Button>
                                    <Button type="submit" size="sm" variant="solid">
                                        {t('common.save', { defaultValue: 'Save' })}
                                    </Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </div>
            </Drawer>
        </AdaptableCard>
    )
}

export default AberturasGlossary
