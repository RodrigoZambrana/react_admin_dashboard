import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Formik, Form, Field } from 'formik'
import type { AxiosResponse } from 'axios'
import { useNavigate } from 'react-router-dom'
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
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import {
    apiGetAiActionsCatalog,
    apiGetAiRuntimeConfig,
    apiUpdateAiRuntimeConfig,
    type AiActionCatalogEntry,
    type AiRuntimeConfigResponse,
    type UpdateAiRuntimeConfigPayload,
} from '@/services/AiRuntimeService'

type FormValues = {
    enabled: boolean
    provider: 'mock' | 'openai' | 'ollama'
    model: string
    openAiApiKey: string
    monthlySpendingLimitUsd: string
    currentUsageUsd: string
    warningThresholdPercent: string
    usageMessage: string
    adminInternalPrompt: string
    customerPublicPrompt: string
    customerGreetingDefault: string
    customerGreetingMorning: string
    customerGreetingAfternoon: string
    customerGreetingConsultation: string
    customerGreetingHelp: string
    adminGreetingDefault: string
    customerGroundedRewriteEnabled: boolean
    customerGroundedRewriteMaxChars: string
    customerCapabilityProfile:
        | 'full_assistant'
        | 'ecommerce_content'
        | 'scheduling_content'
        | 'content_only'
        | 'custom'
    customerContentMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerCommerceMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerSchedulingMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerWordingOverridesJson: string
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
    adminInternalPrompt: '',
    customerPublicPrompt: '',
    customerGreetingDefault: '',
    customerGreetingMorning: '',
    customerGreetingAfternoon: '',
    customerGreetingConsultation: '',
    customerGreetingHelp: '',
    adminGreetingDefault: '',
    customerGroundedRewriteEnabled: false,
    customerGroundedRewriteMaxChars: '220',
    customerCapabilityProfile: 'full_assistant',
    customerContentMode: 'enabled',
    customerCommerceMode: 'enabled',
    customerSchedulingMode: 'enabled',
    customerWordingOverridesJson: '',
}

const capabilityProfilePresets: Record<
    FormValues['customerCapabilityProfile'],
    Pick<
        FormValues,
        'customerContentMode' | 'customerCommerceMode' | 'customerSchedulingMode'
    >
> = {
    full_assistant: {
        customerContentMode: 'enabled',
        customerCommerceMode: 'enabled',
        customerSchedulingMode: 'enabled',
    },
    ecommerce_content: {
        customerContentMode: 'enabled',
        customerCommerceMode: 'enabled',
        customerSchedulingMode: 'handoff_only',
    },
    scheduling_content: {
        customerContentMode: 'enabled',
        customerCommerceMode: 'handoff_only',
        customerSchedulingMode: 'enabled',
    },
    content_only: {
        customerContentMode: 'enabled',
        customerCommerceMode: 'handoff_only',
        customerSchedulingMode: 'handoff_only',
    },
    custom: {
        customerContentMode: 'enabled',
        customerCommerceMode: 'enabled',
        customerSchedulingMode: 'enabled',
    },
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
    adminInternalPrompt: data.adminInternalPrompt ?? '',
    customerPublicPrompt: data.customerPublicPrompt ?? '',
    customerGreetingDefault: data.customerGreetingDefault ?? '',
    customerGreetingMorning: data.customerGreetingMorning ?? '',
    customerGreetingAfternoon: data.customerGreetingAfternoon ?? '',
    customerGreetingConsultation: data.customerGreetingConsultation ?? '',
    customerGreetingHelp: data.customerGreetingHelp ?? '',
    adminGreetingDefault: data.adminGreetingDefault ?? '',
    customerGroundedRewriteEnabled: data.customerGroundedRewriteEnabled ?? false,
    customerGroundedRewriteMaxChars:
        data.customerGroundedRewriteMaxChars !== null &&
        data.customerGroundedRewriteMaxChars !== undefined
            ? String(data.customerGroundedRewriteMaxChars)
            : '220',
    customerCapabilityProfile: data.customerCapabilityProfile ?? 'full_assistant',
    customerContentMode: data.customerContentMode ?? 'enabled',
    customerCommerceMode: data.customerCommerceMode ?? 'enabled',
    customerSchedulingMode: data.customerSchedulingMode ?? 'enabled',
    customerWordingOverridesJson: data.customerWordingOverridesJson ?? '',
})

const AiRuntimeSettings = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<AiRuntimeConfigResponse | null>(null)
    const [initialValues, setInitialValues] =
        useState<FormValues>(initialFormState)
    const [aiActions, setAiActions] = useState<AiActionCatalogEntry[]>([])

    const loadConfig = useCallback(async () => {
        setLoading(true)
        try {
            const response: AxiosResponse<AiRuntimeConfigResponse> =
                await apiGetAiRuntimeConfig()
            setConfig(response.data)
            setInitialValues(toFormValues(response.data))
            const actionsResponse = await apiGetAiActionsCatalog()
            setAiActions(actionsResponse.data)
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

    const updatedLabel = useMemo(
        () => formatDateTime(config?.updatedAt ?? null),
        [config?.updatedAt],
    )

    const adminActions = aiActions.filter(
        (entry) => entry.scope === 'admin_internal',
    )
    const groupedAdminActions = useMemo(
        () =>
            adminActions.reduce<Record<string, AiActionCatalogEntry[]>>(
                (accumulator, entry) => {
                    const [group = 'general'] = entry.key.split('.')
                    accumulator[group] = [...(accumulator[group] ?? []), entry]
                    return accumulator
                },
                {},
            ),
        [adminActions],
    )

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6" data-testid="ai-runtime-settings-page">
            <Card bodyClass="p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-4xl">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            AI Runtime
                        </div>
                        <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                            Runtime técnico del agente
                        </h4>
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                            Esta pantalla queda reservada para proveedor, modelo, límites,
                            prompts y catálogo técnico de acciones. La gestión de knowledge
                            ya vive en superficies dedicadas del módulo IA.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Badge
                                className={
                                    config?.enabled
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-700'
                                }
                            >
                                {config?.enabled ? 'IA habilitada' : 'IA en pausa'}
                            </Badge>
                            <Badge className="bg-sky-50 text-sky-700">
                                {config?.provider || 'sin proveedor'}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-700">
                                Fuente: {config?.source ?? 'environment'}
                            </Badge>
                            {config?.hasOpenAiApiKey ? (
                                <Badge className="bg-violet-50 text-violet-700">
                                    API key configurada
                                </Badge>
                            ) : (
                                <Badge className="bg-amber-50 text-amber-700">
                                    API key pendiente
                                </Badge>
                            )}
                        </div>
                        {updatedLabel ? (
                            <div className="mt-3 text-xs text-gray-500">
                                Última actualización {updatedLabel}
                            </div>
                        ) : null}
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
                                navigate(
                                    `${APP_PREFIX_PATH}/settings/ai/knowledge/overview`,
                                )
                            }
                        >
                            Knowledge overview
                        </Button>
                        <Button
                            variant="default"
                            onClick={() =>
                                navigate(
                                    `${APP_PREFIX_PATH}/settings/ai/knowledge/ingestion-runs`,
                                )
                            }
                        >
                            Corridas de ingesta
                        </Button>
                        <Button variant="solid" onClick={() => void loadConfig()}>
                            Refrescar
                        </Button>
                    </div>
                </div>
            </Card>

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
                        Umbral: {config.warningThresholdPercent}%
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
                            warningThresholdPercent: Number(
                                values.warningThresholdPercent || 80,
                            ),
                            usageMessage: values.usageMessage.trim() || null,
                            adminInternalPrompt:
                                values.adminInternalPrompt.trim() || null,
                            customerPublicPrompt:
                                values.customerPublicPrompt.trim() || null,
                            customerGreetingDefault:
                                values.customerGreetingDefault.trim() || null,
                            customerGreetingMorning:
                                values.customerGreetingMorning.trim() || null,
                            customerGreetingAfternoon:
                                values.customerGreetingAfternoon.trim() || null,
                            customerGreetingConsultation:
                                values.customerGreetingConsultation.trim() || null,
                            customerGreetingHelp:
                                values.customerGreetingHelp.trim() || null,
                            adminGreetingDefault:
                                values.adminGreetingDefault.trim() || null,
                            customerGroundedRewriteEnabled:
                                values.customerGroundedRewriteEnabled,
                            customerGroundedRewriteMaxChars:
                                values.customerGroundedRewriteMaxChars
                                    ? Number(values.customerGroundedRewriteMaxChars)
                                    : null,
                            customerCapabilityProfile:
                                values.customerCapabilityProfile,
                            customerContentMode: values.customerContentMode,
                            customerCommerceMode: values.customerCommerceMode,
                            customerSchedulingMode:
                                values.customerSchedulingMode,
                            customerWordingOverridesJson:
                                values.customerWordingOverridesJson.trim() || null,
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
                        <Card bodyClass="p-6">
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
                                                ? 'El runtime puede responder y orquestar acciones.'
                                                : 'El runtime queda pausado y requiere intervención humana.'}
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

                                <Card bodyClass="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-4">
                                        <h5 className="font-semibold text-gray-900">
                                            Capability Profiles
                                        </h5>
                                        <p className="mt-1 text-sm text-gray-600">
                                            Separan contenido, ecommerce y agenda. El perfil marca
                                            el baseline reusable y los modos por capability
                                            funcionan como kill switches o modo degradado sin apagar
                                            todo el chatbot.
                                        </p>
                                    </div>
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <FormItem
                                            label="Perfil customer"
                                            extra="Usa perfiles predefinidos o pasa a custom para controlar cada capability por separado."
                                        >
                                            <select
                                                className="input"
                                                value={values.customerCapabilityProfile}
                                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                    const nextProfile =
                                                        event.target
                                                            .value as FormValues['customerCapabilityProfile']
                                                    setFieldValue(
                                                        'customerCapabilityProfile',
                                                        nextProfile,
                                                    )
                                                    if (nextProfile !== 'custom') {
                                                        const preset =
                                                            capabilityProfilePresets[nextProfile]
                                                        setFieldValue(
                                                            'customerContentMode',
                                                            preset.customerContentMode,
                                                        )
                                                        setFieldValue(
                                                            'customerCommerceMode',
                                                            preset.customerCommerceMode,
                                                        )
                                                        setFieldValue(
                                                            'customerSchedulingMode',
                                                            preset.customerSchedulingMode,
                                                        )
                                                    }
                                                }}
                                                data-testid="ai-runtime-capability-profile"
                                            >
                                                <option value="full_assistant">full_assistant</option>
                                                <option value="ecommerce_content">ecommerce_content</option>
                                                <option value="scheduling_content">scheduling_content</option>
                                                <option value="content_only">content_only</option>
                                                <option value="custom">custom</option>
                                            </select>
                                        </FormItem>
                                        <FormItem
                                            label="Grounded rewrite opcional"
                                            extra="Reescritura final más natural sobre respuestas ya grounded. Se recomienda apagarla si la capacidad queda en deterministic_only."
                                        >
                                            <div className="flex items-center gap-4">
                                                <Switcher
                                                    checked={values.customerGroundedRewriteEnabled}
                                                    onChange={(checked) =>
                                                        setFieldValue(
                                                            'customerGroundedRewriteEnabled',
                                                            checked,
                                                        )
                                                    }
                                                    data-testid="ai-runtime-grounded-rewrite-enabled"
                                                />
                                                <Field
                                                    as={Input}
                                                    name="customerGroundedRewriteMaxChars"
                                                    className="max-w-[160px]"
                                                    placeholder="220"
                                                    data-testid="ai-runtime-grounded-rewrite-max-chars"
                                                />
                                            </div>
                                        </FormItem>
                                    </div>

                                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                                        <FormItem
                                            label="Contenido / FAQ"
                                            extra="enabled responde desde knowledge; deterministic_only evita provider opcional; handoff_only deriva con fallback seguro."
                                        >
                                            <Field
                                                as="select"
                                                name="customerContentMode"
                                                className="input"
                                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                    setFieldValue(
                                                        'customerContentMode',
                                                        event.target.value,
                                                    )
                                                    setFieldValue(
                                                        'customerCapabilityProfile',
                                                        'custom',
                                                    )
                                                }}
                                                data-testid="ai-runtime-content-mode"
                                            >
                                                <option value="enabled">enabled</option>
                                                <option value="deterministic_only">deterministic_only</option>
                                                <option value="handoff_only">handoff_only</option>
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            label="Ecommerce / Cotización"
                                            extra="Controla preview inmediato, pricing y handoff en consultas comerciales."
                                        >
                                            <Field
                                                as="select"
                                                name="customerCommerceMode"
                                                className="input"
                                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                    setFieldValue(
                                                        'customerCommerceMode',
                                                        event.target.value,
                                                    )
                                                    setFieldValue(
                                                        'customerCapabilityProfile',
                                                        'custom',
                                                    )
                                                }}
                                                data-testid="ai-runtime-commerce-mode"
                                            >
                                                <option value="enabled">enabled</option>
                                                <option value="deterministic_only">deterministic_only</option>
                                                <option value="handoff_only">handoff_only</option>
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            label="Agenda / Turnos"
                                            extra="enabled agenda automáticamente; handoff_only releva datos y pasa a humano sin crear eventos."
                                        >
                                            <Field
                                                as="select"
                                                name="customerSchedulingMode"
                                                className="input"
                                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                    setFieldValue(
                                                        'customerSchedulingMode',
                                                        event.target.value,
                                                    )
                                                    setFieldValue(
                                                        'customerCapabilityProfile',
                                                        'custom',
                                                    )
                                                }}
                                                data-testid="ai-runtime-scheduling-mode"
                                            >
                                                <option value="enabled">enabled</option>
                                                <option value="deterministic_only">deterministic_only</option>
                                                <option value="handoff_only">handoff_only</option>
                                            </Field>
                                        </FormItem>
                                    </div>

                                    <FormItem
                                        label="Overrides de wording customer"
                                        extra={
                                            'JSON opcional por clave del wording registry. Acepta string o array de variantes. Ejemplo: {"customer.quote.handoff_ready":["Gracias por la información enviada..."],"customer.faq.product_general":"Sí, trabajamos con {topic}. Si querés, te cuento opciones."}'
                                        }
                                    >
                                        <Field
                                            as="textarea"
                                            name="customerWordingOverridesJson"
                                            rows={8}
                                            className="input min-h-[200px] w-full rounded-2xl border border-gray-200 px-4 py-3 font-mono text-sm"
                                            placeholder='{"customer.quote.handoff_ready":["Gracias por la información enviada. Le enviamos la cotización a la brevedad."]}'
                                            data-testid="ai-runtime-wording-overrides-json"
                                        />
                                    </FormItem>
                                </Card>

                                <div className="grid gap-4 xl:grid-cols-2">
                                    <FormItem
                                        label="Prompt adicional admin interno"
                                        extra="Instrucciones extra para el análisis y la respuesta dentro del chat interno."
                                    >
                                        <Field
                                            as="textarea"
                                            name="adminInternalPrompt"
                                            rows={6}
                                            className="input min-h-[160px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                            placeholder="Ejemplo: prioriza el informe operativo, no inventes métricas y deriva si falta grounding."
                                            data-testid="ai-runtime-admin-prompt"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label="Prompt adicional cliente público"
                                        extra="Instrucciones extra para respuestas customer-safe del chat público."
                                    >
                                        <Field
                                            as="textarea"
                                            name="customerPublicPrompt"
                                            rows={6}
                                            className="input min-h-[160px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                            placeholder="Ejemplo: responder solo con información comercial validada y ofrecer derivación humana si no hay contexto aprobado."
                                            data-testid="ai-runtime-customer-prompt"
                                        />
                                    </FormItem>
                                </div>

                                <Card bodyClass="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-4">
                                        <h5 className="font-semibold text-gray-900">
                                            Saludos configurables
                                        </h5>
                                        <p className="mt-1 text-sm text-gray-600">
                                            Estos textos se usan en respuestas livianas del runtime
                                            antes del modelo. Sirven para ajustar el tono base sin
                                            tocar código.
                                        </p>
                                    </div>
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <FormItem
                                            label="Cliente · saludo por defecto"
                                            extra="Se usa para mensajes como “hola”."
                                        >
                                            <Field
                                                as={Input}
                                                name="customerGreetingDefault"
                                                placeholder="Hola. ¿En qué podemos ayudarte hoy?"
                                                data-testid="ai-runtime-customer-greeting-default"
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Cliente · buenos días"
                                            extra="Se usa para mensajes que empiezan con “buenos días”."
                                        >
                                            <Field
                                                as={Input}
                                                name="customerGreetingMorning"
                                                placeholder="Buenos días. ¿En qué podemos ayudarte?"
                                                data-testid="ai-runtime-customer-greeting-morning"
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Cliente · buenas tardes"
                                            extra="Se usa para mensajes que empiezan con “buenas tardes”."
                                        >
                                            <Field
                                                as={Input}
                                                name="customerGreetingAfternoon"
                                                placeholder="Buenas tardes. ¿En qué podemos ayudarte hoy?"
                                                data-testid="ai-runtime-customer-greeting-afternoon"
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Cliente · consulta"
                                            extra="Se usa para saludos con intención de consulta explícita."
                                        >
                                            <Field
                                                as={Input}
                                                name="customerGreetingConsultation"
                                                placeholder="Hola. Claro, cuéntanos tu consulta."
                                                data-testid="ai-runtime-customer-greeting-consultation"
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Cliente · pedido de ayuda"
                                            extra="Se usa cuando el usuario ya dice que necesita ayuda."
                                        >
                                            <Field
                                                as={Input}
                                                name="customerGreetingHelp"
                                                placeholder="Hola. Claro, ¿con qué te ayudamos?"
                                                data-testid="ai-runtime-customer-greeting-help"
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Admin interno · saludo base"
                                            extra="Se usa en saludos livianos del asistente interno."
                                        >
                                            <Field
                                                as={Input}
                                                name="adminGreetingDefault"
                                                placeholder="Hola. ¿En qué te ayudo hoy?"
                                                data-testid="ai-runtime-admin-greeting-default"
                                            />
                                        </FormItem>
                                    </div>
                                </Card>

                                <Alert showIcon type="info">
                                    La observación de conversaciones, la ingesta documental y el
                                    reindex del corpus ya no se operan desde esta pantalla. Usa
                                    las superficies dedicadas de knowledge para esas tareas.
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
                        </Card>
                    </Form>
                )}
            </Formik>

            <Card bodyClass="p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h5 className="font-semibold text-gray-900">
                            Catálogo de acciones admin interno
                        </h5>
                        <p className="mt-1 text-sm text-gray-600">
                            Este catálogo refleja qué acciones reales puede ejecutar hoy el
                            agente interno, qué confirmación requieren y qué estados soportan.
                        </p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-700">
                        {adminActions.length} acciones
                    </Badge>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {Object.entries(groupedAdminActions).map(([group, entries]) => (
                        <Card key={group} bodyClass="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h5 className="font-semibold capitalize text-gray-900">
                                    {group}
                                </h5>
                                <Badge className="bg-sky-50 text-sky-700">
                                    {entries.length}
                                </Badge>
                            </div>
                            <div className="space-y-3">
                                {entries.map((entry) => (
                                    <div
                                        key={entry.key}
                                        className="rounded-2xl border border-gray-200 p-3"
                                        data-testid={`ai-action-${entry.key}`}
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-gray-900">
                                                {entry.label}
                                            </span>
                                            <Badge className="bg-slate-100 text-slate-700">
                                                {entry.method}
                                            </Badge>
                                            {entry.confirmationRequired ? (
                                                <Badge className="bg-amber-50 text-amber-700">
                                                    Confirmación
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-50 text-emerald-700">
                                                    Consulta
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-1 text-sm text-gray-600">
                                            {entry.toolName || entry.key}
                                        </div>
                                        {entry.requiredFields?.length ? (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Campos mínimos: {entry.requiredFields.join(', ')}
                                            </div>
                                        ) : null}
                                        {entry.allowedValues?.length ? (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Valores soportados: {entry.allowedValues.join(', ')}
                                            </div>
                                        ) : null}
                                        {entry.confirmationPrompt ? (
                                            <div className="mt-2 text-xs text-gray-600">
                                                {entry.confirmationPrompt}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>
        </div>
    )
}

export default AiRuntimeSettings
