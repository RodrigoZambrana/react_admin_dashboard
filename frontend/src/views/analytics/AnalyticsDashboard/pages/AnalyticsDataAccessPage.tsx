import { useCallback, useEffect, useMemo, useState } from 'react'
import { Field, Form, Formik } from 'formik'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Loading from '@/components/shared/Loading'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { FormContainer, FormItem } from '@/components/ui/Form'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import InsightsService, {
    type InsightAdsCampaignItem,
    type InsightProductPerformanceItem,
    type InsightSearchQueryItem,
    type InsightServiceKeyCredential,
    type InsightTrafficItem,
} from '@/services/InsightsService'

type ServiceKeyFormValues = {
    name: string
    scopes: string
    expiresAt: string
    enabled: boolean
}

const defaultFormValues: ServiceKeyFormValues = {
    name: 'analytics-data-access',
    scopes: 'read:products,read:search,read:analytics,read:ads,read:funnels',
    expiresAt: '',
    enabled: true,
}

const formatDateTime = (value: string | null) => {
    if (!value) {
        return 'n/a'
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

const statusTone = (status?: string | null) => {
    switch (status) {
        case 'ready':
            return 'bg-emerald-100 text-emerald-700'
        case 'partial':
            return 'bg-amber-100 text-amber-700'
        case 'error':
        case 'not_ready':
            return 'bg-rose-100 text-rose-700'
        default:
            return 'bg-slate-100 text-slate-700'
    }
}

const performanceLabel = (value: number | null | undefined, suffix = '') =>
    value === null || value === undefined ? 'n/a' : `${value.toLocaleString()}${suffix}`

const scopesFromValue = (value: string) =>
    value
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean)

const AnalyticsDataAccessPage = () => {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [sourceQuality, setSourceQuality] = useState<Array<{ source: string; status: string }>>([])
    const [productPerformance, setProductPerformance] = useState<InsightProductPerformanceItem[]>([])
    const [searchQueries, setSearchQueries] = useState<InsightSearchQueryItem[]>([])
    const [gaTraffic, setGaTraffic] = useState<InsightTrafficItem[]>([])
    const [adsCampaigns, setAdsCampaigns] = useState<InsightAdsCampaignItem[]>([])
    const [serviceKeys, setServiceKeys] = useState<InsightServiceKeyCredential[]>([])
    const [issuedToken, setIssuedToken] = useState<string | null>(null)

    const load = useCallback(async () => {
        setRefreshing(true)
        try {
            const [
                sourcesResponse,
                productsResponse,
                searchResponse,
                trafficResponse,
                adsResponse,
                keysResponse,
            ] = await Promise.all([
                InsightsService.getSourcesQuality(),
                InsightsService.getProductsPerformance({ limit: 6 }),
                InsightsService.getSearchQueries({ limit: 6 }),
                InsightsService.getGaTraffic({ limit: 6 }),
                InsightsService.getAdsCampaigns({ limit: 6 }),
                InsightsService.getServiceKeys(),
            ])

            setSourceQuality(sourcesResponse.data.items ?? [])
            setProductPerformance(productsResponse.data.items ?? [])
            setSearchQueries(searchResponse.data.items ?? [])
            setGaTraffic(trafficResponse.data.items ?? [])
            setAdsCampaigns(adsResponse.data.items ?? [])
            setServiceKeys(keysResponse.credentials ?? [])
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar el acceso a datos" type="danger">
                    Revisa la sesión, los scopes y la disponibilidad de la DAL.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const topProduct = useMemo(() => productPerformance[0] ?? null, [productPerformance])
    const topQuery = useMemo(() => searchQueries[0] ?? null, [searchQueries])
    const topTraffic = useMemo(() => gaTraffic[0] ?? null, [gaTraffic])
    const topCampaign = useMemo(() => adsCampaigns[0] ?? null, [adsCampaigns])

    const handleCopyToken = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.push(
                <Notification title="Token copiado" type="success">
                    La API key se copió al portapapeles.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No se pudo copiar" type="danger">
                    Copiá la clave manualmente desde el bloque generado.
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }

    if (loading) {
        return <Loading loading />
    }

    return (
        <AnalyticsPageLayout
            title="Acceso a datos"
            subtitle="Panel seguro para consumir la DAL y emitir API keys de servicio para otros agentes."
            showControls={false}
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge content="DAL segura" innerClass="bg-indigo-100 text-indigo-700" />
                                <Badge
                                    content={`${serviceKeys.length} keys`}
                                    innerClass="bg-emerald-100 text-emerald-700"
                                />
                                <Badge
                                    content={`${sourceQuality.length} fuentes`}
                                    innerClass="bg-slate-100 text-slate-700"
                                />
                            </div>
                            <div>
                                <h4 className="mb-1">Acceso controlado a datos reales</h4>
                                <p className="max-w-4xl text-sm text-gray-600">
                                    Esta pantalla conecta el admin con la DAL sin exponer tablas crudas.
                                    Desde aquí podés leer métricas agregadas y emitir una API key para otro agente.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {sourceQuality.map((entry) => (
                                    <Badge
                                        key={entry.source}
                                        content={`${entry.source}: ${entry.status}`}
                                        innerClass={statusTone(entry.status)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="solid" loading={refreshing} onClick={() => void load()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Snapshot de negocio</h5>
                            <p className="text-sm text-gray-500">
                                Vista resumida de la DAL para el admin.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                <div className="text-xs uppercase tracking-wide text-gray-500">Producto</div>
                                <div className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
                                    {topProduct?.name ?? 'Sin datos'}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Revenue {performanceLabel(topProduct?.revenue, '')} · Views {performanceLabel(topProduct?.views)}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Conversion rate {performanceLabel(topProduct?.conversionRate, '%')}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                <div className="text-xs uppercase tracking-wide text-gray-500">Query SEO</div>
                                <div className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
                                    {topQuery?.query ?? 'Sin datos'}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Impresiones {performanceLabel(topQuery?.impressions)} · CTR {performanceLabel(topQuery?.ctr, '%')}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Posición {performanceLabel(topQuery?.position)}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                <div className="text-xs uppercase tracking-wide text-gray-500">GA4</div>
                                <div className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
                                    {topTraffic?.source ?? 'Sin datos'}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Sesiones {performanceLabel(topTraffic?.sessions)} · Revenue {performanceLabel(topTraffic?.revenue)}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Conv. rate {performanceLabel(topTraffic?.conversionRate, '%')}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40">
                                <div className="text-xs uppercase tracking-wide text-gray-500">Ads</div>
                                <div className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
                                    {topCampaign?.campaign ?? 'Sin datos'}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Coste {performanceLabel(topCampaign?.cost)} · ROAS {performanceLabel(topCampaign?.roas)}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                    Medición {topCampaign?.measurementReady ? 'lista' : 'pendiente'}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Emisión de API key</h5>
                            <p className="text-sm text-gray-500">
                                Genera una clave de servicio para otro agente o integración.
                            </p>
                        </div>
                        <Formik
                            initialValues={defaultFormValues}
                            onSubmit={async (values, { setSubmitting, resetForm }) => {
                                setSubmitting(true)
                                setIssuedToken(null)
                                try {
                                    const response = await InsightsService.createServiceKey({
                                        name: values.name.trim() || undefined,
                                        scopes: scopesFromValue(values.scopes),
                                        expiresAt: values.expiresAt ? values.expiresAt : null,
                                        enabled: values.enabled,
                                    })
                                    setIssuedToken(response.token)
                                    await load()
                                    toast.push(
                                        <Notification title="API key emitida" type="success">
                                            La clave quedó guardada en backend y solo se muestra una vez.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                    resetForm({ values })
                                } catch (error) {
                                    console.error(error)
                                    toast.push(
                                        <Notification title="No fue posible emitir la API key" type="danger">
                                            Verifica permisos de admin y disponibilidad de SecureConfig.
                                        </Notification>,
                                        { placement: 'top-end' },
                                    )
                                } finally {
                                    setSubmitting(false)
                                }
                            }}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <FormContainer>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <FormItem label="Nombre">
                                                <Field
                                                    as={Input}
                                                    name="name"
                                                    placeholder="analytics-data-access"
                                                />
                                            </FormItem>
                                            <FormItem label="Expira">
                                                <Field
                                                    as={Input}
                                                    type="datetime-local"
                                                    name="expiresAt"
                                                />
                                            </FormItem>
                                        </div>

                                        <FormItem
                                            label="Scopes"
                                            extra="Separados por coma. Ejemplo: read:analytics,read:search"
                                        >
                                            <Field
                                                as={Input}
                                                name="scopes"
                                                placeholder="read:products,read:search,read:analytics,read:ads,read:funnels"
                                            />
                                        </FormItem>

                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <Field
                                                type="checkbox"
                                                name="enabled"
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span>Clave habilitada</span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Button type="submit" variant="solid" loading={isSubmitting}>
                                                Emitir key
                                            </Button>
                                        </div>
                                    </FormContainer>
                                </Form>
                            )}
                        </Formik>

                        {issuedToken ? (
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="text-sm font-semibold text-emerald-800">
                                    API key generada una sola vez
                                </div>
                                <div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-gray-800">
                                    {issuedToken}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        onClick={() => void handleCopyToken(issuedToken)}
                                    >
                                        Copiar
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Service keys activas</h5>
                            <p className="text-sm text-gray-500">
                                Claves persistidas en SecureConfig para consumo externo.
                            </p>
                        </div>
                        <div className="space-y-3">
                            {serviceKeys.length ? (
                                serviceKeys.map((key) => (
                                    <div
                                        key={key.name}
                                        className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {key.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Prefijo {key.tokenPrefix ?? 'n/a'} · {key.source}
                                                </div>
                                            </div>
                                            <Badge
                                                content={key.enabled ? 'enabled' : 'disabled'}
                                                innerClass={key.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}
                                            />
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {key.scopes.map((scope) => (
                                                <Badge
                                                    key={`${key.name}-${scope}`}
                                                    content={scope}
                                                    innerClass="bg-indigo-100 text-indigo-700"
                                                />
                                            ))}
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
                                            <div>Creada: {formatDateTime(key.createdAt)}</div>
                                            <div>Expira: {formatDateTime(key.expiresAt)}</div>
                                            <div>Ultimo uso: {formatDateTime(key.lastUsedAt)}</div>
                                            <div>Origen: {key.source}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500">
                                    No hay keys persistidas. Emití una para empezar a consumir la DAL sin sesión de navegador.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Calidad y cobertura</h5>
                            <p className="text-sm text-gray-500">
                                Estado resumido de las fuentes conectadas.
                            </p>
                        </div>
                        <div className="space-y-3">
                            {sourceQuality.map((entry) => (
                                <div
                                    key={entry.source}
                                    className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/40"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium capitalize text-gray-900 dark:text-gray-100">
                                            {entry.source.replace('_', ' ')}
                                        </div>
                                        <Badge
                                            content={entry.status}
                                            innerClass={statusTone(entry.status)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsDataAccessPage
