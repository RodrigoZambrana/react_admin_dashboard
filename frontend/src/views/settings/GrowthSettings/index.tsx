import { useCallback, useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Switcher from '@/components/ui/Switcher'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { FormContainer, FormItem } from '@/components/ui/Form'
import { HiClipboardCopy, HiEye, HiEyeOff } from 'react-icons/hi'
import GrowthSettingsService, {
    type GrowthSettingsConfig,
    type GrowthSettingsOverview,
} from '@/services/GrowthSettingsService'

const defaultValues: GrowthSettingsConfig = {
    googleAnalyticsEnabled: false,
    googleAnalyticsMeasurementId: '',
    googleTagManagerEnabled: false,
    googleTagManagerContainerId: '',
    googleAdsEnabled: false,
    googleAdsConversionId: '',
    googleAdsConversionLabel: '',
    googleSearchConsoleVerificationToken: '',
    metaPixelEnabled: false,
    metaPixelId: '',
    metaConversionsApiEnabled: false,
    metaConversionsApiToken: '',
    metaAdsAccountId: '',
    contentInsightsEnabled: false,
}

const readinessTone = (ready: boolean) =>
    ready
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700'

const formatDateTime = (value: string | null) => {
    if (!value) return 'n/a'
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const secretSuffix = (
    visible: boolean,
    onToggle: () => void,
    onCopy: () => void,
) => (
    <div className="flex items-center gap-2 pr-2">
        <Button type="button" size="xs" variant="plain" onClick={onCopy}>
            <HiClipboardCopy className="text-lg" />
        </Button>
        <Button type="button" size="xs" variant="plain" onClick={onToggle}>
            {visible ? <HiEyeOff className="text-lg" /> : <HiEye className="text-lg" />}
        </Button>
    </div>
)

const GrowthSettings = () => {
    const [loading, setLoading] = useState(true)
    const [overview, setOverview] = useState<GrowthSettingsOverview | null>(null)
    const [initialValues, setInitialValues] = useState<GrowthSettingsConfig>(defaultValues)
    const [showMetaConversionsToken, setShowMetaConversionsToken] = useState(false)

    const loadOverview = useCallback(async () => {
        setLoading(true)
        try {
            const response = await GrowthSettingsService.getOverview()
            const next = response.data
            setOverview(next)
            setInitialValues({
                googleAnalyticsEnabled: next.config.googleAnalyticsEnabled,
                googleAnalyticsMeasurementId: next.config.googleAnalyticsMeasurementId ?? '',
                googleTagManagerEnabled: next.config.googleTagManagerEnabled,
                googleTagManagerContainerId: next.config.googleTagManagerContainerId ?? '',
                googleAdsEnabled: next.config.googleAdsEnabled,
                googleAdsConversionId: next.config.googleAdsConversionId ?? '',
                googleAdsConversionLabel: next.config.googleAdsConversionLabel ?? '',
                googleSearchConsoleVerificationToken:
                    next.config.googleSearchConsoleVerificationToken ?? '',
                metaPixelEnabled: next.config.metaPixelEnabled,
                metaPixelId: next.config.metaPixelId ?? '',
                metaConversionsApiEnabled: next.config.metaConversionsApiEnabled,
                metaConversionsApiToken: next.config.metaConversionsApiToken ?? '',
                metaAdsAccountId: next.config.metaAdsAccountId ?? '',
                contentInsightsEnabled: next.config.contentInsightsEnabled,
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar Growth" type="danger">
                    Revisá la conectividad con el backend y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadOverview()
    }, [loadOverview])

    const readiness = useMemo(() => overview?.readiness ?? null, [overview])
    const metaConnection = useMemo(() => overview?.publicConfig.meta.connection ?? null, [overview])

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <h4 className="m-0">Growth & Insights</h4>
                        <Badge
                            className="capitalize"
                            content={
                                overview?.meta.source === 'database'
                                    ? 'persisted config'
                                    : overview?.meta.source === 'environment'
                                        ? 'env fallback'
                                        : 'n/a'
                            }
                            innerClass={
                                overview?.meta.source === 'database'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600'
                            }
                        />
                    </div>
                    <p className="text-sm text-gray-600">
                        Gestiona Analytics, Tag Manager, Google Ads, Search Console,
                        Meta Pixel e insights de contenido sin mezclar esa capa con la
                        lógica del ecommerce. La persistencia backend es el modo normal;
                        ENV queda como fallback si todavía no existe `growth_config`.
                    </p>
                    <div className="text-xs text-gray-500">
                        Origen real de la config: {overview?.meta.source ?? 'n/a'}
                    </div>
                    <div className="text-xs text-gray-500">
                        Última actualización: {formatDateTime(overview?.meta.updatedAt ?? null)}
                    </div>
                </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
                {[
                    ['Google Analytics', readiness?.googleAnalyticsReady ?? false],
                    ['Google Tag Manager', readiness?.googleTagManagerReady ?? false],
                    ['Google Ads', readiness?.googleAdsReady ?? false],
                    ['Search Console', readiness?.googleSearchConsoleReady ?? false],
                    ['Meta Pixel', readiness?.metaPixelReady ?? false],
                    ['Meta CAPI', readiness?.metaConversionsApiReady ?? false],
                    ['Meta backend', readiness?.metaBackendConnectionReady ?? false],
                ].map(([label, ready]) => (
                    <Card key={label as string}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-gray-800">{label}</div>
                            <Badge
                                content={ready ? 'ready' : 'needs_data'}
                                innerClass={readinessTone(Boolean(ready))}
                            />
                        </div>
                    </Card>
                ))}
            </div>

            <Card>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h5 className="mb-1">Conexión backend Meta</h5>
                        <p className="text-sm text-gray-600">
                            Esta integración no depende de login OAuth contra Meta. El sistema
                            queda conectado por configuración backend usando Pixel ID, token de
                            Conversions API y Meta Ads Account ID. El modo operativo es
                            `backend_token`.
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        <Badge
                            content={metaConnection?.ready ? 'backend-ready' : 'backend-pending'}
                            innerClass={
                                metaConnection?.ready
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }
                        />
                        <span className="text-xs text-gray-500">
                            Modo: {metaConnection?.mode ?? 'backend_token'}
                        </span>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            Pixel ID
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {metaConnection?.pixelConfigured ? 'Configurado' : 'Falta configurar'}
                        </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            CAPI token
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {metaConnection?.conversionsApiConfigured
                                ? 'Configurado'
                                : 'Falta configurar'}
                        </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            Ads account ID
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {metaConnection?.adsAccountIdConfigured
                                ? 'Configurado'
                                : 'Falta configurar'}
                        </div>
                    </div>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-700/30">
                    Si existe configuración persistida en backend, esa es la que se usa.
                    Sólo cuando no hay `growth_config` el sistema cae a ENV para mantener
                    operativos los entornos sin persistencia todavía.
                </div>
            </Card>

            <Card>
                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={async (values, { setSubmitting }) => {
                        setSubmitting(true)
                        try {
                            const response = await GrowthSettingsService.updateConfig({
                                ...values,
                                googleAnalyticsMeasurementId:
                                    values.googleAnalyticsMeasurementId.trim(),
                                googleTagManagerContainerId:
                                    values.googleTagManagerContainerId.trim(),
                                googleAdsConversionId: values.googleAdsConversionId.trim(),
                                googleAdsConversionLabel: values.googleAdsConversionLabel.trim(),
                                googleSearchConsoleVerificationToken:
                                    values.googleSearchConsoleVerificationToken.trim(),
                                metaPixelId: values.metaPixelId.trim(),
                                metaConversionsApiToken:
                                    values.metaConversionsApiToken.trim(),
                                metaAdsAccountId: values.metaAdsAccountId.trim(),
                            })
                            setOverview(response.data)
                            toast.push(
                                <Notification title="Growth actualizado" type="success">
                                    La configuración quedó guardada.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } catch (error) {
                            console.error(error)
                            toast.push(
                                <Notification title="No fue posible guardar" type="danger">
                                    Revisá los valores y volvé a intentar.
                                </Notification>,
                                { placement: 'top-end' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ isSubmitting, dirty }) => (
                        <Form>
                            <FormContainer>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Card>
                                        <div className="mb-4">
                                            <h5 className="mb-1">Google</h5>
                                            <p className="text-sm text-gray-600">
                                                Scripts de medición, GTM, Ads y verificación SEO.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <FormItem label="Google Analytics">
                                                <div className="flex items-center gap-3">
                                                    <Field name="googleAnalyticsEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Habilitar medición con gtag.
                                                    </span>
                                                </div>
                                            </FormItem>

                                            <FormItem label="Measurement ID">
                                                <Field
                                                    as={Input}
                                                    name="googleAnalyticsMeasurementId"
                                                    placeholder="G-XXXXXXXXXX"
                                                />
                                            </FormItem>

                                            <FormItem label="Google Tag Manager">
                                                <div className="flex items-center gap-3">
                                                    <Field name="googleTagManagerEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Inyectar GTM en storefront.
                                                    </span>
                                                </div>
                                            </FormItem>

                                            <FormItem label="Container ID">
                                                <Field
                                                    as={Input}
                                                    name="googleTagManagerContainerId"
                                                    placeholder="GTM-XXXXXXX"
                                                />
                                            </FormItem>

                                            <FormItem label="Google Ads">
                                                <div className="flex items-center gap-3">
                                                    <Field name="googleAdsEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Configuración de conversiones públicas.
                                                    </span>
                                                </div>
                                            </FormItem>

                                            <FormItem label="Conversion ID">
                                                <Field
                                                    as={Input}
                                                    name="googleAdsConversionId"
                                                    placeholder="AW-XXXXXXXXX"
                                                />
                                            </FormItem>

                                            <FormItem label="Conversion Label">
                                                <Field
                                                    as={Input}
                                                    name="googleAdsConversionLabel"
                                                    placeholder="abcDEFghiJKlMNopQR"
                                                />
                                            </FormItem>

                                            <FormItem label="Search Console verification token">
                                                <Field
                                                    as={Input}
                                                    name="googleSearchConsoleVerificationToken"
                                                    placeholder="google-site-verification=..."
                                                />
                                            </FormItem>
                                        </div>
                                    </Card>

                                    <Card>
                                        <div className="mb-4">
                                            <h5 className="mb-1">Meta backend connection</h5>
                                            <p className="text-sm text-gray-600">
                                                Configuración directa del lado del backend para
                                                Pixel, Conversions API y account mapping.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <FormItem label="Meta Pixel">
                                                <div className="flex items-center gap-3">
                                                    <Field name="metaPixelEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Pixel público para storefront.
                                                    </span>
                                                </div>
                                            </FormItem>

                                            <FormItem label="Pixel ID">
                                                <Field
                                                    as={Input}
                                                    name="metaPixelId"
                                                    placeholder="123456789012345"
                                                />
                                            </FormItem>

                                            <FormItem label="Meta Conversions API">
                                                <div className="flex items-center gap-3">
                                                    <Field name="metaConversionsApiEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Token privado para envíos server-side futuros.
                                                    </span>
                                                </div>
                                            </FormItem>

                                            <FormItem label="Conversions API token">
                                                <Field name="metaConversionsApiToken">
                                                    {({ field }: any) => (
                                                        <Input
                                                            {...field}
                                                            type={showMetaConversionsToken ? 'text' : 'password'}
                                                            placeholder="EAAB..."
                                                            suffix={secretSuffix(
                                                                showMetaConversionsToken,
                                                                () =>
                                                                    setShowMetaConversionsToken(
                                                                        (current) => !current,
                                                                    ),
                                                                async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(
                                                                            String(field.value || ''),
                                                                        )
                                                                        toast.push(
                                                                            <Notification
                                                                                title="Copiado"
                                                                                type="success"
                                                                            >
                                                                                El token se copió al portapapeles.
                                                                            </Notification>,
                                                                            { placement: 'top-end' },
                                                                        )
                                                                    } catch {
                                                                        toast.push(
                                                                            <Notification
                                                                                title="No fue posible copiar"
                                                                                type="warning"
                                                                            >
                                                                                Copialo manualmente.
                                                                            </Notification>,
                                                                            { placement: 'top-end' },
                                                                        )
                                                                    }
                                                                },
                                                            )}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>

                                            <FormItem label="Meta Ads account ID">
                                                <Field
                                                    as={Input}
                                                    name="metaAdsAccountId"
                                                    placeholder="act_1234567890"
                                                />
                                            </FormItem>

                                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-700/30">
                                                No se requiere login OAuth con Meta para esta
                                                conexión. El backend usa estas credenciales para
                                                resolver el destino y enviar CAPI.
                                            </div>

                                            <FormItem label="Content insights">
                                                <div className="flex items-center gap-3">
                                                    <Field name="contentInsightsEnabled">
                                                        {({ field, form }: any) => (
                                                            <Switcher
                                                                checked={Boolean(field.value)}
                                                                onChange={(checked) =>
                                                                    form.setFieldValue(field.name, checked)
                                                                }
                                                            />
                                                        )}
                                                    </Field>
                                                    <span className="text-sm text-gray-600">
                                                        Habilita la capa de señales para contenido y campañas.
                                                    </span>
                                                </div>
                                            </FormItem>
                                        </div>
                                    </Card>
                                </div>

                                <div className="mt-6 flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => void loadOverview()}
                                        disabled={isSubmitting}
                                    >
                                        Refresh
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="solid"
                                        loading={isSubmitting}
                                        disabled={!dirty && Boolean(overview)}
                                    >
                                        Save
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

export default GrowthSettings
