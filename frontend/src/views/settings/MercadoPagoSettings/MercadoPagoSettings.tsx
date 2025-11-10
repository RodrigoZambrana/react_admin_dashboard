import { useCallback, useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import Card from '@/components/ui/Card'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Loading from '@/components/shared/Loading'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import Switcher from '@/components/ui/Switcher'
import { HiClipboardCopy, HiEye, HiEyeOff } from 'react-icons/hi'
import type { AxiosResponse } from 'axios'
import {
    apiGetMercadoPagoSettings,
    apiUpdateMercadoPagoSettings,
} from '@/services/SettingsService'

type MercadoPagoSettingsResponse = {
    enabled: boolean
    source: 'environment' | 'database'
    updatedAt: string | null
    provider: 'mercadopago' | 'none'
    publicKey: string | null
    accessToken: string | null
    country: string | null
    integratorId?: string | null
    applicationId?: string | null
    timeoutMs?: number
}

type FormValues = {
    provider: 'mercadopago' | 'none'
    publicKey: string
    accessToken: string
    country: string
}

const initialFormState: FormValues = {
    provider: 'mercadopago',
    publicKey: '',
    accessToken: '',
    country: '',
}


const formatDateTime = (value: string | null) => {
    if (!value) {
        return null
    }
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const buildSecretSuffix = (visible: boolean, onToggle: () => void, onCopy: () => void) => (
    <div className="flex items-center gap-2 pr-2">
        <Button
            type="button"
            size="xs"
            variant="plain"
            className="text-gray-600"
            onClick={onCopy}
        >
            <HiClipboardCopy className="text-lg" />
        </Button>
        <Button
            type="button"
            size="xs"
            variant="plain"
            className="text-gray-600"
            onClick={onToggle}
        >
            {visible ? <HiEyeOff className="text-lg" /> : <HiEye className="text-lg" />}
        </Button>
    </div>
)

const MercadoPagoSettings = () => {
    const [loading, setLoading] = useState(true)
    const [initialValues, setInitialValues] = useState<FormValues>(initialFormState)
    const [meta, setMeta] = useState<{
        enabled: boolean
        source: 'environment' | 'database'
        updatedAt: string | null
    }>({
        enabled: false,
        source: 'environment',
        updatedAt: null,
    })
    const [showPublicKey, setShowPublicKey] = useState(false)
    const [showAccessToken, setShowAccessToken] = useState(false)

    const loadSettings = useCallback(async () => {
        setLoading(true)
        try {
            const response: AxiosResponse<MercadoPagoSettingsResponse> =
                await apiGetMercadoPagoSettings()
            const data = response.data
            setInitialValues({
                provider: data.provider ?? 'mercadopago',
                publicKey: data.publicKey ?? '',
                accessToken: data.accessToken ?? '',
                country: data.country ?? '',
            })
            setMeta({
                enabled: data.enabled,
                source: data.source,
                updatedAt: data.updatedAt,
            })
        } catch (error) {
            toast.push(
                <Notification title="Unable to load Mercado Pago settings" type="danger">
                    Please verify your permissions and try again.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadSettings()
    }, [loadSettings])

    const updatedLabel = useMemo(() => formatDateTime(meta.updatedAt), [meta.updatedAt])

    const handleCopy = useCallback(async (value: string, label: string) => {
        if (!value) {
            toast.push(
                <Notification title="Nothing to copy" type="warning">
                    {`The ${label} field is empty.`}
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }
        try {
            await navigator.clipboard.writeText(value)
            toast.push(
                <Notification title="Copied to clipboard" type="success">
                    {`${label} was copied successfully.`}
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            toast.push(
                <Notification title="Copy failed" type="danger">
                    Your browser blocked clipboard access. Copy the value manually.
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }, [])

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="max-w-3xl mx-auto">
            <Card>
                <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-3">
                        <Badge
                            className={
                                meta.enabled
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-gray-100 text-gray-600'
                            }
                        >
                            {meta.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <span className="text-sm text-gray-500 capitalize">
                            Source: {meta.source}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600">
                        Credentials are encrypted before being stored in the database. Use the
                        controls below to manage your Mercado Pago integration.
                    </p>
                    {updatedLabel ? (
                        <span className="text-xs text-gray-500">
                            Last updated {updatedLabel}
                        </span>
                    ) : null}
                </div>

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting, setValues }) => {
                        setSubmitting(true)
                        try {
                            const payload = {
                                provider: values.provider,
                                publicKey: values.publicKey.trim() || null,
                                accessToken: values.accessToken.trim() || null,
                                country: values.country.trim().toUpperCase() || null,
                            }
                            const response: AxiosResponse<MercadoPagoSettingsResponse> =
                                await apiUpdateMercadoPagoSettings(payload)
                            const data = response.data
                            setValues({
                                provider: data.provider ?? 'mercadopago',
                                publicKey: data.publicKey ?? '',
                                accessToken: data.accessToken ?? '',
                                country: data.country ?? '',
                            })
                            setMeta({
                                enabled: data.enabled,
                                source: data.source,
                                updatedAt: data.updatedAt,
                            })
                            toast.push(
                                <Notification title="Mercado Pago settings saved" type="success">
                                    The configuration was updated successfully.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } catch (error) {
                            toast.push(
                                <Notification title="Unable to save settings" type="danger">
                                    Please double-check the values and try again.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ values, isSubmitting, dirty, handleReset, setFieldValue }) => {
                        const providerEnabled = values.provider === 'mercadopago'
                        return (
                            <Form>
                                <FormContainer>
                                    <FormItem
                                        label="Enable Mercado Pago"
                                        extra="Turn off the integration without deleting stored credentials."
                                    >
                                        <div className="flex items-center gap-4">
                                            <Switcher
                                                checked={providerEnabled}
                                                onChange={(checked) =>
                                                    setFieldValue('provider', checked ? 'mercadopago' : 'none')
                                                }
                                            />
                                            <span className="text-sm text-gray-600">
                                                {providerEnabled
                                                    ? 'Customers will be able to pay through Mercado Pago.'
                                                    : 'Mercado Pago checkout is disabled.'}
                                            </span>
                                        </div>
                                    </FormItem>

                                    <FormItem label="Public key">
                                        <Field name="publicKey">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    placeholder="TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                    type={showPublicKey ? 'text' : 'password'}
                                                    disabled={!providerEnabled}
                                                    field={field}
                                                    form={form}
                                                    suffix={buildSecretSuffix(
                                                        showPublicKey,
                                                        () => setShowPublicKey((prev) => !prev),
                                                        () => {
                                                            void handleCopy(
                                                                values.publicKey,
                                                                'public key',
                                                            )
                                                        },
                                                    )}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>

                                    <FormItem label="Access token">
                                        <Field name="accessToken">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    placeholder="TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                    type={showAccessToken ? 'text' : 'password'}
                                                    disabled={!providerEnabled}
                                                    field={field}
                                                    form={form}
                                                    suffix={buildSecretSuffix(
                                                        showAccessToken,
                                                        () => setShowAccessToken((prev) => !prev),
                                                        () => {
                                                            void handleCopy(
                                                                values.accessToken,
                                                                'access token',
                                                            )
                                                        },
                                                    )}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>

                                    <FormItem
                                        label="Country (optional)"
                                        extra="Two-letter country code used to localise the Mercado Pago checkout."
                                    >
                                        <Field name="country">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    placeholder="AR"
                                                    disabled={!providerEnabled}
                                                    field={field}
                                                    form={form}
                                                    maxLength={4}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        type="button"
                                        variant="plain"
                                        onClick={() => {
                                            handleReset()
                                            setShowPublicKey(false)
                                            setShowAccessToken(false)
                                        }}
                                        disabled={isSubmitting || !dirty}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="solid"
                                        color="indigo-600"
                                        loading={isSubmitting}
                                        disabled={!dirty}
                                    >
                                        Save changes
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                        )
                    }}
                </Formik>
            </Card>
        </div>
    )
}

export default MercadoPagoSettings
