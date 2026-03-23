import { useCallback, useEffect, useMemo, useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Switcher from '@/components/ui/Switcher'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import {
    apiCreateCmsEntry,
    apiCreateCmsSection,
    apiDeleteCmsEntry,
    apiDeleteCmsSection,
    apiGetCmsEntries,
    apiGetCmsSections,
    apiUpdateCmsEntry,
    apiUpdateCmsSection,
} from '@/services/CmsService'
import { apiGetSalesProducts } from '@/services/SalesService'
import { apiGetProductCategories } from '@/services/SettingsService'

type CmsSection = {
    id: number
    key: string
    name: string
    description?: string | null
    isActive: boolean
    sortOrder: number
    _count?: {
        entries: number
    }
}

type CmsAsset = {
    id?: number
    title?: string
    caption?: string
    mediaType: 'IMAGE' | 'VIDEO' | 'EMBED'
    mediaUrl: string
    posterUrl?: string
    externalUrl?: string
    durationSec?: number | null
    sortOrder: number
    isActive: boolean
}

type CmsEntry = {
    id?: number
    sectionId: number
    slug?: string
    title: string
    subtitle?: string
    description?: string
    payload?: Record<string, unknown> | null
    locale: string
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    priority: number
    isActive: boolean
    publishedAt?: string | null
    startsAt?: string | null
    endsAt?: string | null
    thumbnailUrl?: string
    ctaLabel?: string
    ctaUrl?: string
    productId?: number | null
    categoryId?: number | null
    assets: CmsAsset[]
}

type ProductOption = {
    id: number
    name: string
}

type CategoryOption = {
    id: number
    name: string
}

const emptySection = (): Omit<CmsSection, 'id'> => ({
    key: '',
    name: '',
    description: '',
    isActive: true,
    sortOrder: 0,
})

const emptyAsset = (sortOrder = 0): CmsAsset => ({
    mediaType: 'IMAGE',
    mediaUrl: '',
    posterUrl: '',
    externalUrl: '',
    title: '',
    caption: '',
    durationSec: 8,
    sortOrder,
    isActive: true,
})

const emptyEntry = (sectionId = 0): CmsEntry => ({
    sectionId,
    slug: '',
    title: '',
    subtitle: '',
    description: '',
    payload: null,
    locale: 'es',
    status: 'DRAFT',
    priority: 0,
    isActive: true,
    publishedAt: null,
    startsAt: null,
    endsAt: null,
    thumbnailUrl: '',
    ctaLabel: '',
    ctaUrl: '',
    productId: null,
    categoryId: null,
    assets: [],
})

const formatDateTimeLocal = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (input: number) => String(input).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes(),
    )}`
}

const parseJsonPayload = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return null
    return JSON.parse(trimmed) as Record<string, unknown>
}

const toIsoOrNull = (value: string) => {
    if (!value.trim()) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString()
}

const ContentManager = () => {
    const [loading, setLoading] = useState(false)
    const [sections, setSections] = useState<CmsSection[]>([])
    const [entries, setEntries] = useState<CmsEntry[]>([])
    const [products, setProducts] = useState<ProductOption[]>([])
    const [categories, setCategories] = useState<CategoryOption[]>([])
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null)
    const [sectionForm, setSectionForm] = useState<Omit<CmsSection, 'id'>>(emptySection())
    const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
    const [entryForm, setEntryForm] = useState<CmsEntry>(emptyEntry())
    const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
    const [payloadText, setPayloadText] = useState('')

    const selectedSection = useMemo(
        () => sections.find((section) => section.id === selectedSectionId) ?? null,
        [sections, selectedSectionId],
    )

    const loadSections = useCallback(async () => {
        const response = await apiGetCmsSections<CmsSection[]>()
        const nextSections = Array.isArray(response.data) ? response.data : []
        setSections(nextSections)
        setSelectedSectionId((current) => {
            if (current && nextSections.some((section) => section.id === current)) {
                return current
            }
            return nextSections.find((section) => section.key === 'HOME_STORIES')?.id ?? nextSections[0]?.id ?? null
        })
    }, [])

    const loadEntries = useCallback(async (sectionId: number) => {
        const response = await apiGetCmsEntries<CmsEntry[]>({ sectionId })
        setEntries(Array.isArray(response.data) ? response.data : [])
    }, [])

    const loadLookupData = useCallback(async () => {
        const [productsResponse, categoriesResponse] = await Promise.all([
            apiGetSalesProducts<{ data?: Array<{ id: string | number; name?: string }> }, Record<string, unknown>>({
                pageIndex: 1,
                pageSize: 250,
            }),
            apiGetProductCategories<Array<{ id: number; name: string }>>(),
        ])

        setProducts(
            Array.isArray(productsResponse.data?.data)
                ? productsResponse.data.data.map((item) => ({
                      id: Number(item.id),
                      name: item.name ?? `#${String(item.id)}`,
                  }))
                : [],
        )

        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [])
    }, [])

    useEffect(() => {
        setLoading(true)
        Promise.all([loadSections(), loadLookupData()])
            .catch((error) => {
                console.error(error)
                toast.push(
                    <Notification title="CMS" type="danger">
                        No fue posible cargar la configuración CMS.
                    </Notification>,
                )
            })
            .finally(() => setLoading(false))
    }, [loadSections, loadLookupData])

    useEffect(() => {
        if (!selectedSectionId) {
            setEntries([])
            setEntryForm(emptyEntry())
            setEditingEntryId(null)
            return
        }
        loadEntries(selectedSectionId).catch((error) => {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible cargar las entradas CMS.
                </Notification>,
            )
        })
        setEntryForm((current) => ({ ...emptyEntry(selectedSectionId), sectionId: current.sectionId || selectedSectionId }))
        setEditingEntryId(null)
        setPayloadText('')
    }, [loadEntries, selectedSectionId])

    const resetSectionForm = () => {
        setEditingSectionId(null)
        setSectionForm(emptySection())
    }

    const resetEntryForm = useCallback(() => {
        setEditingEntryId(null)
        setEntryForm(emptyEntry(selectedSectionId ?? 0))
        setPayloadText('')
    }, [selectedSectionId])

    const handleSaveSection = async () => {
        try {
            if (editingSectionId) {
                await apiUpdateCmsSection(editingSectionId, sectionForm)
            } else {
                await apiCreateCmsSection(sectionForm)
            }
            await loadSections()
            resetSectionForm()
            toast.push(
                <Notification title="CMS" type="success">
                    Sección guardada correctamente.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible guardar la sección.
                </Notification>,
            )
        }
    }

    const handleDeleteSection = async (sectionId: number) => {
        if (!window.confirm('¿Eliminar esta sección CMS y sus entradas?')) return
        try {
            await apiDeleteCmsSection(sectionId)
            await loadSections()
            resetSectionForm()
            resetEntryForm()
            toast.push(
                <Notification title="CMS" type="success">
                    Sección eliminada.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible eliminar la sección.
                </Notification>,
            )
        }
    }

    const handleSaveEntry = async () => {
        if (!selectedSectionId) return
        try {
            const payload = {
                ...entryForm,
                sectionId: selectedSectionId,
                payload: parseJsonPayload(payloadText),
                publishedAt: toIsoOrNull(formatDateTimeLocal(entryForm.publishedAt)),
                startsAt: toIsoOrNull(formatDateTimeLocal(entryForm.startsAt)),
                endsAt: toIsoOrNull(formatDateTimeLocal(entryForm.endsAt)),
                assets: entryForm.assets.map((asset, index) => ({
                    ...asset,
                    sortOrder: index,
                    durationSec:
                        asset.durationSec === null || asset.durationSec === undefined || asset.durationSec === ''
                            ? null
                            : Number(asset.durationSec),
                })),
            }

            if (editingEntryId) {
                await apiUpdateCmsEntry(editingEntryId, payload)
            } else {
                await apiCreateCmsEntry(payload)
            }
            await loadEntries(selectedSectionId)
            resetEntryForm()
            toast.push(
                <Notification title="CMS" type="success">
                    Entrada guardada correctamente.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible guardar la entrada CMS.
                </Notification>,
            )
        }
    }

    const handleDeleteEntry = async (entryId: number) => {
        if (!window.confirm('¿Eliminar esta entrada CMS?')) return
        try {
            await apiDeleteCmsEntry(entryId)
            if (selectedSectionId) {
                await loadEntries(selectedSectionId)
            }
            resetEntryForm()
            toast.push(
                <Notification title="CMS" type="success">
                    Entrada eliminada.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible eliminar la entrada.
                </Notification>,
            )
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <AdaptableCard divider>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h4 className="mb-1">CMS</h4>
                        <p className="mb-0 text-sm text-gray-500">
                            Gestiona secciones editoriales desacopladas de producto.
                        </p>
                    </div>
                    <Button type="button" variant="solid" onClick={resetEntryForm} disabled={!selectedSectionId}>
                        Nueva entrada
                    </Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-1 flex flex-col gap-4">
                        <AdaptableCard divider>
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="mb-0">Secciones</h5>
                                <Button size="sm" type="button" variant="plain" onClick={resetSectionForm}>
                                    Nueva
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {sections.map((section) => (
                                    <button
                                        key={section.id}
                                        type="button"
                                        className={`w-full rounded-lg border px-3 py-3 text-left ${
                                            selectedSectionId === section.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 bg-white'
                                        }`}
                                        onClick={() => setSelectedSectionId(section.id)}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">{section.name}</div>
                                                <div className="text-xs text-gray-500">{section.key}</div>
                                            </div>
                                            <div className="text-xs text-gray-500">{section._count?.entries ?? 0}</div>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <Button
                                                size="xs"
                                                type="button"
                                                variant="plain"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    setEditingSectionId(section.id)
                                                    setSectionForm({
                                                        key: section.key,
                                                        name: section.name,
                                                        description: section.description ?? '',
                                                        isActive: section.isActive,
                                                        sortOrder: section.sortOrder,
                                                    })
                                                }}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                size="xs"
                                                type="button"
                                                variant="plain"
                                                className="text-red-600"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleDeleteSection(section.id)
                                                }}
                                            >
                                                Eliminar
                                            </Button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </AdaptableCard>

                        <AdaptableCard divider>
                            <h5 className="mb-3">{editingSectionId ? 'Editar sección' : 'Nueva sección'}</h5>
                            <div className="grid grid-cols-1 gap-3">
                                <Input
                                    placeholder="Key (ej: HOME_STORIES)"
                                    value={sectionForm.key}
                                    onChange={(event) => setSectionForm((current) => ({ ...current, key: event.target.value }))}
                                />
                                <Input
                                    placeholder="Nombre"
                                    value={sectionForm.name}
                                    onChange={(event) => setSectionForm((current) => ({ ...current, name: event.target.value }))}
                                />
                                <Textarea
                                    rows={3}
                                    placeholder="Descripción"
                                    value={sectionForm.description ?? ''}
                                    onChange={(event) =>
                                        setSectionForm((current) => ({ ...current, description: event.target.value }))
                                    }
                                />
                                <Input
                                    type="number"
                                    placeholder="Prioridad"
                                    value={String(sectionForm.sortOrder ?? 0)}
                                    onChange={(event) =>
                                        setSectionForm((current) => ({
                                            ...current,
                                            sortOrder: Number(event.target.value || 0),
                                        }))
                                    }
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Activa</span>
                                    <Switcher
                                        checked={sectionForm.isActive}
                                        onChange={(checked) => setSectionForm((current) => ({ ...current, isActive: checked }))}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="solid" onClick={handleSaveSection}>
                                        Guardar sección
                                    </Button>
                                    <Button type="button" variant="plain" onClick={resetSectionForm}>
                                        Limpiar
                                    </Button>
                                </div>
                            </div>
                        </AdaptableCard>
                    </div>

                    <div className="xl:col-span-2 flex flex-col gap-4">
                        <AdaptableCard divider>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h5 className="mb-1">Entradas CMS</h5>
                                    <p className="mb-0 text-sm text-gray-500">
                                        {selectedSection
                                            ? `Sección activa: ${selectedSection.name}`
                                            : 'Selecciona una sección para empezar.'}
                                    </p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-sm text-gray-500">Cargando...</div>
                            ) : entries.length === 0 ? (
                                <div className="text-sm text-gray-500">No hay entradas cargadas para esta sección.</div>
                            ) : (
                                <div className="space-y-2">
                                    {entries.map((entry) => (
                                        <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="font-semibold">{entry.title}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {entry.status} · {entry.locale} · prioridad {entry.priority}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="xs"
                                                        type="button"
                                                        variant="plain"
                                                        onClick={() => {
                                                            setEditingEntryId(entry.id ?? null)
                                                            setEntryForm({
                                                                ...entry,
                                                                sectionId: selectedSectionId ?? entry.sectionId,
                                                                assets: Array.isArray(entry.assets) ? entry.assets : [],
                                                            })
                                                            setPayloadText(
                                                                entry.payload ? JSON.stringify(entry.payload, null, 2) : '',
                                                            )
                                                        }}
                                                    >
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        type="button"
                                                        variant="plain"
                                                        className="text-red-600"
                                                        onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                                    >
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AdaptableCard>

                        <AdaptableCard divider>
                            <h5 className="mb-3">{editingEntryId ? 'Editar entrada' : 'Nueva entrada'}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                    placeholder="Título"
                                    value={entryForm.title}
                                    onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))}
                                />
                                <Input
                                    placeholder="Slug"
                                    value={entryForm.slug ?? ''}
                                    onChange={(event) => setEntryForm((current) => ({ ...current, slug: event.target.value }))}
                                />
                                <Input
                                    placeholder="Subtítulo"
                                    value={entryForm.subtitle ?? ''}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({ ...current, subtitle: event.target.value }))
                                    }
                                />
                                <Input
                                    placeholder="Thumbnail URL"
                                    value={entryForm.thumbnailUrl ?? ''}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({ ...current, thumbnailUrl: event.target.value }))
                                    }
                                />
                                <Input
                                    placeholder="CTA label"
                                    value={entryForm.ctaLabel ?? ''}
                                    onChange={(event) => setEntryForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                                />
                                <Input
                                    placeholder="CTA URL"
                                    value={entryForm.ctaUrl ?? ''}
                                    onChange={(event) => setEntryForm((current) => ({ ...current, ctaUrl: event.target.value }))}
                                />
                                <Input
                                    placeholder="Locale"
                                    value={entryForm.locale}
                                    onChange={(event) => setEntryForm((current) => ({ ...current, locale: event.target.value }))}
                                />
                                <Input
                                    type="number"
                                    placeholder="Prioridad"
                                    value={String(entryForm.priority ?? 0)}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            priority: Number(event.target.value || 0),
                                        }))
                                    }
                                />
                                <select
                                    className="input"
                                    value={entryForm.status}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            status: event.target.value as CmsEntry['status'],
                                        }))
                                    }
                                >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="PUBLISHED">PUBLISHED</option>
                                    <option value="ARCHIVED">ARCHIVED</option>
                                </select>
                                <select
                                    className="input"
                                    value={String(entryForm.productId ?? '')}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            productId: event.target.value ? Number(event.target.value) : null,
                                        }))
                                    }
                                >
                                    <option value="">Sin producto</option>
                                    {products.map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={String(entryForm.categoryId ?? '')}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            categoryId: event.target.value ? Number(event.target.value) : null,
                                        }))
                                    }
                                >
                                    <option value="">Sin categoría</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                                    <span className="text-sm font-medium">Activa</span>
                                    <Switcher
                                        checked={entryForm.isActive}
                                        onChange={(checked) => setEntryForm((current) => ({ ...current, isActive: checked }))}
                                    />
                                </div>
                                <Input
                                    type="datetime-local"
                                    value={formatDateTimeLocal(entryForm.publishedAt)}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            publishedAt: toIsoOrNull(event.target.value),
                                        }))
                                    }
                                />
                                <Input
                                    type="datetime-local"
                                    value={formatDateTimeLocal(entryForm.startsAt)}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            startsAt: toIsoOrNull(event.target.value),
                                        }))
                                    }
                                />
                                <Input
                                    type="datetime-local"
                                    value={formatDateTimeLocal(entryForm.endsAt)}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({
                                            ...current,
                                            endsAt: toIsoOrNull(event.target.value),
                                        }))
                                    }
                                />
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <Textarea
                                    rows={4}
                                    placeholder="Descripción"
                                    value={entryForm.description ?? ''}
                                    onChange={(event) =>
                                        setEntryForm((current) => ({ ...current, description: event.target.value }))
                                    }
                                />
                                <Textarea
                                    rows={5}
                                    placeholder="Payload JSON"
                                    value={payloadText}
                                    onChange={(event) => setPayloadText(event.target.value)}
                                />
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h6 className="mb-0">Assets</h6>
                                    <Button
                                        size="sm"
                                        type="button"
                                        variant="twoTone"
                                        onClick={() =>
                                            setEntryForm((current) => ({
                                                ...current,
                                                assets: [...current.assets, emptyAsset(current.assets.length)],
                                            }))
                                        }
                                    >
                                        Agregar asset
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {entryForm.assets.map((asset, index) => (
                                        <div key={`${asset.id ?? 'new'}-${index}`} className="rounded-lg border border-gray-200 p-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <select
                                                    className="input"
                                                    value={asset.mediaType}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? {
                                                                          ...item,
                                                                          mediaType: event.target
                                                                              .value as CmsAsset['mediaType'],
                                                                      }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                >
                                                    <option value="IMAGE">IMAGE</option>
                                                    <option value="VIDEO">VIDEO</option>
                                                    <option value="EMBED">EMBED</option>
                                                </select>
                                                <Input
                                                    placeholder="Media URL"
                                                    value={asset.mediaUrl}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? { ...item, mediaUrl: event.target.value }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    placeholder="Título del asset"
                                                    value={asset.title ?? ''}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? { ...item, title: event.target.value }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    placeholder="Poster URL"
                                                    value={asset.posterUrl ?? ''}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? { ...item, posterUrl: event.target.value }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    placeholder="External URL"
                                                    value={asset.externalUrl ?? ''}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? { ...item, externalUrl: event.target.value }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="Duración (seg)"
                                                    value={String(asset.durationSec ?? '')}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? {
                                                                          ...item,
                                                                          durationSec: event.target.value
                                                                              ? Number(event.target.value)
                                                                              : null,
                                                                      }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <Textarea
                                                    rows={2}
                                                    placeholder="Caption"
                                                    value={asset.caption ?? ''}
                                                    onChange={(event) =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.map((item, itemIndex) =>
                                                                itemIndex === index
                                                                    ? { ...item, caption: event.target.value }
                                                                    : item,
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                                                    <span className="text-sm font-medium">Activo</span>
                                                    <Switcher
                                                        checked={asset.isActive}
                                                        onChange={(checked) =>
                                                            setEntryForm((current) => ({
                                                                ...current,
                                                                assets: current.assets.map((item, itemIndex) =>
                                                                    itemIndex === index
                                                                        ? { ...item, isActive: checked }
                                                                        : item,
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-3 flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="plain"
                                                    className="text-red-600"
                                                    onClick={() =>
                                                        setEntryForm((current) => ({
                                                            ...current,
                                                            assets: current.assets.filter((_, itemIndex) => itemIndex !== index),
                                                        }))
                                                    }
                                                >
                                                    Eliminar asset
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <Button type="button" variant="solid" onClick={handleSaveEntry} disabled={!selectedSectionId}>
                                    Guardar entrada
                                </Button>
                                <Button type="button" variant="plain" onClick={resetEntryForm}>
                                    Limpiar
                                </Button>
                            </div>
                        </AdaptableCard>
                    </div>
                </div>
            </AdaptableCard>
        </div>
    )
}

export default ContentManager
