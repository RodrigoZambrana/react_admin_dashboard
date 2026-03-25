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

    const updatedLabel = useMemo(
        () => formatDateTime(config?.updatedAt ?? null),
        [config?.updatedAt],
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
            </Card>
        </div>
    )
}

export default AiRuntimeSettings
