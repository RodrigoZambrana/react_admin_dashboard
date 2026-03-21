import { useCallback, useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import Card from '@/components/ui/Card'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Switcher from '@/components/ui/Switcher'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { HiClipboardCopy, HiEye, HiEyeOff } from 'react-icons/hi'
import type { AxiosResponse } from 'axios'
import {
    apiGetGoogleIntegrationSettings,
    apiUpdateGoogleIntegrationSettings,
} from '@/services/SettingsService'
import { useTranslation } from 'react-i18next'

type GoogleIntegrationSettingsResponse = {
    source: 'environment' | 'database'
    updatedAt: string | null
    googleEnabled: boolean
    storefrontGoogleEnabled: boolean
    clientId: string | null
    clientSecret: string | null
    redirectUri: string | null
    recaptchaEnabled: boolean
    recaptchaSecretKey: string | null
    adminRecaptchaEnabled: boolean
    adminRecaptchaSiteKey: string | null
    storefrontRecaptchaEnabled: boolean
    storefrontRecaptchaSiteKey: string | null
    storefrontSiteUrl: string | null
}

type FormValues = {
    googleEnabled: boolean
    storefrontGoogleEnabled: boolean
    clientId: string
    clientSecret: string
    redirectUri: string
    recaptchaEnabled: boolean
    recaptchaSecretKey: string
    adminRecaptchaEnabled: boolean
    adminRecaptchaSiteKey: string
    storefrontRecaptchaEnabled: boolean
    storefrontRecaptchaSiteKey: string
    storefrontSiteUrl: string
}

const initialFormState: FormValues = {
    googleEnabled: true,
    storefrontGoogleEnabled: true,
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    recaptchaEnabled: false,
    recaptchaSecretKey: '',
    adminRecaptchaEnabled: false,
    adminRecaptchaSiteKey: '',
    storefrontRecaptchaEnabled: false,
    storefrontRecaptchaSiteKey: '',
    storefrontSiteUrl: '',
}

const formatTimestamp = (value: string | null) => {
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

const buildSecretSuffix = (
    isVisible: boolean,
    onToggle: () => void,
    onCopy: () => void,
) => (
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
            {isVisible ? <HiEyeOff className="text-lg" /> : <HiEye className="text-lg" />}
        </Button>
    </div>
)

const GoogleSettings = () => {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [initialValues, setInitialValues] = useState<FormValues>(initialFormState)
    const [meta, setMeta] = useState<{ source: 'environment' | 'database'; updatedAt: string | null }>(
        { source: 'environment', updatedAt: null },
    )
    const [showClientSecret, setShowClientSecret] = useState(false)
    const [showRecaptchaSecret, setShowRecaptchaSecret] = useState(false)

    const loadSettings = useCallback(async () => {
        setLoading(true)
        try {
            const response: AxiosResponse<GoogleIntegrationSettingsResponse> =
                await apiGetGoogleIntegrationSettings()
            const data = response.data
            setInitialValues({
                googleEnabled: Boolean(data.googleEnabled),
                storefrontGoogleEnabled: Boolean(data.storefrontGoogleEnabled),
                clientId: data.clientId ?? '',
                clientSecret: data.clientSecret ?? '',
                redirectUri: data.redirectUri ?? '',
                recaptchaEnabled: Boolean(data.recaptchaEnabled),
                recaptchaSecretKey: data.recaptchaSecretKey ?? '',
                adminRecaptchaEnabled: Boolean(data.adminRecaptchaEnabled),
                adminRecaptchaSiteKey: data.adminRecaptchaSiteKey ?? '',
                storefrontRecaptchaEnabled: Boolean(data.storefrontRecaptchaEnabled),
                storefrontRecaptchaSiteKey: data.storefrontRecaptchaSiteKey ?? '',
                storefrontSiteUrl: data.storefrontSiteUrl ?? '',
            })
            setMeta({ source: data.source, updatedAt: data.updatedAt })
        } catch {
            toast.push(
                <Notification
                    title={t('settings.google.notifications.loadErrorTitle', {
                        defaultValue: 'Unable to load Google settings',
                    })}
                    type="danger"
                >
                    {t('settings.google.notifications.loadErrorDescription', {
                        defaultValue: 'Please verify your permissions and try again.',
                    })}
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void loadSettings()
    }, [loadSettings])

    const updatedLabel = useMemo(() => formatTimestamp(meta.updatedAt), [meta.updatedAt])

    const handleCopy = useCallback(async (value: string, label: string) => {
        if (!value) {
            toast.push(
                <Notification
                    title={t('settings.google.notifications.copyEmptyTitle', {
                        defaultValue: 'Nothing to copy',
                    })}
                    type="warning"
                >
                    {t('settings.google.notifications.copyEmptyDescription', {
                        defaultValue: 'The {{label}} field is empty.',
                        label,
                    })}
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }
        try {
            await navigator.clipboard.writeText(value)
            toast.push(
                <Notification
                    title={t('settings.google.notifications.copySuccessTitle', {
                        defaultValue: 'Copied to clipboard',
                    })}
                    type="success"
                >
                    {t('settings.google.notifications.copySuccessDescription', {
                        defaultValue: '{{label}} was copied successfully.',
                        label,
                    })}
                </Notification>,
                { placement: 'top-end' },
            )
        } catch {
            toast.push(
                <Notification
                    title={t('settings.google.notifications.copyErrorTitle', {
                        defaultValue: 'Copy failed',
                    })}
                    type="danger"
                >
                    {t('settings.google.notifications.copyErrorDescription', {
                        defaultValue: 'Your browser blocked clipboard access. Copy the value manually.',
                    })}
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }, [t])

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Card>
                <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-3">
                        <Badge
                            className={
                                meta.source === 'database'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600'
                            }
                        >
                            {meta.source === 'database'
                                ? t('settings.google.badge.custom', { defaultValue: 'Custom configuration' })
                                : t('settings.google.badge.environment', { defaultValue: 'Environment defaults' })}
                        </Badge>
                        {updatedLabel ? (
                            <span className="text-xs text-gray-500">
                                {t('settings.google.updatedAtLabel', {
                                    defaultValue: 'Last updated {{value}}',
                                    value: updatedLabel,
                                })}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-sm text-gray-600">
                        {t('settings.google.description', {
                            defaultValue:
                                'Manage Google OAuth credentials and reCAPTCHA keys for both the admin panel and the storefront. Sensitive values are encrypted before being stored in the database.',
                        })}
                    </p>
                </div>

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting, setValues }) => {
                        setSubmitting(true)
                        try {
                            const payload = {
                                googleEnabled: values.googleEnabled,
                                storefrontGoogleEnabled: values.storefrontGoogleEnabled,
                                clientId: values.clientId.trim() || null,
                                clientSecret: values.clientSecret.trim() || null,
                                redirectUri: values.redirectUri.trim() || null,
                                recaptchaEnabled: values.recaptchaEnabled,
                                recaptchaSecretKey: values.recaptchaSecretKey.trim() || null,
                                adminRecaptchaEnabled: values.adminRecaptchaEnabled,
                                adminRecaptchaSiteKey: values.adminRecaptchaSiteKey.trim() || null,
                                storefrontRecaptchaEnabled: values.storefrontRecaptchaEnabled,
                                storefrontRecaptchaSiteKey:
                                    values.storefrontRecaptchaSiteKey.trim() || null,
                                storefrontSiteUrl: values.storefrontSiteUrl.trim() || null,
                            }

                            const response: AxiosResponse<GoogleIntegrationSettingsResponse> =
                                await apiUpdateGoogleIntegrationSettings(payload)
                            const data = response.data
                            const nextValues: FormValues = {
                                googleEnabled: Boolean(data.googleEnabled),
                                storefrontGoogleEnabled: Boolean(data.storefrontGoogleEnabled),
                                clientId: data.clientId ?? '',
                                clientSecret: data.clientSecret ?? '',
                                redirectUri: data.redirectUri ?? '',
                                recaptchaEnabled: Boolean(data.recaptchaEnabled),
                                recaptchaSecretKey: data.recaptchaSecretKey ?? '',
                                adminRecaptchaEnabled: Boolean(data.adminRecaptchaEnabled),
                                adminRecaptchaSiteKey: data.adminRecaptchaSiteKey ?? '',
                                storefrontRecaptchaEnabled: Boolean(data.storefrontRecaptchaEnabled),
                                storefrontRecaptchaSiteKey: data.storefrontRecaptchaSiteKey ?? '',
                                storefrontSiteUrl: data.storefrontSiteUrl ?? '',
                            }
                            setValues(nextValues)
                            setInitialValues(nextValues)
                            setMeta({ source: data.source, updatedAt: data.updatedAt })
                            toast.push(
                                <Notification
                                    title={t('settings.google.notifications.saveSuccessTitle', {
                                        defaultValue: 'Google settings saved',
                                    })}
                                    type="success"
                                >
                                    {t('settings.google.notifications.saveSuccessDescription', {
                                        defaultValue: 'The configuration was updated successfully.',
                                    })}
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } catch {
                            toast.push(
                                <Notification
                                    title={t('settings.google.notifications.saveErrorTitle', {
                                        defaultValue: 'Unable to save settings',
                                    })}
                                    type="danger"
                                >
                                    {t('settings.google.notifications.saveErrorDescription', {
                                        defaultValue: 'Please review the values and try again.',
                                    })}
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
                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.google.fields.googleEnabled.label', {
                                            defaultValue: 'Enable Google sign-in (backend)',
                                        })}
                                    >
                                        <Switcher
                                            checked={values.googleEnabled}
                                            onChange={(checked) => setFieldValue('googleEnabled', checked)}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            {t('settings.google.fields.googleEnabled.help', {
                                                defaultValue:
                                                    'Controls whether Google OAuth is accepted by the backend. Disable this to turn off the flow entirely.',
                                            })}
                                        </p>
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.google.fields.storefrontGoogleEnabled.label', {
                                            defaultValue: 'Enable Google button (storefront)',
                                        })}
                                    >
                                        <Switcher
                                            checked={values.storefrontGoogleEnabled}
                                            onChange={(checked) =>
                                                setFieldValue('storefrontGoogleEnabled', checked)
                                            }
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            {t('settings.google.fields.storefrontGoogleEnabled.help', {
                                                defaultValue:
                                                    'Toggles the Google sign-in option in the storefront UI. Requires Google OAuth to be enabled above.',
                                            })}
                                        </p>
                                    </FormItem>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.google.fields.storefrontSiteUrl.label', {
                                            defaultValue: 'Storefront site URL',
                                        })}
                                    >
                                        <Field name="storefrontSiteUrl">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    placeholder={t('settings.google.fields.storefrontSiteUrl.placeholder', {
                                                        defaultValue: 'https://storefront.example.com',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                />
                                            )}
                                        </Field>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {t('settings.google.fields.storefrontSiteUrl.help', {
                                                defaultValue:
                                                    'Provide the public URL of the storefront used for OAuth redirections. Overrides the NEXT_PUBLIC_SITE_URL environment variable.',
                                            })}
                                        </p>
                                    </FormItem>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.google.fields.clientId.label', {
                                            defaultValue: 'Google client ID',
                                        })}
                                    >
                                        <Field name="clientId">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    placeholder={t('settings.google.fields.clientId.placeholder', {
                                                        defaultValue: 'xxxxxxxx.apps.googleusercontent.com',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.google.fields.clientSecret.label', {
                                            defaultValue: 'Google client secret',
                                        })}
                                    >
                                        <Field name="clientSecret">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    type={showClientSecret ? 'text' : 'password'}
                                                    placeholder={t('settings.google.fields.clientSecret.placeholder', {
                                                        defaultValue: 'GOCSPX-...',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                    suffix={buildSecretSuffix(
                                                        showClientSecret,
                                                        () => setShowClientSecret((prev) => !prev),
                                                        () =>
                                                            handleCopy(
                                                                values.clientSecret,
                                                                t('settings.google.fields.clientSecret.label', {
                                                                    defaultValue: 'Google client secret',
                                                                }),
                                                            ),
                                                    )}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>

                                <FormItem
                                    label={t('settings.google.fields.redirectUri.label', {
                                        defaultValue: 'Authorized redirect URI',
                                    })}
                                >
                                    <Field name="redirectUri">
                                        {({ field, form }) => (
                                            <Input
                                                autoComplete="off"
                                                placeholder={t('settings.google.fields.redirectUri.placeholder', {
                                                    defaultValue:
                                                        'https://example.com/api/storefront/auth/google/callback',
                                                })}
                                                field={field}
                                                form={form}
                                            />
                                        )}
                                    </Field>
                                </FormItem>

                                <hr className="my-6" />

                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.google.fields.recaptchaEnabled.label', {
                                            defaultValue: 'Enable reCAPTCHA validation (backend)',
                                        })}
                                    >
                                        <Switcher
                                            checked={values.recaptchaEnabled}
                                            onChange={(checked) => setFieldValue('recaptchaEnabled', checked)}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            {t('settings.google.fields.recaptchaEnabled.help', {
                                                defaultValue: 'When enabled, admin sign-in requests must include a reCAPTCHA token.',
                                            })}
                                        </p>
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.google.fields.recaptchaSecretKey.label', {
                                            defaultValue: 'reCAPTCHA secret key',
                                        })}
                                    >
                                        <Field name="recaptchaSecretKey">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    type={showRecaptchaSecret ? 'text' : 'password'}
                                                    placeholder={t('settings.google.fields.recaptchaSecretKey.placeholder', {
                                                        defaultValue: '6Lc...',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                    suffix={buildSecretSuffix(
                                                        showRecaptchaSecret,
                                                        () => setShowRecaptchaSecret((prev) => !prev),
                                                        () =>
                                                            handleCopy(
                                                                values.recaptchaSecretKey,
                                                                t('settings.google.fields.recaptchaSecretKey.label', {
                                                                    defaultValue: 'reCAPTCHA secret key',
                                                                }),
                                                            ),
                                                    )}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.google.fields.adminRecaptcha.label', {
                                            defaultValue: 'Admin panel reCAPTCHA',
                                        })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Switcher
                                                checked={values.adminRecaptchaEnabled}
                                                onChange={(checked) =>
                                                    setFieldValue('adminRecaptchaEnabled', checked)
                                                }
                                            />
                                            <span className="text-sm text-gray-600">
                                                {t('settings.google.fields.adminRecaptcha.help', {
                                                    defaultValue: 'Toggle loading the script on the admin login page.',
                                                })}
                                            </span>
                                        </div>
                                        <Field name="adminRecaptchaSiteKey">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    className="mt-4"
                                                    placeholder={t('settings.google.fields.adminRecaptcha.siteKeyPlaceholder', {
                                                        defaultValue: 'Site key for the admin panel',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                    suffix={
                                                        <Button
                                                            type="button"
                                                            size="xs"
                                                            variant="plain"
                                                            className="text-gray-600"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    values.adminRecaptchaSiteKey,
                                                                    t('settings.google.fields.adminRecaptcha.siteKeyLabel', {
                                                                        defaultValue: 'Admin reCAPTCHA site key',
                                                                    }),
                                                                )
                                                            }
                                                        >
                                                            <HiClipboardCopy className="text-lg" />
                                                        </Button>
                                                    }
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.google.fields.storefrontRecaptcha.label', {
                                            defaultValue: 'Storefront reCAPTCHA',
                                        })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Switcher
                                                checked={values.storefrontRecaptchaEnabled}
                                                onChange={(checked) =>
                                                    setFieldValue('storefrontRecaptchaEnabled', checked)
                                                }
                                            />
                                            <span className="text-sm text-gray-600">
                                                {t('settings.google.fields.storefrontRecaptcha.help', {
                                                    defaultValue: 'Expose the site key in the storefront config to enable reCAPTCHA widgets.',
                                                })}
                                            </span>
                                        </div>
                                        <Field name="storefrontRecaptchaSiteKey">
                                            {({ field, form }) => (
                                                <Input
                                                    autoComplete="off"
                                                    className="mt-4"
                                                    placeholder={t('settings.google.fields.storefrontRecaptcha.siteKeyPlaceholder', {
                                                        defaultValue: 'Site key for the storefront',
                                                    })}
                                                    field={field}
                                                    form={form}
                                                    suffix={
                                                        <Button
                                                            type="button"
                                                            size="xs"
                                                            variant="plain"
                                                            className="text-gray-600"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    values.storefrontRecaptchaSiteKey,
                                                                    t('settings.google.fields.storefrontRecaptcha.siteKeyLabel', {
                                                                        defaultValue: 'Storefront reCAPTCHA site key',
                                                                    }),
                                                                )
                                                            }
                                                        >
                                                            <HiClipboardCopy className="text-lg" />
                                                        </Button>
                                                    }
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        type="button"
                                        variant="plain"
                                        onClick={() => {
                                            handleReset()
                                            setShowClientSecret(false)
                                            setShowRecaptchaSecret(false)
                                        }}
                                        disabled={isSubmitting || !dirty}
                                    >
                                        {t('common.reset', { defaultValue: 'Reset' })}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="solid"
                                        color="indigo-600"
                                        loading={isSubmitting}
                                        disabled={!dirty}
                                    >
                                        {t('settings.google.actions.save', { defaultValue: 'Save changes' })}
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

export default GoogleSettings
