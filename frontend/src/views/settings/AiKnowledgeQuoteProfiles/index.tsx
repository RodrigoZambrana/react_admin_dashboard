import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import Switcher from '@/components/ui/Switcher'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeQuoteProfile,
    type AiKnowledgeQuoteProfileAttribute,
    type AiKnowledgeQuoteProfilesManageState,
    type UpsertKnowledgeQuoteProfilesManagePayload,
} from '@/services/AiKnowledgeService'

type QuoteScope = 'customer_public' | 'admin_internal'
type QuotePricingStrategy =
    | 'handoff_only'
    | 'immediate_unit_price'
    | 'immediate_square_meter'
    | 'parametric_exact_or_handoff'
type QuoteClosureMode = 'collect_then_handoff' | 'collect_then_price_or_handoff'
type QuoteAttributeCaptureKind = 'measurements' | 'quantity' | 'taxonomy_tag' | 'enum'

type QuoteProfileOptionForm = {
    value: string
    aliases: string
}

type QuoteProfileAttributeForm = {
    key: string
    label: string
    required: boolean
    captureKind: QuoteAttributeCaptureKind
    taxonomyTag: string
    subjectPrefix: string
    options: QuoteProfileOptionForm[]
}

type QuoteProfileForm = {
    key: string
    label: string
    appliesToTopicKeys: string
    appliesToTopicLabels: string
    familyLabel: string
    pricingStrategy: QuotePricingStrategy
    closureMode: QuoteClosureMode
    measurementCarrierTerms: string
    attributes: QuoteProfileAttributeForm[]
}

type QuoteProfilesEditorState = {
    documentId?: string
    tenantKey?: string
    scope: QuoteScope
    title: string
    summary: string
    tags: string
    profiles: QuoteProfileForm[]
}

type QuoteCatalogConsistency =
    AiKnowledgeQuoteProfilesManageState['catalogConsistency']

const formatDateTime = (value: string | null) => {
    if (!value) return 'Sin fecha'
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const splitCsv = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

const joinCsv = (items: string[] | null | undefined) => (items ?? []).join(', ')

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

const createEmptyOption = (): QuoteProfileOptionForm => ({
    value: '',
    aliases: '',
})

const createEmptyAttribute = (): QuoteProfileAttributeForm => ({
    key: '',
    label: '',
    required: true,
    captureKind: 'enum',
    taxonomyTag: '',
    subjectPrefix: '',
    options: [],
})

const createEmptyProfile = (): QuoteProfileForm => ({
    key: '',
    label: '',
    appliesToTopicKeys: '',
    appliesToTopicLabels: '',
    familyLabel: '',
    pricingStrategy: 'handoff_only',
    closureMode: 'collect_then_handoff',
    measurementCarrierTerms: 'ventana, ventanas, vano, vanos',
    attributes: [
        {
            key: 'measurements',
            label: 'las medidas aproximadas (ancho por alto)',
            required: true,
            captureKind: 'measurements',
            taxonomyTag: '',
            subjectPrefix: '',
            options: [],
        },
        {
            key: 'quantity',
            label: 'cuántas unidades necesitás',
            required: true,
            captureKind: 'quantity',
            taxonomyTag: '',
            subjectPrefix: '',
            options: [],
        },
    ],
})

const createInitialState = (): QuoteProfilesEditorState => ({
    documentId: undefined,
    tenantKey: undefined,
    scope: 'customer_public',
    title: '',
    summary: '',
    tags: 'tenant-quote-profiles, customer-quote',
    profiles: [],
})

const mapAttributeToForm = (
    attribute: AiKnowledgeQuoteProfileAttribute,
): QuoteProfileAttributeForm => ({
    key: attribute.key,
    label: attribute.label,
    required: attribute.required,
    captureKind: attribute.captureKind,
    taxonomyTag: attribute.taxonomyTag ?? '',
    subjectPrefix: attribute.subjectPrefix ?? '',
    options: (attribute.options ?? []).map((option) => ({
        value: option.value,
        aliases: joinCsv(option.aliases),
    })),
})

const mapProfileToForm = (profile: AiKnowledgeQuoteProfile): QuoteProfileForm => ({
    key: profile.key,
    label: profile.label,
    appliesToTopicKeys: joinCsv(profile.appliesToTopicKeys),
    appliesToTopicLabels: joinCsv(profile.appliesToTopicLabels),
    familyLabel: profile.familyLabel ?? '',
    pricingStrategy: profile.pricingStrategy,
    closureMode: profile.closureMode,
    measurementCarrierTerms: joinCsv(profile.measurementCarrierTerms),
    attributes: (profile.attributes ?? []).map(mapAttributeToForm),
})

const mapManageStateToForm = (
    payload: AiKnowledgeQuoteProfilesManageState,
): QuoteProfilesEditorState => ({
    documentId: payload.document?.id,
    tenantKey: payload.tenantKey,
    scope: payload.scope,
    title:
        payload.document?.title ||
        `Perfiles de cotización · ${payload.tenantKey || 'Tenant'}`,
    summary:
        payload.document?.summary ||
        'Perfiles curados para intake de presupuestos por tipo de producto y cierre operativo.',
    tags: joinCsv(payload.document?.tags ?? ['tenant-quote-profiles', 'customer-quote']),
    profiles: (payload.items ?? []).map(mapProfileToForm),
})

const buildPayload = (
    form: QuoteProfilesEditorState,
): UpsertKnowledgeQuoteProfilesManagePayload => ({
    documentId: form.documentId,
    tenantKey: form.tenantKey,
    scope: form.scope,
    title: form.title.trim() || undefined,
    summary: form.summary.trim() || undefined,
    tags: splitCsv(form.tags),
    profiles: form.profiles.map((profile) => ({
        key: profile.key.trim() || undefined,
        label: profile.label.trim(),
        appliesToTopicKeys: splitCsv(profile.appliesToTopicKeys),
        appliesToTopicLabels: splitCsv(profile.appliesToTopicLabels),
        familyLabel: profile.familyLabel.trim() || undefined,
        pricingStrategy: profile.pricingStrategy,
        closureMode: profile.closureMode,
        measurementCarrierTerms: splitCsv(profile.measurementCarrierTerms),
        attributes: profile.attributes.map((attribute) => ({
            key: attribute.key.trim() || undefined,
            label: attribute.label.trim(),
            required: attribute.required,
            captureKind: attribute.captureKind,
            taxonomyTag: attribute.taxonomyTag.trim() || undefined,
            subjectPrefix: attribute.subjectPrefix.trim() || undefined,
            options:
                attribute.captureKind === 'enum'
                    ? attribute.options
                          .filter((option) => option.value.trim())
                          .map((option) => ({
                              value: option.value.trim(),
                              aliases: splitCsv(option.aliases),
                          }))
                    : [],
        })),
    })),
})

const strategyMeta: Record<
    QuotePricingStrategy,
    { label: string; description: string; badgeClass: string }
> = {
    handoff_only: {
        label: 'handoff_only',
        description:
            'Toma el intake mínimo y cierra con derivación. No intenta cálculo automático.',
        badgeClass: 'bg-slate-100 text-slate-700',
    },
    immediate_unit_price: {
        label: 'immediate_unit_price',
        description:
            'Producto unitario con cálculo inmediato por cantidad cuando existe precio confiable.',
        badgeClass: 'bg-emerald-50 text-emerald-700',
    },
    immediate_square_meter: {
        label: 'immediate_square_meter',
        description:
            'Producto por m2 con cálculo automático a partir de ancho, alto y precio por m2.',
        badgeClass: 'bg-sky-50 text-sky-700',
    },
    parametric_exact_or_handoff: {
        label: 'parametric_exact_or_handoff',
        description:
            'Producto paramétrico: intenta cálculo si existe matriz exacta; si no, deriva.',
        badgeClass: 'bg-violet-50 text-violet-700',
    },
}

const closureMeta: Record<QuoteClosureMode, string> = {
    collect_then_handoff:
        'Completa intake mínimo y cierra en operador, aunque el producto quede bien identificado.',
    collect_then_price_or_handoff:
        'Completa intake mínimo y luego intenta precio; si no hay cálculo confiable, deriva.',
}

const captureKindLabels: Record<QuoteAttributeCaptureKind, string> = {
    measurements: 'measurements',
    quantity: 'quantity',
    taxonomy_tag: 'taxonomy_tag',
    enum: 'enum',
}

const AiKnowledgeQuoteProfilesPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<QuoteProfilesEditorState>(createInitialState)
    const [documentContent, setDocumentContent] = useState('')
    const [updatedAt, setUpdatedAt] = useState<string | null>(null)
    const [catalogConsistency, setCatalogConsistency] =
        useState<QuoteCatalogConsistency | null>(null)

    const loadProfiles = useCallback(async (scope: QuoteScope) => {
        setLoading(true)
        try {
            const response = await AiKnowledgeService.getQuoteProfilesManage({ scope })
            setForm(mapManageStateToForm(response.data))
            setDocumentContent(response.data.document?.content || '')
            setUpdatedAt(response.data.updatedAt ?? response.data.document?.updatedAt ?? null)
            setCatalogConsistency(response.data.catalogConsistency ?? null)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar los perfiles de cotización" type="danger">
                    Verifica disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadProfiles(form.scope)
    }, [form.scope, loadProfiles])

    const profileCountLabel = useMemo(() => {
        if (form.profiles.length === 0) return 'Sin perfiles'
        if (form.profiles.length === 1) return '1 perfil'
        return `${form.profiles.length} perfiles`
    }, [form.profiles.length])

    const setDocumentField = useCallback(
        (key: keyof QuoteProfilesEditorState, value: string | QuoteScope | QuoteProfileForm[]) => {
            setForm((current) => ({
                ...current,
                [key]: value,
            }))
        },
        [],
    )

    const updateProfile = useCallback(
        (profileIndex: number, updater: (profile: QuoteProfileForm) => QuoteProfileForm) => {
            setForm((current) => ({
                ...current,
                profiles: current.profiles.map((profile, index) =>
                    index === profileIndex ? updater(profile) : profile,
                ),
            }))
        },
        [],
    )

    const updateAttribute = useCallback(
        (
            profileIndex: number,
            attributeIndex: number,
            updater: (attribute: QuoteProfileAttributeForm) => QuoteProfileAttributeForm,
        ) => {
            updateProfile(profileIndex, (profile) => ({
                ...profile,
                attributes: profile.attributes.map((attribute, index) =>
                    index === attributeIndex ? updater(attribute) : attribute,
                ),
            }))
        },
        [updateProfile],
    )

    const updateOption = useCallback(
        (
            profileIndex: number,
            attributeIndex: number,
            optionIndex: number,
            updater: (option: QuoteProfileOptionForm) => QuoteProfileOptionForm,
        ) => {
            updateAttribute(profileIndex, attributeIndex, (attribute) => ({
                ...attribute,
                options: attribute.options.map((option, index) =>
                    index === optionIndex ? updater(option) : option,
                ),
            }))
        },
        [updateAttribute],
    )

    const addProfile = useCallback(() => {
        setForm((current) => ({
            ...current,
            profiles: [...current.profiles, createEmptyProfile()],
        }))
    }, [])

    const removeProfile = useCallback((profileIndex: number) => {
        setForm((current) => ({
            ...current,
            profiles: current.profiles.filter((_, index) => index !== profileIndex),
        }))
    }, [])

    const addAttribute = useCallback(
        (profileIndex: number) => {
            updateProfile(profileIndex, (profile) => ({
                ...profile,
                attributes: [...profile.attributes, createEmptyAttribute()],
            }))
        },
        [updateProfile],
    )

    const removeAttribute = useCallback(
        (profileIndex: number, attributeIndex: number) => {
            updateProfile(profileIndex, (profile) => ({
                ...profile,
                attributes: profile.attributes.filter((_, index) => index !== attributeIndex),
            }))
        },
        [updateProfile],
    )

    const addOption = useCallback(
        (profileIndex: number, attributeIndex: number) => {
            updateAttribute(profileIndex, attributeIndex, (attribute) => ({
                ...attribute,
                options: [...attribute.options, createEmptyOption()],
            }))
        },
        [updateAttribute],
    )

    const removeOption = useCallback(
        (profileIndex: number, attributeIndex: number, optionIndex: number) => {
            updateAttribute(profileIndex, attributeIndex, (attribute) => ({
                ...attribute,
                options: attribute.options.filter((_, index) => index !== optionIndex),
            }))
        },
        [updateAttribute],
    )

    const saveProfiles = useCallback(async () => {
        const hasInvalidProfile = form.profiles.some(
            (profile) =>
                !profile.label.trim() ||
                profile.attributes.length === 0 ||
                profile.attributes.some((attribute) => !attribute.label.trim()),
        )

        if (!form.profiles.length || hasInvalidProfile) {
            toast.push(
                <Notification title="Revisá los perfiles antes de guardar" type="warning">
                    Cada perfil necesita un nombre y al menos un atributo válido.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setSaving(true)
        try {
            const response = await AiKnowledgeService.upsertQuoteProfilesManage(
                buildPayload(form),
            )
            setForm(mapManageStateToForm(response.data))
            setDocumentContent(response.data.document?.content || '')
            setUpdatedAt(response.data.updatedAt ?? response.data.document?.updatedAt ?? null)
            setCatalogConsistency(response.data.catalogConsistency ?? null)
            toast.push(
                <Notification title="Perfiles de cotización actualizados" type="success">
                    El documento curado quedó sincronizado con la configuración visible en admin.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible guardar los perfiles" type="danger">
                    Verifica los datos cargados e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [form])

    const syncProfiles = useCallback(async () => {
        setSaving(true)
        try {
            const response = await AiKnowledgeService.syncQuoteProfilesManage({
                tenantKey: form.tenantKey,
                scope: form.scope,
            })
            setForm(mapManageStateToForm(response.data))
            setDocumentContent(response.data.document?.content || '')
            setUpdatedAt(response.data.updatedAt ?? response.data.document?.updatedAt ?? null)
            setCatalogConsistency(response.data.catalogConsistency ?? null)
            toast.push(
                <Notification title="Curación sincronizada" type="success">
                    Se regeneró el documento curado y se refrescaron los artefactos derivados.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible sincronizar la curación" type="danger">
                    Verifica que exista un documento gestionado y vuelve a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [form.scope, form.tenantKey])

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-quote-profiles-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Quote Profiles
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Superficie explícita para editar perfiles de cotización por tenant
                                y producto sin tocar JSON curado manual. El runtime solo aplica
                                lógica detallada si reconoce el producto y resuelve un perfil
                                válido; si no, toma datos mínimos y deriva.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge className="bg-sky-50 text-sky-700">{profileCountLabel}</Badge>
                                <Badge className="bg-slate-100 text-slate-700">
                                    scope: {form.scope}
                                </Badge>
                                <Badge className="bg-emerald-50 text-emerald-700">
                                    actualizado: {formatDateTime(updatedAt)}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="default"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/settings/ai`)}
                            >
                                Volver a IA
                            </Button>
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(`${APP_PREFIX_PATH}/settings/ai/knowledge/overview`)
                                }
                            >
                                Abrir overview
                            </Button>
                            <Button
                                variant="default"
                                onClick={() => void loadProfiles(form.scope)}
                            >
                                Refrescar
                            </Button>
                            <Button
                                variant="default"
                                loading={saving}
                                onClick={() => void syncProfiles()}
                            >
                                Sincronizar curación
                            </Button>
                            <Button variant="solid" loading={saving} onClick={() => void saveProfiles()}>
                                Guardar perfiles
                            </Button>
                        </div>
                    </div>
                </Card>

                <Alert showIcon type="info">
                    Sin perfil resuelto no se aplica pricing detallado. El flujo esperado es:
                    identificar producto, pedir datos mínimos del perfil y solo luego intentar
                    precio inmediato o derivación según la estrategia configurada.
                </Alert>

                {catalogConsistency ? (
                    <Card bodyClass="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h5 className="font-semibold text-gray-900">
                                    Consistencia con catálogo
                                </h5>
                                <p className="mt-1 text-sm text-gray-600">
                                    Vista rápida para detectar perfiles inmediatos sin productos
                                    publicados que los respalden. El chequeo usa señales por nombre,
                                    categoría y tags del catálogo actual.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-slate-100 text-slate-700">
                                    productos: {catalogConsistency.productCount}
                                </Badge>
                                <Badge className="bg-sky-50 text-sky-700">
                                    perfiles inmediatos: {catalogConsistency.immediateProfiles}
                                </Badge>
                                <Badge
                                    className={
                                        catalogConsistency.immediateProfilesNeedingReview > 0
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-emerald-50 text-emerald-700'
                                    }
                                >
                                    review: {catalogConsistency.immediateProfilesNeedingReview}
                                </Badge>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            {catalogConsistency.items.map((entry) => (
                                <div
                                    key={entry.profileKey}
                                    className="rounded-2xl border border-gray-200 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                {entry.label}
                                            </div>
                                            <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                                                {entry.pricingStrategy}
                                            </div>
                                        </div>
                                        <Badge
                                            className={
                                                entry.status === 'matched'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : entry.status === 'review'
                                                      ? 'bg-amber-50 text-amber-700'
                                                      : 'bg-slate-100 text-slate-700'
                                            }
                                        >
                                            {entry.status}
                                        </Badge>
                                    </div>

                                    <div className="mt-3 text-sm text-gray-600">
                                        Coincidencias de catálogo: {entry.catalogMatchCount}
                                    </div>
                                    {entry.matchedProducts.length ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {entry.matchedProducts.map((product) => (
                                                <Badge
                                                    key={`${entry.profileKey}-${product.id}`}
                                                    className="bg-slate-100 text-slate-700"
                                                >
                                                    {product.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </Card>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                    <div className="flex flex-col gap-6">
                        <Card bodyClass="p-5">
                            <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
                                <div>
                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Scope
                                    </div>
                                    <select
                                        className="input"
                                        value={form.scope}
                                        onChange={(event) =>
                                            setDocumentField(
                                                'scope',
                                                event.target.value as QuoteScope,
                                            )
                                        }
                                    >
                                        <option value="customer_public">Cliente público</option>
                                        <option value="admin_internal">Admin interno</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Etiquetas
                                    </div>
                                    <Input
                                        value={form.tags}
                                        onChange={(event) =>
                                            setDocumentField('tags', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Título del documento curado
                                    </div>
                                    <Input
                                        value={form.title}
                                        onChange={(event) =>
                                            setDocumentField('title', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Resumen
                                    </div>
                                    <textarea
                                        className="input min-h-[96px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                        value={form.summary}
                                        onChange={(event) =>
                                            setDocumentField('summary', event.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card bodyClass="p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h5 className="font-semibold text-gray-900">
                                        Perfiles configurados
                                    </h5>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Cada perfil define intake mínimo, estrategia de pricing y
                                        cierre operativo por producto o familia.
                                    </p>
                                </div>
                                <Button variant="solid" onClick={addProfile}>
                                    Agregar perfil
                                </Button>
                            </div>

                            <div className="mt-4 flex flex-col gap-5">
                                {form.profiles.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                                        Todavía no hay perfiles. Agregá el primero para empezar a
                                        modelar intake y pricing.
                                    </div>
                                ) : null}

                                {form.profiles.map((profile, profileIndex) => {
                                    const strategyInfo = strategyMeta[profile.pricingStrategy]

                                    return (
                                        <div
                                            key={`profile-${profileIndex}`}
                                            className="rounded-2xl border border-gray-200 p-4"
                                        >
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {profile.label.trim() || `Perfil ${profileIndex + 1}`}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                        <Badge className={strategyInfo.badgeClass}>
                                                            {strategyInfo.label}
                                                        </Badge>
                                                        <Badge className="bg-slate-100 text-slate-700">
                                                            {profile.closureMode}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="plain"
                                                    className="text-red-600"
                                                    onClick={() => removeProfile(profileIndex)}
                                                >
                                                    Eliminar perfil
                                                </Button>
                                            </div>

                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Nombre
                                                    </div>
                                                    <Input
                                                        value={profile.label}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                label: event.target.value,
                                                                key:
                                                                    current.key ||
                                                                    `quote_profile:${slugify(
                                                                        event.target.value,
                                                                    )}`,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Key
                                                    </div>
                                                    <Input
                                                        value={profile.key}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                key: event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Familia
                                                    </div>
                                                    <Input
                                                        value={profile.familyLabel}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                familyLabel: event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Estrategia de pricing
                                                    </div>
                                                    <select
                                                        className="input"
                                                        value={profile.pricingStrategy}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                pricingStrategy:
                                                                    event.target
                                                                        .value as QuotePricingStrategy,
                                                            }))
                                                        }
                                                    >
                                                        {Object.entries(strategyMeta).map(
                                                            ([value, meta]) => (
                                                                <option key={value} value={value}>
                                                                    {meta.label}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {strategyInfo.description}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Cierre operativo
                                                    </div>
                                                    <select
                                                        className="input"
                                                        value={profile.closureMode}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                closureMode:
                                                                    event.target
                                                                        .value as QuoteClosureMode,
                                                            }))
                                                        }
                                                    >
                                                        <option value="collect_then_handoff">
                                                            collect_then_handoff
                                                        </option>
                                                        <option value="collect_then_price_or_handoff">
                                                            collect_then_price_or_handoff
                                                        </option>
                                                    </select>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {closureMeta[profile.closureMode]}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Topic labels
                                                    </div>
                                                    <Input
                                                        value={profile.appliesToTopicLabels}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                appliesToTopicLabels:
                                                                    event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Topic keys
                                                    </div>
                                                    <Input
                                                        value={profile.appliesToTopicKeys}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                appliesToTopicKeys:
                                                                    event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Términos portadores de medida
                                                    </div>
                                                    <Input
                                                        value={profile.measurementCarrierTerms}
                                                        onChange={(event) =>
                                                            updateProfile(profileIndex, (current) => ({
                                                                ...current,
                                                                measurementCarrierTerms:
                                                                    event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h6 className="font-semibold text-gray-900">
                                                            Atributos del perfil
                                                        </h6>
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            RequiredAttributes + capturedAttributes
                                                            declarativos.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="default"
                                                        onClick={() => addAttribute(profileIndex)}
                                                    >
                                                        Agregar atributo
                                                    </Button>
                                                </div>

                                                <div className="mt-4 flex flex-col gap-4">
                                                    {profile.attributes.map((attribute, attributeIndex) => (
                                                        <div
                                                            key={`attribute-${profileIndex}-${attributeIndex}`}
                                                            className="rounded-2xl border border-gray-200 bg-white p-4"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="text-sm font-semibold text-gray-900">
                                                                    {attribute.label.trim() ||
                                                                        `Atributo ${attributeIndex + 1}`}
                                                                </div>
                                                                <Button
                                                                    variant="plain"
                                                                    className="text-red-600"
                                                                    onClick={() =>
                                                                        removeAttribute(
                                                                            profileIndex,
                                                                            attributeIndex,
                                                                        )
                                                                    }
                                                                >
                                                                    Eliminar atributo
                                                                </Button>
                                                            </div>

                                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                                <div>
                                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                        Label
                                                                    </div>
                                                                    <Input
                                                                        value={attribute.label}
                                                                        onChange={(event) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    label: event.target.value,
                                                                                    key:
                                                                                        current.key ||
                                                                                        slugify(
                                                                                            event.target.value,
                                                                                        ),
                                                                                }),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                        Key
                                                                    </div>
                                                                    <Input
                                                                        value={attribute.key}
                                                                        onChange={(event) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    key: event.target.value,
                                                                                }),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                        Capture kind
                                                                    </div>
                                                                    <select
                                                                        className="input"
                                                                        value={attribute.captureKind}
                                                                        onChange={(event) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    captureKind:
                                                                                        event.target
                                                                                            .value as QuoteAttributeCaptureKind,
                                                                                    options:
                                                                                        event.target
                                                                                            .value ===
                                                                                        'enum'
                                                                                            ? current.options
                                                                                            : [],
                                                                                }),
                                                                            )
                                                                        }
                                                                    >
                                                                        {Object.entries(
                                                                            captureKindLabels,
                                                                        ).map(([value, label]) => (
                                                                            <option key={value} value={value}>
                                                                                {label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-gray-900">
                                                                            Requerido
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            Si falta, el runtime sigue pidiendo
                                                                            este dato.
                                                                        </div>
                                                                    </div>
                                                                    <Switcher
                                                                        checked={attribute.required}
                                                                        onChange={(checked) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    required: checked,
                                                                                }),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                        Taxonomy tag
                                                                    </div>
                                                                    <Input
                                                                        value={attribute.taxonomyTag}
                                                                        onChange={(event) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    taxonomyTag:
                                                                                        event.target.value,
                                                                                }),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                        Subject prefix
                                                                    </div>
                                                                    <Input
                                                                        value={attribute.subjectPrefix}
                                                                        onChange={(event) =>
                                                                            updateAttribute(
                                                                                profileIndex,
                                                                                attributeIndex,
                                                                                (current) => ({
                                                                                    ...current,
                                                                                    subjectPrefix:
                                                                                        event.target.value,
                                                                                }),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>

                                                            {attribute.captureKind === 'enum' ? (
                                                                <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="text-sm font-semibold text-gray-900">
                                                                            Opciones del atributo
                                                                        </div>
                                                                        <Button
                                                                            variant="default"
                                                                            onClick={() =>
                                                                                addOption(
                                                                                    profileIndex,
                                                                                    attributeIndex,
                                                                                )
                                                                            }
                                                                        >
                                                                            Agregar opción
                                                                        </Button>
                                                                    </div>
                                                                    <div className="mt-3 flex flex-col gap-3">
                                                                        {attribute.options.length === 0 ? (
                                                                            <div className="text-xs text-gray-500">
                                                                                Sin opciones explícitas. El runtime
                                                                                solo capturará texto libre si la
                                                                                heurística lo permite.
                                                                            </div>
                                                                        ) : null}
                                                                        {attribute.options.map(
                                                                            (option, optionIndex) => (
                                                                                <div
                                                                                    key={`option-${profileIndex}-${attributeIndex}-${optionIndex}`}
                                                                                    className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"
                                                                                >
                                                                                    <Input
                                                                                        value={option.value}
                                                                                        placeholder="Valor"
                                                                                        onChange={(event) =>
                                                                                            updateOption(
                                                                                                profileIndex,
                                                                                                attributeIndex,
                                                                                                optionIndex,
                                                                                                (current) => ({
                                                                                                    ...current,
                                                                                                    value:
                                                                                                        event.target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                    <Input
                                                                                        value={option.aliases}
                                                                                        placeholder="Alias, sinónimos"
                                                                                        onChange={(event) =>
                                                                                            updateOption(
                                                                                                profileIndex,
                                                                                                attributeIndex,
                                                                                                optionIndex,
                                                                                                (current) => ({
                                                                                                    ...current,
                                                                                                    aliases:
                                                                                                        event.target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                    <Button
                                                                                        variant="plain"
                                                                                        className="text-red-600"
                                                                                        onClick={() =>
                                                                                            removeOption(
                                                                                                profileIndex,
                                                                                                attributeIndex,
                                                                                                optionIndex,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        Quitar
                                                                                    </Button>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-6">
                        <Card bodyClass="p-5">
                            <h5 className="font-semibold text-gray-900">
                                Comportamiento esperado
                            </h5>
                            <div className="mt-3 space-y-3 text-sm text-gray-600">
                                <p>
                                    Si no hay producto o perfil válido, la lógica detallada de
                                    cotización no corre.
                                </p>
                                <p>
                                    <strong>immediate_unit_price</strong>:
                                    {' '}
                                    producto unitario con precio inmediato por cantidad.
                                </p>
                                <p>
                                    <strong>immediate_square_meter</strong>:
                                    {' '}
                                    producto con cálculo inmediato por m2.
                                </p>
                                <p>
                                    <strong>parametric_exact_or_handoff</strong>:
                                    {' '}
                                    producto paramétrico. Si no hay matriz exacta, deriva.
                                </p>
                                <p>
                                    <strong>handoff_only</strong>:
                                    {' '}
                                    intake mínimo y cierre operativo a operador.
                                </p>
                            </div>
                        </Card>

                        <Card bodyClass="p-5">
                            <h5 className="font-semibold text-gray-900">
                                Documento curado generado
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Este contenido se regenera desde la UI. No hace falta editar JSON
                                manual.
                            </p>
                            <pre className="mt-4 max-h-[720px] overflow-auto whitespace-pre-wrap rounded-2xl bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                                {documentContent || 'Sin contenido generado todavía.'}
                            </pre>
                        </Card>
                    </div>
                </div>
            </div>
        </Loading>
    )
}

export default AiKnowledgeQuoteProfilesPage
