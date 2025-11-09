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
    apiGetAberturasConfig,
    apiUpdateAberturasGlossaryItem,
    apiUpdateAberturasConfig,
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

type ConfigFormValues = {
    nearestMaxResults: number
    dimensionTolerancePercent: number
    dimensionMinToleranceMm: number
}

type AberturasConfigResponse = {
    nearest: {
        maxResults: number
        dimensionTolerancePercent: number
        dimensionMinToleranceMm: number
    }
}

const defaultConfigValues: ConfigFormValues = {
    nearestMaxResults: 3,
    dimensionTolerancePercent: 12,
    dimensionMinToleranceMm: 40,
}

const AberturasGlossary = () => {
    const { t } = useTranslation()
    const confirm = useConfirmation()

    const [loading, setLoading] = useState(false)
    const [, setSeeding] = useState(false)
    const [data, setData] = useState<GlossaryResponse>({})
    const [activeTab, setActiveTab] = useState<GlossaryCategory>('tipo')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<GlossaryItem | undefined>(undefined)
    const [configValues, setConfigValues] = useState<ConfigFormValues | null>(null)
    const [configLoading, setConfigLoading] = useState(true)
    const [configSaving, setConfigSaving] = useState(false)

    const mapConfigResponse = useCallback((payload?: AberturasConfigResponse | null): ConfigFormValues => {
        return {
            nearestMaxResults: Number(payload?.nearest?.maxResults) || defaultConfigValues.nearestMaxResults,
            dimensionTolerancePercent:
                Number(payload?.nearest?.dimensionTolerancePercent) || defaultConfigValues.dimensionTolerancePercent,
            dimensionMinToleranceMm:
                Number(payload?.nearest?.dimensionMinToleranceMm) || defaultConfigValues.dimensionMinToleranceMm,
        }
    }, [])

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

    const configValidationSchema = useMemo(
        () =>
            Yup.object().shape({
                nearestMaxResults: Yup.number()
                    .typeError(
                        t('settings.aberturas.config.errors.number', {
                            defaultValue: 'Enter a valid number',
                        }),
                    )
                    .min(1)
                    .max(10)
                    .required(
                        t('settings.aberturas.config.errors.required', {
                            defaultValue: 'Required field',
                        }),
                    ),
                dimensionTolerancePercent: Yup.number()
                    .typeError(
                        t('settings.aberturas.config.errors.number', {
                            defaultValue: 'Enter a valid number',
                        }),
                    )
                    .min(1)
                    .max(100)
                    .required(
                        t('settings.aberturas.config.errors.required', {
                            defaultValue: 'Required field',
                        }),
                    ),
                dimensionMinToleranceMm: Yup.number()
                    .typeError(
                        t('settings.aberturas.config.errors.number', {
                            defaultValue: 'Enter a valid number',
                        }),
                    )
                    .min(1)
                    .max(2000)
                    .required(
                        t('settings.aberturas.config.errors.required', {
                            defaultValue: 'Required field',
                        }),
                    ),
            }),
        [t],
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

    const fetchConfig = useCallback(async () => {
        setConfigLoading(true)
        try {
            const response = await apiGetAberturasConfig<AberturasConfigResponse>()
            const payload = (response?.data ?? response ?? null) as AberturasConfigResponse | null
            setConfigValues(mapConfigResponse(payload))
        } catch (error) {
            console.error('[aberturas] failed to load config', error)
            toast.push(
                <Notification
                    title={t('settings.aberturas.config.loadErrorTitle', { defaultValue: 'Unable to load configuration' })}
                    type="danger"
                >
                    {t('settings.aberturas.config.loadErrorDescription', {
                        defaultValue: 'Revisá tu conexión e intentá nuevamente.',
                    })}
                </Notification>,
            )
            setConfigValues(defaultConfigValues)
        } finally {
            setConfigLoading(false)
        }
    }, [mapConfigResponse, t])

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

    useEffect(() => {
        fetchConfig()
    }, [fetchConfig])

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
        <div className="space-y-6">
            <AdaptableCard>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">
                            {t('settings.aberturas.config.title', { defaultValue: 'Nearest match configuration' })}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {t('settings.aberturas.config.description', {
                                defaultValue: 'Control how many alternatives are shown and how tolerant the search is around the requested dimensions.',
                            })}
                        </p>
                    </div>
                    {configLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spinner size={24} />
                        </div>
                    ) : (
                        <Formik
                            initialValues={configValues ?? defaultConfigValues}
                            enableReinitialize
                            validationSchema={configValidationSchema}
                            onSubmit={async (values, helpers) => {
                                setConfigSaving(true)
                                try {
                                    const payload = {
                                        nearest: {
                                            maxResults: Number(values.nearestMaxResults),
                                            dimensionTolerancePercent: Number(values.dimensionTolerancePercent),
                                            dimensionMinToleranceMm: Number(values.dimensionMinToleranceMm),
                                        },
                                    }
                                    const response = await apiUpdateAberturasConfig<AberturasConfigResponse, typeof payload>(payload)
                                    const saved = (response?.data ?? response ?? null) as AberturasConfigResponse | null
                                    const mapped = mapConfigResponse(saved)
                                    setConfigValues(mapped)
                                    toast.push(
                                        <Notification
                                            title={t('settings.aberturas.config.saveSuccess', {
                                                defaultValue: 'Configuration updated',
                                            })}
                                            type="success"
                                        />,
                                    )
                                    helpers.setValues(mapped)
                                } catch (error) {
                                    console.error('[aberturas] update config error', error)
                                    toast.push(
                                        <Notification
                                            title={t('settings.aberturas.config.saveErrorTitle', {
                                                defaultValue: 'Unable to update configuration',
                                            })}
                                            type="danger"
                                        >
                                            {t('settings.aberturas.config.saveErrorDescription', {
                                                defaultValue: 'Revisá tu conexión e intentá nuevamente.',
                                            })}
                                        </Notification>,
                                    )
                                } finally {
                                    setConfigSaving(false)
                                    helpers.setSubmitting(false)
                                }
                            }}
                        >
                            {({ values, errors, touched, handleChange, handleBlur, isSubmitting, resetForm }) => (
                                <Form className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="nearestMaxResults">
                                                {t('settings.aberturas.config.fields.nearestMax', {
                                                    defaultValue: 'Nearest results to show',
                                                })}
                                            </label>
                                            <Input
                                                id="nearestMaxResults"
                                                type="number"
                                                min={1}
                                                max={10}
                                                name="nearestMaxResults"
                                                value={values.nearestMaxResults}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                            />
                                            {touched.nearestMaxResults && errors.nearestMaxResults && (
                                                <div className="mt-1 text-xs text-red-500">{errors.nearestMaxResults}</div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="dimensionTolerancePercent">
                                                {t('settings.aberturas.config.fields.tolerancePercent', {
                                                    defaultValue: 'Dimension tolerance (%)',
                                                })}
                                            </label>
                                            <Input
                                                id="dimensionTolerancePercent"
                                                type="number"
                                                min={1}
                                                max={100}
                                                name="dimensionTolerancePercent"
                                                value={values.dimensionTolerancePercent}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                            />
                                            {touched.dimensionTolerancePercent && errors.dimensionTolerancePercent && (
                                                <div className="mt-1 text-xs text-red-500">{errors.dimensionTolerancePercent}</div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="dimensionMinToleranceMm">
                                                {t('settings.aberturas.config.fields.minTolerance', {
                                                    defaultValue: 'Minimum tolerance (mm)',
                                                })}
                                            </label>
                                            <Input
                                                id="dimensionMinToleranceMm"
                                                type="number"
                                                min={1}
                                                max={2000}
                                                name="dimensionMinToleranceMm"
                                                value={values.dimensionMinToleranceMm}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                            />
                                            {touched.dimensionMinToleranceMm && errors.dimensionMinToleranceMm && (
                                                <div className="mt-1 text-xs text-red-500">{errors.dimensionMinToleranceMm}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="submit" variant="solid" disabled={isSubmitting} loading={configSaving || isSubmitting}>
                                            {t('common.save', { defaultValue: 'Save' })}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="plain"
                                            disabled={configSaving || isSubmitting}
                                            onClick={() => resetForm({ values: configValues ?? defaultConfigValues })}
                                        >
                                            {t('common.reset', { defaultValue: 'Reset' })}
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    )}
                </div>
            </AdaptableCard>

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
            </AdaptableCard>

            <Drawer
                isOpen={drawerOpen}
                width={420}
                bodyClass="p-0"
                onClose={() => setDrawerOpen(false)}
                onRequestClose={() => setDrawerOpen(false)}
                title={
                    editingItem
                        ? t('settings.aberturas.drawer.editTitle', { defaultValue: 'Edit item' })
                        : t('settings.aberturas.drawer.addTitle', { defaultValue: 'Add item' })
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
        </div>
    )
}

export default AberturasGlossary
