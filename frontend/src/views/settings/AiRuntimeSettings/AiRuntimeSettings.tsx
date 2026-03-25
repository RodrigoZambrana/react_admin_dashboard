import { useCallback, useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import type { AxiosResponse } from 'axios'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Switcher from '@/components/ui/Switcher'
import Alert from '@/components/ui/Alert'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Loading from '@/components/shared/Loading'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import {
    apiGetAiRuntimeConfig,
    apiUpdateAiRuntimeConfig,
    type AiRuntimeConfigResponse,
    type UpdateAiRuntimeConfigPayload,
} from '@/services/AiRuntimeService'
import AiKnowledgeService, {
    type CreateCuratedKnowledgePayload,
    type AiKnowledgeCandidate,
    type AiKnowledgeDocument,
    type AiKnowledgeOverview,
} from '@/services/AiKnowledgeService'

type FormValues = {
    enabled: boolean
    provider: 'mock' | 'openai' | 'ollama'
    model: string
    openAiApiKey: string
    monthlySpendingLimitUsd: string
    currentUsageUsd: string
    warningThresholdPercent: string
    usageMessage: string
}

type CuratedKnowledgeForm = {
    scope: 'customer_public' | 'admin_internal'
    title: string
    summary: string
    content: string
    tags: string
}

const initialFormState: FormValues = {
    enabled: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    openAiApiKey: '',
    monthlySpendingLimitUsd: '25',
    currentUsageUsd: '0',
    warningThresholdPercent: '80',
    usageMessage: '',
}

const initialCuratedKnowledgeForm: CuratedKnowledgeForm = {
    scope: 'admin_internal',
    title: '',
    summary: '',
    content: '',
    tags: '',
}

const formatDateTime = (value: string | null) => {
    if (!value) return null
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const toFormValues = (data: AiRuntimeConfigResponse): FormValues => ({
    enabled: data.enabled,
    provider: data.provider,
    model: data.model || 'gpt-4o-mini',
    openAiApiKey: '',
    monthlySpendingLimitUsd:
        data.monthlySpendingLimitUsd !== null &&
        data.monthlySpendingLimitUsd !== undefined
            ? String(data.monthlySpendingLimitUsd)
            : '',
    currentUsageUsd:
        data.currentUsageUsd !== null && data.currentUsageUsd !== undefined
            ? String(data.currentUsageUsd)
            : '',
    warningThresholdPercent: String(data.warningThresholdPercent ?? 80),
    usageMessage: data.usageMessage ?? '',
})

const AiRuntimeSettings = () => {
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<AiRuntimeConfigResponse | null>(null)
    const [initialValues, setInitialValues] =
        useState<FormValues>(initialFormState)
    const [knowledgeOverview, setKnowledgeOverview] =
        useState<AiKnowledgeOverview | null>(null)
    const [knowledgeDocuments, setKnowledgeDocuments] = useState<
        AiKnowledgeDocument[]
    >([])
    const [knowledgeCandidates, setKnowledgeCandidates] = useState<
        AiKnowledgeCandidate[]
    >([])
    const [knowledgeLoading, setKnowledgeLoading] = useState(false)
    const [knowledgeAction, setKnowledgeAction] = useState<string | null>(null)
    const [curatedForm, setCuratedForm] = useState<CuratedKnowledgeForm>(
        initialCuratedKnowledgeForm,
    )

    const loadConfig = useCallback(async () => {
        setLoading(true)
        try {
            const response: AxiosResponse<AiRuntimeConfigResponse> =
                await apiGetAiRuntimeConfig()
            setConfig(response.data)
            setInitialValues(toFormValues(response.data))
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar la configuración AI" type="danger">
                    Verifica permisos y disponibilidad del backend.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadConfig()
    }, [loadConfig])

    const loadKnowledge = useCallback(async () => {
        setKnowledgeLoading(true)
        try {
            const [overviewResponse, documentsResponse, candidatesResponse] =
                await Promise.all([
                    AiKnowledgeService.getOverview(),
                    AiKnowledgeService.listDocuments(),
                    AiKnowledgeService.listCandidates(),
                ])

            setKnowledgeOverview(overviewResponse.data)
            setKnowledgeDocuments(documentsResponse.data.slice(0, 6))
            setKnowledgeCandidates(candidatesResponse.data.slice(0, 6))
        } catch (error) {
            console.error(error)
        } finally {
            setKnowledgeLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadKnowledge()
    }, [loadKnowledge])

    const updatedLabel = useMemo(
        () => formatDateTime(config?.updatedAt ?? null),
        [config?.updatedAt],
    )

    const totalDocuments =
        knowledgeOverview?.documents.reduce((sum, item) => sum + item.count, 0) ?? 0
    const totalPendingCandidates =
        knowledgeOverview?.candidates
            .filter((item) => item.status === 'pending')
            .reduce((sum, item) => sum + item.count, 0) ?? 0
    const indexedDocumentsCount = knowledgeDocuments.filter(
        (document) => document.embedding != null,
    ).length

    const createCuratedKnowledge = useCallback(async () => {
        const title = curatedForm.title.trim()
        const content = curatedForm.content.trim()

        if (!title || !content) {
            toast.push(
                <Notification title="Faltan datos de conocimiento" type="warning">
                    El título y el contenido son obligatorios.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setKnowledgeAction('curated')
        try {
            const payload: CreateCuratedKnowledgePayload = {
                scope: curatedForm.scope,
                title,
                summary: curatedForm.summary.trim() || undefined,
                content,
                tags: curatedForm.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                metadata: {
                    source: 'admin-settings-ui',
                },
            }

            await AiKnowledgeService.createCurated(payload)
            setCuratedForm(initialCuratedKnowledgeForm)
            await loadKnowledge()
            toast.push(
                <Notification title="Conocimiento curado guardado" type="success">
                    La entrada quedó disponible para el runtime de IA.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible guardar conocimiento curado" type="danger">
                    Revisa el contenido y vuelve a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setKnowledgeAction(null)
        }
    }, [curatedForm, loadKnowledge])

    const reviewCandidate = useCallback(
        async (candidate: AiKnowledgeCandidate, action: 'approve' | 'reject') => {
            setKnowledgeAction(`${action}:${candidate.id}`)
            try {
                await AiKnowledgeService.reviewCandidate(candidate.id, {
                    action,
                    promoteToDocument: action === 'approve',
                    scope: candidate.scope as 'customer_public' | 'admin_internal',
                    title: candidate.title,
                    summary: candidate.summary ?? undefined,
                    content: candidate.redactedExcerpt || candidate.excerpt,
                })
                await loadKnowledge()
                toast.push(
                    <Notification
                        title={
                            action === 'approve'
                                ? 'Candidato aprobado'
                                : 'Candidato rechazado'
                        }
                        type="success"
                    >
                        La cola de conocimiento quedó actualizada.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } catch (error) {
                console.error(error)
                toast.push(
                    <Notification title="No fue posible revisar el candidato" type="danger">
                        Reintenta la acción o revisa permisos del backend.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setKnowledgeAction(null)
            }
        },
        [loadKnowledge],
    )

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="mx-auto max-w-4xl" data-testid="ai-runtime-settings-page">
            <Card>
                <div className="mb-6 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge
                            className={
                                config?.enabled
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-gray-100 text-gray-600'
                            }
                        >
                            {config?.enabled ? 'AI habilitada' : 'AI deshabilitada'}
                        </Badge>
                        <span className="text-sm text-gray-500 capitalize">
                            Fuente: {config?.source ?? 'environment'}
                        </span>
                        {config?.hasOpenAiApiKey ? (
                            <Badge className="bg-sky-50 text-sky-700">
                                API key configurada
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-50 text-amber-700">
                                API key pendiente
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-gray-600">
                        Esta configuración controla el runtime del agente, el proveedor del
                        modelo y los límites operativos. El servicio consulta estos valores
                        de forma periódica, por lo que no requiere reinicio manual para el uso
                        normal.
                    </p>
                    {updatedLabel ? (
                        <span className="text-xs text-gray-500">
                            Última actualización {updatedLabel}
                        </span>
                    ) : null}
                </div>

                {config?.usage ? (
                    <Alert
                        showIcon
                        type={
                            config.usage.exceeded
                                ? 'danger'
                                : config.usage.nearLimit
                                  ? 'warning'
                                  : 'success'
                        }
                        className="mb-6"
                        data-testid="ai-runtime-usage-alert"
                    >
                        <div className="font-medium">{config.usage.message}</div>
                        <div className="mt-1 text-sm">
                            Uso actual:{' '}
                            {config.currentUsageUsd !== null
                                ? `USD ${config.currentUsageUsd.toFixed(2)}`
                                : 'sin dato'}
                            {' · '}
                            Límite:{' '}
                            {config.monthlySpendingLimitUsd !== null
                                ? `USD ${config.monthlySpendingLimitUsd.toFixed(2)}`
                                : 'sin límite'}
                            {' · '}
                            Umbral:{' '}
                            {config.warningThresholdPercent}%
                        </div>
                    </Alert>
                ) : null}

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting, setValues }) => {
                        setSubmitting(true)
                        try {
                            const payload: UpdateAiRuntimeConfigPayload = {
                                enabled: values.enabled,
                                provider: values.provider,
                                model: values.model.trim() || 'gpt-4o-mini',
                                openAiApiKey: values.openAiApiKey.trim() || undefined,
                                monthlySpendingLimitUsd: values.monthlySpendingLimitUsd
                                    ? Number(values.monthlySpendingLimitUsd)
                                    : null,
                                currentUsageUsd: values.currentUsageUsd
                                    ? Number(values.currentUsageUsd)
                                    : null,
                                warningThresholdPercent: Number(values.warningThresholdPercent || 80),
                                usageMessage: values.usageMessage.trim() || null,
                            }

                            const response: AxiosResponse<AiRuntimeConfigResponse> =
                                await apiUpdateAiRuntimeConfig(payload)
                            setConfig(response.data)
                            const nextValues = toFormValues(response.data)
                            nextValues.openAiApiKey = ''
                            setValues(nextValues)
                            toast.push(
                                <Notification title="Configuración AI guardada" type="success">
                                    El runtime del agente quedó actualizado.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } catch (error) {
                            console.error(error)
                            toast.push(
                                <Notification title="No fue posible guardar la configuración AI" type="danger">
                                    Revisa los campos y vuelve a intentar.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ values, isSubmitting, dirty, handleReset, setFieldValue }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label="Habilitar AI"
                                    extra="Permite pausar la asistencia sin perder la configuración."
                                >
                                    <div className="flex items-center gap-4">
                                        <Switcher
                                            checked={values.enabled}
                                            onChange={(checked) =>
                                                setFieldValue('enabled', checked)
                                            }
                                            data-testid="ai-runtime-enabled"
                                        />
                                        <span className="text-sm text-gray-600">
                                            {values.enabled
                                                ? 'El asistente puede responder y ejecutar tools.'
                                                : 'El asistente queda en pausa y debe intervenir un operador.'}
                                        </span>
                                    </div>
                                </FormItem>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem label="Proveedor">
                                        <Field
                                            as="select"
                                            name="provider"
                                            className="input"
                                            data-testid="ai-runtime-provider"
                                        >
                                            <option value="openai">OpenAI</option>
                                            <option value="mock">Mock</option>
                                            <option value="ollama">Ollama</option>
                                        </Field>
                                    </FormItem>
                                    <FormItem label="Modelo">
                                        <Field
                                            as={Input}
                                            name="model"
                                            placeholder="gpt-4o-mini"
                                            data-testid="ai-runtime-model"
                                        />
                                    </FormItem>
                                </div>

                                <FormItem
                                    label="OpenAI API key"
                                    extra="Deja vacío para conservar la clave ya almacenada."
                                >
                                    <Field
                                        as={Input}
                                        type="password"
                                        name="openAiApiKey"
                                        placeholder={
                                            config?.hasOpenAiApiKey
                                                ? 'Clave ya configurada'
                                                : 'Ingresa una API key'
                                        }
                                        data-testid="ai-runtime-openai-key"
                                    />
                                </FormItem>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <FormItem label="Límite mensual (USD)">
                                        <Field
                                            as={Input}
                                            name="monthlySpendingLimitUsd"
                                            placeholder="25"
                                            data-testid="ai-runtime-limit"
                                        />
                                    </FormItem>
                                    <FormItem label="Uso actual (USD)">
                                        <Field
                                            as={Input}
                                            name="currentUsageUsd"
                                            placeholder="0"
                                            data-testid="ai-runtime-usage"
                                        />
                                    </FormItem>
                                    <FormItem label="Umbral de advertencia (%)">
                                        <Field
                                            as={Input}
                                            name="warningThresholdPercent"
                                            placeholder="80"
                                            data-testid="ai-runtime-threshold"
                                        />
                                    </FormItem>
                                </div>

                                <FormItem
                                    label="Mensaje operativo"
                                    extra="Se usa para advertencias y para informar indisponibilidad o uso restringido."
                                >
                                    <Field
                                        as="textarea"
                                        name="usageMessage"
                                        rows={4}
                                        className="input min-h-[120px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                        placeholder="Monitor usage closely before enabling high-volume channels."
                                        data-testid="ai-runtime-message"
                                    />
                                </FormItem>

                                <Alert showIcon type="info">
                                    El límite no bloquea llamadas por sí mismo; funciona como control
                                    operativo y warning temprano. Mantén un valor actualizado para que
                                    el equipo vea cuándo se acerca al consumo máximo aceptable.
                                </Alert>

                                <div className="mt-6 flex items-center justify-end gap-3">
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            handleReset()
                                        }}
                                        disabled={isSubmitting || !dirty}
                                    >
                                        Revertir
                                    </Button>
                                    <Button
                                        variant="solid"
                                        type="submit"
                                        loading={isSubmitting}
                                        disabled={isSubmitting}
                                        data-testid="ai-runtime-save"
                                    >
                                        Guardar configuración
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>

                <div className="mt-10 border-t border-gray-200 pt-8">
                    <div className="mb-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-base font-semibold text-gray-900">
                                    Base de conocimiento
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Ingesta inicial desde documentación, datasets
                                    internos y candidatos derivados de conversaciones.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="default"
                                loading={knowledgeLoading}
                                onClick={() => void loadKnowledge()}
                                data-testid="ai-knowledge-refresh"
                            >
                                Refrescar
                            </Button>
                        </div>
                        <Alert showIcon type="info">
                            Los documentos curados son la fuente más confiable.
                            Los candidatos desde conversaciones requieren revisión
                            antes de promoción y deben tratarse con control de PII.
                        </Alert>
                    </div>

                    <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card bodyClass="p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Documentos
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {totalDocuments}
                            </div>
                        </Card>
                        <Card bodyClass="p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Candidatos pendientes
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {totalPendingCandidates}
                            </div>
                        </Card>
                        <Card bodyClass="p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Fuente docs
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {knowledgeOverview?.documents
                                    .filter((item) => item.sourceType === 'docs')
                                    .reduce((sum, item) => sum + item.count, 0) ??
                                    0}
                            </div>
                        </Card>
                        <Card bodyClass="p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Datasets internos
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {knowledgeOverview?.documents
                                    .filter(
                                        (item) =>
                                            item.sourceType ===
                                            'backend_dataset',
                                    )
                                    .reduce((sum, item) => sum + item.count, 0) ??
                                    0}
                            </div>
                        </Card>
                    </div>

                    <div className="mb-6 flex flex-wrap gap-3">
                        <Button
                            variant="solid"
                            loading={knowledgeAction === 'docs'}
                            onClick={async () => {
                                setKnowledgeAction('docs')
                                try {
                                    await AiKnowledgeService.ingestDocs()
                                    await loadKnowledge()
                                    toast.push(
                                        <Notification
                                            title="Documentación ingerida"
                                            type="success"
                                        >
                                            La base documental de la IA quedó
                                            actualizada.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                } catch (error) {
                                    console.error(error)
                                } finally {
                                    setKnowledgeAction(null)
                                }
                            }}
                            data-testid="ai-knowledge-ingest-docs"
                        >
                            Ingerir docs
                        </Button>
                        <Button
                            variant="twoTone"
                            loading={knowledgeAction === 'datasets'}
                            onClick={async () => {
                                setKnowledgeAction('datasets')
                                try {
                                    await AiKnowledgeService.ingestDatasets()
                                    await loadKnowledge()
                                    toast.push(
                                        <Notification
                                            title="Datasets ingeridos"
                                            type="success"
                                        >
                                            Productos y clientes quedaron
                                            proyectados a conocimiento curado.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                } catch (error) {
                                    console.error(error)
                                } finally {
                                    setKnowledgeAction(null)
                                }
                            }}
                            data-testid="ai-knowledge-ingest-datasets"
                        >
                            Ingerir datasets
                        </Button>
                        <Button
                            variant="default"
                            loading={knowledgeAction === 'index'}
                            onClick={async () => {
                                setKnowledgeAction('index')
                                try {
                                    const result =
                                        await AiKnowledgeService.indexDocuments()
                                    await loadKnowledge()
                                    toast.push(
                                        <Notification
                                            title="Retrieval reindexado"
                                            type="success"
                                        >
                                            Se actualizaron {result.data.indexed}{' '}
                                            documentos aprobados para búsqueda
                                            semántica.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                } catch (error) {
                                    console.error(error)
                                    toast.push(
                                        <Notification
                                            title="No fue posible reindexar"
                                            type="danger"
                                        >
                                            Revisa disponibilidad del backend e
                                            intenta nuevamente.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                } finally {
                                    setKnowledgeAction(null)
                                }
                            }}
                            data-testid="ai-knowledge-index"
                        >
                            Reindexar retrieval
                        </Button>
                    </div>

                    <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <Card bodyClass="p-4">
                            <div className="mb-3">
                                <h5 className="font-semibold text-gray-900">
                                    Entrada curada manual
                                </h5>
                                <p className="mt-1 text-sm text-gray-600">
                                    Úsala para reglas de negocio, instructivos internos o
                                    respuestas comerciales validadas.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormItem label="Scope">
                                    <select
                                        className="input"
                                        value={curatedForm.scope}
                                        onChange={(event) =>
                                            setCuratedForm((current) => ({
                                                ...current,
                                                scope: event.target.value as CuratedKnowledgeForm['scope'],
                                            }))
                                        }
                                        data-testid="ai-knowledge-curated-scope"
                                    >
                                        <option value="admin_internal">Admin interno</option>
                                        <option value="customer_public">Cliente público</option>
                                    </select>
                                </FormItem>
                                <FormItem label="Etiquetas">
                                    <Input
                                        value={curatedForm.tags}
                                        onChange={(event) =>
                                            setCuratedForm((current) => ({
                                                ...current,
                                                tags: event.target.value,
                                            }))
                                        }
                                        placeholder="regla, cotización, operación"
                                        data-testid="ai-knowledge-curated-tags"
                                    />
                                </FormItem>
                            </div>

                            <FormItem label="Título">
                                <Input
                                    value={curatedForm.title}
                                    onChange={(event) =>
                                        setCuratedForm((current) => ({
                                            ...current,
                                            title: event.target.value,
                                        }))
                                    }
                                    data-testid="ai-knowledge-curated-title"
                                />
                            </FormItem>
                            <FormItem label="Resumen">
                                <Input
                                    value={curatedForm.summary}
                                    onChange={(event) =>
                                        setCuratedForm((current) => ({
                                            ...current,
                                            summary: event.target.value,
                                        }))
                                    }
                                    data-testid="ai-knowledge-curated-summary"
                                />
                            </FormItem>
                            <FormItem label="Contenido">
                                <textarea
                                    className="input min-h-[180px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                    value={curatedForm.content}
                                    onChange={(event) =>
                                        setCuratedForm((current) => ({
                                            ...current,
                                            content: event.target.value,
                                        }))
                                    }
                                    data-testid="ai-knowledge-curated-content"
                                />
                            </FormItem>

                            <div className="flex justify-end">
                                <Button
                                    variant="solid"
                                    loading={knowledgeAction === 'curated'}
                                    onClick={() => void createCuratedKnowledge()}
                                    data-testid="ai-knowledge-curated-save"
                                >
                                    Guardar conocimiento curado
                                </Button>
                            </div>
                        </Card>

                        <Card bodyClass="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h5 className="font-semibold text-gray-900">
                                    Documentos recientes
                                </h5>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-emerald-50 text-emerald-700">
                                        {indexedDocumentsCount} indexados
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-700">
                                        {knowledgeDocuments.length}
                                    </Badge>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {knowledgeDocuments.map((document) => (
                                    <div
                                        key={document.id}
                                        className="rounded-2xl border border-gray-200 p-3"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {document.title}
                                            </span>
                                            <Badge className="bg-sky-50 text-sky-700">
                                                {document.sourceType}
                                            </Badge>
                                            <Badge className="bg-slate-100 text-slate-700">
                                                {document.scope}
                                            </Badge>
                                            {document.embedding ? (
                                                <Badge className="bg-emerald-50 text-emerald-700">
                                                    {document.embedding.model}
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-50 text-amber-700">
                                                    Sin índice
                                                </Badge>
                                            )}
                                        </div>
                                        {document.summary ? (
                                            <div className="mt-2 text-sm text-gray-600">
                                                {document.summary}
                                            </div>
                                        ) : null}
                                        {document.embedding ? (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Vectorizado con{' '}
                                                {document.embedding.provider} ·{' '}
                                                {document.embedding.dimensions}D ·{' '}
                                                {formatDateTime(
                                                    document.embedding.indexedAt,
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Card bodyClass="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h5 className="font-semibold text-gray-900">
                                    Candidatos recientes
                                </h5>
                                <Badge className="bg-amber-50 text-amber-700">
                                    {knowledgeCandidates.length}
                                </Badge>
                            </div>
                            <div className="space-y-3">
                                {knowledgeCandidates.map((candidate) => (
                                    <div
                                        key={candidate.id}
                                        className="rounded-2xl border border-gray-200 p-3"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {candidate.title}
                                            </span>
                                            <Badge
                                                className={
                                                    candidate.status === 'pending'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : candidate.status === 'approved'
                                                          ? 'bg-emerald-50 text-emerald-700'
                                                          : 'bg-red-50 text-red-700'
                                                }
                                            >
                                                {candidate.status}
                                            </Badge>
                                            {candidate.piiDetected ? (
                                                <Badge className="bg-red-50 text-red-700">
                                                    PII detectada
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600">
                                            {candidate.redactedExcerpt ||
                                                candidate.excerpt}
                                        </div>
                                        {candidate.conversation ? (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Conversación:{' '}
                                                {candidate.conversation.subject ||
                                                    candidate.conversation.id}{' '}
                                                · {candidate.conversation.channel}
                                            </div>
                                        ) : null}
                                        {candidate.status === 'pending' ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    loading={
                                                        knowledgeAction ===
                                                        `approve:${candidate.id}`
                                                    }
                                                    onClick={() =>
                                                        void reviewCandidate(
                                                            candidate,
                                                            'approve',
                                                        )
                                                    }
                                                    data-testid={`ai-knowledge-candidate-approve-${candidate.id}`}
                                                >
                                                    Aprobar y promover
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="twoTone"
                                                    loading={
                                                        knowledgeAction ===
                                                        `reject:${candidate.id}`
                                                    }
                                                    onClick={() =>
                                                        void reviewCandidate(
                                                            candidate,
                                                            'reject',
                                                        )
                                                    }
                                                    data-testid={`ai-knowledge-candidate-reject-${candidate.id}`}
                                                >
                                                    Rechazar
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default AiRuntimeSettings
