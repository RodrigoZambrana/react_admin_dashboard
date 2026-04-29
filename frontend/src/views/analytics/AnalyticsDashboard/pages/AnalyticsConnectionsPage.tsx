import { useEffect, useMemo, useState } from 'react'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import Select from '@/components/ui/Select'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { HiOutlineRefresh, HiOutlineExternalLink } from 'react-icons/hi'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import { useAnalyticsOperationsData } from '../hooks/useAnalyticsOperationsData'
import {
    apiGetGa4Properties,
    apiGetSearchConsoleProperties,
    apiRunAdsBackfill,
    apiRunAdsInitialSync,
    apiRunAdsIncrementalSync,
    apiRunAdsRepair,
    apiRunGa4Backfill,
    apiRunGa4IncrementalSync,
    apiRunGa4InitialSync,
    apiRunGa4Repair,
    apiRunSearchConsoleBackfill,
    apiRunSearchConsoleIncrementalSync,
    apiRunSearchConsoleInitialSync,
    apiRunSearchConsoleRepair,
    apiSelectGa4Property,
    apiSelectSearchConsoleProperty,
    apiStartAdsOAuth,
    apiStartGa4OAuth,
    apiStartSearchConsoleOAuth,
    type AnalyticsGa4Property,
    type AnalyticsSearchConsoleProperty,
    type AnalyticsAdsSyncResult,
    type AnalyticsGa4SyncResult,
    type AnalyticsSearchConsoleSyncResult,
} from '@/services/AnalyticsService'

const sourceLabel: Record<string, string> = {
    ga4: 'Google Analytics 4',
    ads: 'Google Ads',
    search_console: 'Search Console',
}

const statusTone = (status: string) => {
    switch (status) {
        case 'ready':
            return 'bg-emerald-100 text-emerald-700'
        case 'syncing':
            return 'bg-sky-100 text-sky-700'
        case 'error':
            return 'bg-rose-100 text-rose-700'
        case 'disabled':
            return 'bg-gray-200 text-gray-700'
        default:
            return 'bg-amber-100 text-amber-700'
    }
}

const impactTone = (impact: string) => {
    switch (impact) {
        case 'critical':
            return 'bg-rose-100 text-rose-700'
        case 'high':
            return 'bg-orange-100 text-orange-700'
        case 'medium':
            return 'bg-amber-100 text-amber-700'
        default:
            return 'bg-sky-100 text-sky-700'
    }
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

const formatLag = (value: number | null) => {
    if (value === null) {
        return 'n/a'
    }
    if (value <= 0) {
        return 'on time'
    }
    return `${value} min`
}

const toCountLabel = (value: number, singular: string, plural: string) =>
    `${value} ${value === 1 ? singular : plural}`

const renderEvidence = (evidence: Record<string, unknown>) => {
    const entries = Object.entries(evidence).slice(0, 4)
    if (!entries.length) {
        return 'Sin evidencia adicional.'
    }

    return entries
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(' · ')
}

type PropertyOption = {
    label: string
    value: string
}

const buildConnectionsReturnPath = () =>
    new URL('/app/analytics/connections', window.location.origin).toString()

const AnalyticsConnectionsPage = () => {
    const { loading, refreshing, error, data, reload } = useAnalyticsOperationsData()
    const [propertiesLoading, setPropertiesLoading] = useState(false)
    const [ga4OauthLoading, setGa4OauthLoading] = useState(false)
    const [adsOauthLoading, setAdsOauthLoading] = useState(false)
    const [searchConsoleOauthLoading, setSearchConsoleOauthLoading] = useState(false)
    const [ga4SyncLoading, setGa4SyncLoading] = useState(false)
    const [adsSyncLoading, setAdsSyncLoading] = useState(false)
    const [searchConsoleSyncLoading, setSearchConsoleSyncLoading] = useState(false)
    const [backfillLoading, setBackfillLoading] = useState(false)
    const [repairLoading, setRepairLoading] = useState(false)
    const [ga4Properties, setGa4Properties] = useState<AnalyticsGa4Property[]>([])
    const [searchConsoleProperties, setSearchConsoleProperties] = useState<
        AnalyticsSearchConsoleProperty[]
    >([])
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
    const [selectedSearchConsolePropertyId, setSelectedSearchConsolePropertyId] = useState<
        string | null
    >(null)

    const connections = data.connections
    const runs = data.runs
    const insights = data.insights
    const openInsights = insights.filter((insight) => insight.status === 'open')
    const readyConnections = connections.filter((connection) => connection.status === 'ready')
    const reauthConnections = connections.filter((connection) => connection.needsReauth)
    const ga4Connection = useMemo(
        () => connections.find((connection) => connection.source === 'ga4') ?? null,
        [connections],
    )
    const adsConnection = useMemo(
        () => connections.find((connection) => connection.source === 'ads') ?? null,
        [connections],
    )
    const searchConsoleConnection = useMemo(
        () => connections.find((connection) => connection.source === 'search_console') ?? null,
        [connections],
    )

    const loadProperties = async (connectionId: string) => {
        setPropertiesLoading(true)
        try {
            const response = await apiGetGa4Properties<{ properties: AnalyticsGa4Property[] }>(
                connectionId,
            )
            setGa4Properties(response.data.properties ?? [])
            setSelectedPropertyId((current) => current ?? response.data.properties?.[0]?.propertyId ?? null)
        } catch (loadError) {
            console.error(loadError)
            setGa4Properties([])
            toast.push(
                <Notification title="No fue posible cargar properties" type="danger">
                    Revisá la autenticación GA4 y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setPropertiesLoading(false)
        }
    }

    useEffect(() => {
        if (!ga4Connection || ga4Connection.target.id) {
            return
        }
        void loadProperties(ga4Connection.id)
    }, [ga4Connection])

    const loadSearchConsoleProperties = async (connectionId: string) => {
        setPropertiesLoading(true)
        try {
            const response = await apiGetSearchConsoleProperties<{
                properties: AnalyticsSearchConsoleProperty[]
            }>(connectionId)
            setSearchConsoleProperties(response.data.properties ?? [])
            setSelectedSearchConsolePropertyId(
                (current) => current ?? response.data.properties?.[0]?.siteUrl ?? null,
            )
        } catch (loadError) {
            console.error(loadError)
            setSearchConsoleProperties([])
            toast.push(
                <Notification title="No fue posible cargar properties de Search Console" type="danger">
                    Revisá la autenticación y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setPropertiesLoading(false)
        }
    }

    useEffect(() => {
        if (!searchConsoleConnection || searchConsoleConnection.target.id) {
            return
        }
        void loadSearchConsoleProperties(searchConsoleConnection.id)
    }, [searchConsoleConnection])

    const handleStartOAuth = async (source: 'ga4' | 'ads') => {
        if (source === 'ga4') {
            setGa4OauthLoading(true)
        } else {
            setAdsOauthLoading(true)
        }
        try {
            const response =
                source === 'ga4'
                    ? await apiStartGa4OAuth<{ url: string }>(buildConnectionsReturnPath())
                    : await apiStartAdsOAuth<{ url: string }>(buildConnectionsReturnPath())
            const authUrl = response.data.url
            if (!authUrl) {
                throw new Error('Google OAuth no devolvió una URL válida.')
            }
            window.location.href = authUrl
        } catch (startError) {
            console.error(startError)
            toast.push(
                <Notification
                    title={
                        source === 'ga4'
                            ? 'No fue posible iniciar GA4'
                            : 'No fue posible iniciar Google Ads'
                    }
                    type="danger"
                >
                    Verificá la configuración de Google OAuth y Ads en backend.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            if (source === 'ga4') {
                setGa4OauthLoading(false)
            } else {
                setAdsOauthLoading(false)
            }
        }
    }

    const handleSearchConsoleOAuth = async () => {
        setSearchConsoleOauthLoading(true)
        try {
            const response = await apiStartSearchConsoleOAuth<{ url: string }>(
                buildConnectionsReturnPath(),
            )
            const authUrl = response.data.url
            if (!authUrl) {
                throw new Error('Google OAuth no devolvió una URL válida.')
            }
            window.location.href = authUrl
        } catch (startError) {
            console.error(startError)
            toast.push(
                <Notification title="No fue posible iniciar Search Console" type="danger">
                    Verificá la configuración de Google OAuth en backend.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSearchConsoleOauthLoading(false)
        }
    }

    const handleSearchConsolePropertySelection = async () => {
        if (!searchConsoleConnection?.id || !selectedSearchConsolePropertyId) {
            return
        }

        setSearchConsoleSyncLoading(true)
        try {
            await apiSelectSearchConsoleProperty<AnalyticsSearchConsoleSyncResult>(
                searchConsoleConnection.id,
                selectedSearchConsolePropertyId,
            )
            toast.push(
                <Notification title="Search Console sincronizado" type="success">
                    Se seleccionó la property y se lanzó el initial sync.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
            setSearchConsoleProperties([])
        } catch (selectionError) {
            console.error(selectionError)
            toast.push(
                <Notification title="No fue posible guardar la property" type="danger">
                    Revisá la cuenta de Search Console y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSearchConsoleSyncLoading(false)
        }
    }

    const handleSearchConsoleInitialSync = async () => {
        if (!searchConsoleConnection?.id) {
            return
        }

        setSearchConsoleSyncLoading(true)
        try {
            await apiRunSearchConsoleInitialSync<AnalyticsSearchConsoleSyncResult>(
                searchConsoleConnection.id,
            )
            toast.push(
                <Notification title="Initial sync Search Console ejecutado" type="success">
                    Se disparó la primera lectura de reporting de Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible sincronizar Search Console" type="danger">
                    Revisá la conexión de Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSearchConsoleSyncLoading(false)
        }
    }

    const handleSearchConsoleIncrementalSync = async () => {
        if (!searchConsoleConnection?.id) {
            return
        }

        setSearchConsoleSyncLoading(true)
        try {
            await apiRunSearchConsoleIncrementalSync<AnalyticsSearchConsoleSyncResult>(
                searchConsoleConnection.id,
            )
            toast.push(
                <Notification title="Incremental Search Console ejecutado" type="success">
                    Se actualizó la ventana incremental de Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar incremental Search Console" type="danger">
                    Revisá la conexión de Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSearchConsoleSyncLoading(false)
        }
    }

    const handleSearchConsoleBackfill = async () => {
        if (!searchConsoleConnection?.id) {
            return
        }

        const from = window.prompt('Backfill Search Console - fecha desde (YYYY-MM-DD)', '')
        const to = window.prompt('Backfill Search Console - fecha hasta (YYYY-MM-DD)', '')
        if (!from || !to) {
            return
        }

        setSearchConsoleSyncLoading(true)
        setBackfillLoading(true)
        try {
            await apiRunSearchConsoleBackfill<AnalyticsSearchConsoleSyncResult>(
                searchConsoleConnection.id,
                from,
                to,
            )
            toast.push(
                <Notification title="Backfill Search Console ejecutado" type="success">
                    Se reprocesó el rango solicitado.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar backfill Search Console" type="danger">
                    Revisá el rango y la conexión de Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setBackfillLoading(false)
            setSearchConsoleSyncLoading(false)
        }
    }

    const handleSearchConsoleRepair = async () => {
        if (!searchConsoleConnection?.id) {
            return
        }

        setSearchConsoleSyncLoading(true)
        setRepairLoading(true)
        try {
            await apiRunSearchConsoleRepair<AnalyticsSearchConsoleSyncResult>(
                searchConsoleConnection.id,
            )
            toast.push(
                <Notification title="Repair Search Console ejecutado" type="success">
                    Se reintentó la última ventana fallida o el último rango útil.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar repair Search Console" type="danger">
                    Revisá el estado de la conexión Search Console.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setRepairLoading(false)
            setSearchConsoleSyncLoading(false)
        }
    }

    const handleAdsInitialSync = async () => {
        if (!adsConnection?.id) {
            return
        }

        setAdsSyncLoading(true)
        try {
            await apiRunAdsInitialSync<AnalyticsAdsSyncResult>(adsConnection.id)
            toast.push(
                <Notification title="Initial sync Ads ejecutado" type="success">
                    Se disparó la primera lectura de reporting de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible sincronizar Ads" type="danger">
                    Revisá la conexión de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setAdsSyncLoading(false)
        }
    }

    const handlePropertySelection = async () => {
        if (!ga4Connection?.id || !selectedPropertyId) {
            return
        }

        setGa4SyncLoading(true)
        try {
            const response = await apiSelectGa4Property<AnalyticsGa4SyncResult>(
                ga4Connection.id,
                selectedPropertyId,
            )
            toast.push(
                <Notification title="GA4 sincronizado" type="success">
                    Se seleccionó la property y se lanzó el initial sync.
                </Notification>,
                { placement: 'top-end' },
            )

            if (response.data?.syncRun?.id) {
                await reload()
                setGa4Properties([])
            }
        } catch (selectionError) {
            console.error(selectionError)
            toast.push(
                <Notification title="No fue posible guardar la property" type="danger">
                    Revisá la cuenta de Google y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setGa4SyncLoading(false)
        }
    }

    const handleManualInitialSync = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setGa4SyncLoading(true)
        try {
            await apiRunGa4InitialSync<AnalyticsGa4SyncResult>(ga4Connection.id)
            toast.push(
                <Notification title="Initial sync ejecutado" type="success">
                    Se disparó un nuevo sync inicial.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible sincronizar" type="danger">
                    Revisá el estado de la conexión GA4.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setGa4SyncLoading(false)
        }
    }

    const handleIncrementalSync = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setGa4SyncLoading(true)
        try {
            await apiRunGa4IncrementalSync<AnalyticsGa4SyncResult>(ga4Connection.id)
            toast.push(
                <Notification title="Incremental sync ejecutado" type="success">
                    Se actualizó la ventana incremental de GA4.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar incremental" type="danger">
                    Revisá la conexión GA4.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setGa4SyncLoading(false)
        }
    }

    const handleBackfill = async () => {
        if (!ga4Connection?.id) {
            return
        }

        const from = window.prompt('Backfill GA4 - fecha desde (YYYY-MM-DD)', '')
        const to = window.prompt('Backfill GA4 - fecha hasta (YYYY-MM-DD)', '')
        if (!from || !to) {
            return
        }

        setGa4SyncLoading(true)
        setBackfillLoading(true)
        try {
            await apiRunGa4Backfill<AnalyticsGa4SyncResult>(ga4Connection.id, from, to)
            toast.push(
                <Notification title="Backfill ejecutado" type="success">
                    Se reprocesó el rango solicitado.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar backfill" type="danger">
                    Revisá el rango y la conexión GA4.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setBackfillLoading(false)
            setGa4SyncLoading(false)
        }
    }

    const handleRepair = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setGa4SyncLoading(true)
        setRepairLoading(true)
        try {
            await apiRunGa4Repair<AnalyticsGa4SyncResult>(ga4Connection.id)
            toast.push(
                <Notification title="Repair ejecutado" type="success">
                    Se reintentó la última ventana fallida o el último rango útil.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar repair" type="danger">
                    Revisá el estado de la conexión GA4.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setRepairLoading(false)
            setGa4SyncLoading(false)
        }
    }

    const handleAdsIncrementalSync = async () => {
        if (!adsConnection?.id) {
            return
        }

        setAdsSyncLoading(true)
        try {
            await apiRunAdsIncrementalSync<AnalyticsAdsSyncResult>(adsConnection.id)
            toast.push(
                <Notification title="Incremental Ads ejecutado" type="success">
                    Se actualizó la ventana incremental de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar incremental Ads" type="danger">
                    Revisá la conexión de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setAdsSyncLoading(false)
        }
    }

    const handleAdsBackfill = async () => {
        if (!adsConnection?.id) {
            return
        }

        const from = window.prompt('Backfill Ads - fecha desde (YYYY-MM-DD)', '')
        const to = window.prompt('Backfill Ads - fecha hasta (YYYY-MM-DD)', '')
        if (!from || !to) {
            return
        }

        setAdsSyncLoading(true)
        setBackfillLoading(true)
        try {
            await apiRunAdsBackfill<AnalyticsAdsSyncResult>(adsConnection.id, from, to)
            toast.push(
                <Notification title="Backfill Ads ejecutado" type="success">
                    Se reprocesó el rango solicitado.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar backfill Ads" type="danger">
                    Revisá el rango y la conexión de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setBackfillLoading(false)
            setAdsSyncLoading(false)
        }
    }

    const handleAdsRepair = async () => {
        if (!adsConnection?.id) {
            return
        }

        setAdsSyncLoading(true)
        setRepairLoading(true)
        try {
            await apiRunAdsRepair<AnalyticsAdsSyncResult>(adsConnection.id)
            toast.push(
                <Notification title="Repair Ads ejecutado" type="success">
                    Se reintentó la última ventana fallida o el último rango útil.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible ejecutar repair Ads" type="danger">
                    Revisá el estado de la conexión de Google Ads.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setRepairLoading(false)
            setAdsSyncLoading(false)
        }
    }

    const propertyOptions: PropertyOption[] = ga4Properties.map((property) => ({
        label: `${property.propertyName} · ${property.accountName}`,
        value: property.propertyId,
    }))
    const searchConsolePropertyOptions: PropertyOption[] = searchConsoleProperties.map((property) => ({
        label: `${property.siteUrl}${property.permissionLevel ? ` · ${property.permissionLevel}` : ''}`,
        value: property.siteUrl,
    }))

    return (
        <AnalyticsPageLayout
            title="Conexiones"
            subtitle="Estado operativo de fuentes, sincronizaciones e insights trazables."
            showControls={false}
        >
            <Loading loading={loading}>
                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h4 className="m-0">Panel operativo</h4>
                                    <Badge
                                        content="analytics"
                                        innerClass="bg-indigo-100 text-indigo-700"
                                    />
                                </div>
                                <p className="max-w-3xl text-sm text-gray-600">
                                    Esta superficie administra el estado de GA4, Google Ads y Search Console
                                    sin exponer tokens al frontend. La prioridad inicial es GA4 para validar
                                    comportamiento onsite y el embudo; Ads y Search Console quedan preparados
                                    para CAC, ROAS y SEO.
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span>{toCountLabel(connections.length, 'conexión', 'conexiones')}</span>
                                    <span>{toCountLabel(runs.length, 'sync run', 'sync runs')}</span>
                                    <span>{toCountLabel(openInsights.length, 'insight abierto', 'insights abiertos')}</span>
                                </div>
                                {error ? (
                                    <div className="text-sm text-rose-600">{error}</div>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    size="sm"
                                    variant="plain"
                                    icon={<HiOutlineExternalLink />}
                                    onClick={() => {
                                        window.location.href = '/app/analytics/insights'
                                    }}
                                >
                                    Insights IA
                                </Button>
                                <Button
                                    size="sm"
                                    variant="solid"
                                    onClick={() => void handleStartOAuth('ga4')}
                                    loading={ga4OauthLoading}
                                >
                                    Conectar GA4
                                </Button>
                                <Button
                                    size="sm"
                                    variant="solid"
                                    onClick={() => void handleStartOAuth('ads')}
                                    loading={adsOauthLoading}
                                >
                                    Conectar Google Ads
                                </Button>
                                <Button
                                    size="sm"
                                    variant="solid"
                                    onClick={() => void handleSearchConsoleOAuth()}
                                    loading={searchConsoleOauthLoading}
                                >
                                    Conectar Search Console
                                </Button>
                                <Button
                                    size="sm"
                                    variant="solid"
                                    icon={<HiOutlineRefresh />}
                                    onClick={() => void reload()}
                                    disabled={refreshing}
                                >
                                    {refreshing ? 'Actualizando' : 'Actualizar'}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="xl:col-span-2">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h5 className="mb-1">Conexiones</h5>
                                    <p className="text-sm text-gray-500">
                                        Estado, target conectado y ventanas de sincronización.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {connections.length ? (
                                    connections.map((connection) => {
                                        const awaitingProperty =
                                            (connection.source === 'ga4' ||
                                                connection.source === 'search_console') &&
                                            !connection.target.id
                                        return (
                                            <div
                                                key={connection.id}
                                                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-700/40"
                                            >
                                                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="font-semibold">
                                                                {sourceLabel[connection.source] ?? connection.source}
                                                            </div>
                                                            <Badge
                                                                content={
                                                                    awaitingProperty
                                                                        ? 'awaiting_property'
                                                                        : connection.status
                                                                }
                                                                innerClass={statusTone(connection.status)}
                                                            />
                                                            {connection.needsReauth ? (
                                                                <Badge
                                                                    content="reauth"
                                                                    innerClass="bg-amber-100 text-amber-700"
                                                                />
                                                            ) : null}
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-600">
                                                            Target: {connection.target.name}
                                                            {connection.target.id ? ` · ${connection.target.id}` : ''}
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-2 text-sm text-gray-600 xl:grid-cols-2">
                                                        <div>
                                                            <span className="font-medium text-gray-700">Última sync:</span>{' '}
                                                            {formatDateTime(connection.lastSyncAt)}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-700">Próxima sync:</span>{' '}
                                                            {formatDateTime(connection.nextSyncAt)}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-700">Lag:</span>{' '}
                                                            {formatLag(connection.health.lagMinutes)}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-700">
                                                                Último intento:
                                                            </span>{' '}
                                                            {formatDateTime(connection.health.lastAttemptedSyncAt)}
                                                        </div>
                                                        <div className="xl:col-span-2">
                                                            <span className="font-medium text-gray-700">
                                                                Último error:
                                                            </span>{' '}
                                                            {connection.health.lastErrorMessage ?? 'n/a'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {awaitingProperty && connection.source === 'ga4' ? (
                                                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                                                        <div>
                                                            <div className="mb-2 text-sm font-medium text-gray-700">
                                                                Seleccionar property GA4
                                                            </div>
                                                            <Select<PropertyOption>
                                                                options={propertyOptions}
                                                                value={
                                                                    propertyOptions.find(
                                                                        (option) =>
                                                                            option.value === selectedPropertyId,
                                                                    ) ?? null
                                                                }
                                                                onChange={(option) =>
                                                                    setSelectedPropertyId(option?.value ?? null)
                                                                }
                                                                isSearchable
                                                                size="sm"
                                                                placeholder={
                                                                    propertiesLoading
                                                                        ? 'Cargando properties...'
                                                                        : 'Elegí una property'
                                                                }
                                                                isDisabled={propertiesLoading || !propertyOptions.length}
                                                            />
                                                            <div className="mt-2 text-xs text-gray-500">
                                                                {propertiesLoading
                                                                    ? 'Consultando propiedades accesibles en Google.'
                                                                    : propertyOptions.length
                                                                      ? `${propertyOptions.length} properties disponibles.`
                                                                      : 'No hay properties cargadas todavía.'}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="solid"
                                                                onClick={() => void handlePropertySelection()}
                                                                loading={ga4SyncLoading}
                                                                disabled={!selectedPropertyId}
                                                            >
                                                                Guardar y sincronizar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="plain"
                                                                onClick={() => void loadProperties(connection.id)}
                                                                loading={propertiesLoading}
                                                            >
                                                                Recargar properties
                                                            </Button>
                                                            </div>
                                                        </div>
                                                ) : awaitingProperty && connection.source === 'search_console' ? (
                                                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                                                        <div>
                                                            <div className="mb-2 text-sm font-medium text-gray-700">
                                                                Seleccionar property Search Console
                                                            </div>
                                                            <Select<PropertyOption>
                                                                options={searchConsolePropertyOptions}
                                                                value={
                                                                    searchConsolePropertyOptions.find(
                                                                        (option) =>
                                                                            option.value ===
                                                                            selectedSearchConsolePropertyId,
                                                                    ) ?? null
                                                                }
                                                                onChange={(option) =>
                                                                    setSelectedSearchConsolePropertyId(
                                                                        option?.value ?? null,
                                                                    )
                                                                }
                                                                isSearchable
                                                                size="sm"
                                                                placeholder={
                                                                    propertiesLoading
                                                                        ? 'Cargando properties...'
                                                                        : 'Elegí una property'
                                                                }
                                                                isDisabled={
                                                                    propertiesLoading ||
                                                                    !searchConsolePropertyOptions.length
                                                                }
                                                            />
                                                            <div className="mt-2 text-xs text-gray-500">
                                                                {propertiesLoading
                                                                    ? 'Consultando propiedades accesibles en Google.'
                                                                    : searchConsolePropertyOptions.length
                                                                      ? `${searchConsolePropertyOptions.length} properties disponibles.`
                                                                      : 'No hay properties cargadas todavía.'}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="solid"
                                                                onClick={() => void handleSearchConsolePropertySelection()}
                                                                loading={searchConsoleSyncLoading}
                                                                disabled={!selectedSearchConsolePropertyId}
                                                            >
                                                                Guardar y sincronizar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="plain"
                                                                onClick={() =>
                                                                    void loadSearchConsoleProperties(connection.id)
                                                                }
                                                                loading={propertiesLoading}
                                                            >
                                                                Recargar properties
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : connection.source === 'ga4' ? (
                                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() => void loadProperties(connection.id)}
                                                            loading={propertiesLoading}
                                                        >
                                                            Recargar properties
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            onClick={() => void handleManualInitialSync()}
                                                            loading={ga4SyncLoading}
                                                        >
                                                            Ejecutar initial sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleIncrementalSync()}
                                                            loading={ga4SyncLoading}
                                                        >
                                                            Incremental sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleBackfill()}
                                                            loading={backfillLoading}
                                                        >
                                                            Backfill
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleRepair()}
                                                            loading={repairLoading}
                                                        >
                                                            Repair
                                                        </Button>
                                                    </div>
                                                ) : connection.source === 'search_console' ? (
                                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                                        <div className="rounded-full bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-100">
                                                            Reporting-only de SEO y demanda orgánica.
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() =>
                                                                void loadSearchConsoleProperties(connection.id)
                                                            }
                                                            loading={propertiesLoading}
                                                        >
                                                            Recargar properties
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            onClick={() => void handleSearchConsoleInitialSync()}
                                                            loading={searchConsoleSyncLoading}
                                                        >
                                                            Ejecutar initial sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleSearchConsoleIncrementalSync()}
                                                            loading={searchConsoleSyncLoading}
                                                        >
                                                            Incremental sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleSearchConsoleBackfill()}
                                                            loading={backfillLoading}
                                                        >
                                                            Backfill
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleSearchConsoleRepair()}
                                                            loading={repairLoading}
                                                        >
                                                            Repair
                                                        </Button>
                                                    </div>
                                                ) : connection.source === 'ads' ? (
                                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                                        <div className="rounded-full bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-500/10 dark:text-sky-100">
                                                            Lectura reporting-only con Explorer Access. No muta campañas.
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            onClick={() => void handleAdsInitialSync()}
                                                            loading={adsSyncLoading}
                                                        >
                                                            Ejecutar initial sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleAdsIncrementalSync()}
                                                            loading={adsSyncLoading}
                                                        >
                                                            Incremental sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleAdsBackfill()}
                                                            loading={backfillLoading}
                                                        >
                                                            Backfill
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => void handleAdsRepair()}
                                                            loading={repairLoading}
                                                        >
                                                            Repair
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:bg-gray-700/40">
                                        No hay conexiones creadas todavía. El panel ya está listo para mostrar
                                        el estado operativo apenas se conecte GA4, Ads o Search Console.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card>
                                <div className="mb-3">
                                    <h5 className="mb-1">Prioridad de fuentes</h5>
                                    <p className="text-sm text-gray-500">
                                        Orden recomendado para esta base de negocio.
                                    </p>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                        <div className="font-medium">1. GA4</div>
                                        <div className="text-gray-500">
                                            Comportamiento onsite, funnel y validación del ecommerce.
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                        <div className="font-medium">2. Google Ads</div>
                                        <div className="text-gray-500">
                                            CAC, ROAS y lectura de campañas pagas.
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                        <div className="font-medium">3. Search Console</div>
                                        <div className="text-gray-500">
                                            SEO, demanda orgánica y oportunidades de contenido.
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card>
                                <div className="mb-3">
                                    <h5 className="mb-1">Salud rápida</h5>
                                    <p className="text-sm text-gray-500">
                                        Semáforo operativo sobre el estado actual.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-gray-600">Listas para operar</span>
                                        <Badge
                                            content={String(readyConnections.length)}
                                            innerClass="bg-emerald-100 text-emerald-700"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-gray-600">Reautenticación</span>
                                        <Badge
                                            content={String(reauthConnections.length)}
                                            innerClass={
                                                reauthConnections.length
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-600'
                                            }
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                            <div className="mb-4">
                                <h5 className="mb-1">Sync runs</h5>
                                <p className="text-sm text-gray-500">
                                    Trazabilidad de iniciales, incrementales, backfills y repairs.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {runs.length ? (
                                    runs.map((run) => (
                                        <div
                                            key={run.id}
                                            className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-medium">{run.jobType}</div>
                                                <Badge
                                                    content={run.status}
                                                    innerClass={statusTone(run.status)}
                                                />
                                            </div>
                                            <div className="mt-2 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                                                <div>Connection: {run.connectionId}</div>
                                                <div>
                                                    Periodo: {formatDateTime(run.fromDate)} - {formatDateTime(run.toDate)}
                                                </div>
                                                <div>Fetched: {run.recordsFetched}</div>
                                                <div>Upserted: {run.recordsUpserted}</div>
                                                <div>Inicio: {formatDateTime(run.startedAt)}</div>
                                                <div>Fin: {formatDateTime(run.finishedAt)}</div>
                                            </div>
                                            {run.errorMessage ? (
                                                <div className="mt-2 text-sm text-rose-600">
                                                    {run.errorMessage}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:bg-gray-700/40">
                                        Todavía no hay ejecuciones registradas.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <div className="mb-4">
                                <h5 className="mb-1">Insights</h5>
                                <p className="text-sm text-gray-500">
                                    Hallazgos con evidencia, rango y recomendación.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {insights.length ? (
                                    insights.map((insight) => (
                                        <div
                                            key={insight.id}
                                            className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-medium">{insight.title}</div>
                                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                                                        {insight.metric}
                                                        {insight.dimension ? ` · ${insight.dimension}` : ''}
                                                    </div>
                                                </div>
                                                <Badge
                                                    content={`${insight.impact} · ${Math.round(insight.confidence * 100)}%`}
                                                    innerClass={impactTone(insight.impact)}
                                                />
                                            </div>
                                            <p className="mt-2 text-sm text-gray-600">{insight.description}</p>
                                            <p className="mt-2 text-sm text-gray-700">
                                                <span className="font-medium">Recomendación:</span>{' '}
                                                {insight.recommendation}
                                            </p>
                                            <div className="mt-2 text-xs text-gray-500">
                                                {renderEvidence(insight.evidence)}
                                            </div>
                                            <div className="mt-2 text-xs text-gray-400">
                                                Creado: {formatDateTime(insight.createdAt)}
                                                {insight.resolvedAt ? ` · Resuelto: ${formatDateTime(insight.resolvedAt)}` : ''}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:bg-gray-700/40">
                                        No hay insights persistidos todavía. La capa queda lista para reglas y IA
                                        sobre métricas normalizadas.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsConnectionsPage
