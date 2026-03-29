import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Switcher from '@/components/ui/Switcher'
import Alert from '@/components/ui/Alert'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { FormContainer, FormItem } from '@/components/ui/Form'
import { HiClipboardCopy, HiEye, HiEyeOff } from 'react-icons/hi'
import {
    apiGetMetaChannelOverview,
    apiSyncMetaChannelConfig,
    apiUpdateMetaChannelConfig,
    type MetaChannelConfig,
    type MetaChannelOverview,
} from '@/services/MetaChannelService'

const defaultConfig: MetaChannelConfig = {
    enabled: true,
    messengerEnabled: true,
    instagramEnabled: true,
    publicBaseUrl: '',
    pageId: '',
    instagramBusinessAccountId: '',
    appId: '',
    verifyToken: '',
    appSecret: '',
    pageAccessToken: '',
    messengerPageAccessToken: '',
    instagramAccessToken: '',
}

const toneClass = (ready: boolean) =>
    ready
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700'

const maskBoolean = (value: boolean) => (value ? 'Presente' : 'Falta')

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

const buildSecretSuffix = (
    isVisible: boolean,
    canToggle: boolean,
    canCopy: boolean,
    onToggle: () => void,
    onCopy: () => void,
) => (
    <div className="flex items-center gap-2 pr-2">
        <Button
            type="button"
            size="xs"
            variant="plain"
            className="text-gray-600"
            disabled={!canCopy}
            onClick={onCopy}
        >
            <HiClipboardCopy className="text-lg" />
        </Button>
        <Button
            type="button"
            size="xs"
            variant="plain"
            className="text-gray-600"
            disabled={!canToggle}
            onClick={onToggle}
        >
            {isVisible ? (
                <HiEyeOff className="text-lg" />
            ) : (
                <HiEye className="text-lg" />
            )}
        </Button>
    </div>
)

const SecretValuePreview = ({
    visible,
    value,
}: {
    visible: boolean
    value: string | null | undefined
}) => {
    if (!visible || !value) {
        return null
    }

    return (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs break-all text-gray-700">
            {value}
        </div>
    )
}

const MetaChannelsSettings = () => {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [overview, setOverview] = useState<MetaChannelOverview | null>(null)
    const [form, setForm] = useState<MetaChannelConfig>(defaultConfig)
    const [showVerifyToken, setShowVerifyToken] = useState(false)
    const [showAppSecret, setShowAppSecret] = useState(false)
    const [showPageToken, setShowPageToken] = useState(false)
    const [showMessengerToken, setShowMessengerToken] = useState(false)
    const [showInstagramToken, setShowInstagramToken] = useState(false)

    const loadOverview = useCallback(async () => {
        setLoading(true)
        try {
            const response = await apiGetMetaChannelOverview()
            setOverview(response.data)
            setForm({
                ...response.data.config,
                publicBaseUrl: response.data.config.publicBaseUrl ?? '',
                pageId: response.data.config.pageId ?? '',
                instagramBusinessAccountId:
                    response.data.config.instagramBusinessAccountId ?? '',
                appId: response.data.config.appId ?? '',
                verifyToken: response.data.config.verifyToken ?? '',
                appSecret: response.data.config.appSecret ?? '',
                pageAccessToken: response.data.config.pageAccessToken ?? '',
                messengerPageAccessToken:
                    response.data.config.messengerPageAccessToken ?? '',
                instagramAccessToken:
                    response.data.config.instagramAccessToken ?? '',
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible cargar Meta">
                    Revisá la conectividad entre backend y channel-adapter.
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

    const syncOverview = useCallback((next: MetaChannelOverview) => {
        setOverview(next)
        setForm({
            ...next.config,
            publicBaseUrl: next.config.publicBaseUrl ?? '',
            pageId: next.config.pageId ?? '',
            instagramBusinessAccountId:
                next.config.instagramBusinessAccountId ?? '',
            appId: next.config.appId ?? '',
            verifyToken: next.config.verifyToken ?? '',
            appSecret: next.config.appSecret ?? '',
            pageAccessToken: next.config.pageAccessToken ?? '',
            messengerPageAccessToken:
                next.config.messengerPageAccessToken ?? '',
            instagramAccessToken: next.config.instagramAccessToken ?? '',
        })
    }, [])

    const saveConfig = useCallback(async () => {
        setSaving(true)
        try {
            const response = await apiUpdateMetaChannelConfig({
                ...form,
                publicBaseUrl: form.publicBaseUrl || null,
                pageId: form.pageId || null,
                instagramBusinessAccountId:
                    form.instagramBusinessAccountId || null,
                appId: form.appId || null,
                verifyToken: form.verifyToken || null,
                appSecret: form.appSecret || null,
                pageAccessToken: form.pageAccessToken || null,
                messengerPageAccessToken:
                    form.messengerPageAccessToken || null,
                instagramAccessToken: form.instagramAccessToken || null,
            })
            syncOverview(response.data)
            toast.push(
                <Notification type="success" title="Meta actualizado">
                    La configuración del canal quedó guardada.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible guardar">
                    Revisá la URL pública y los identificadores del canal.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [form, syncOverview])

    const syncConfig = useCallback(async () => {
        setSaving(true)
        try {
            const response = await apiSyncMetaChannelConfig()
            syncOverview(response.data)
            toast.push(
                <Notification type="success" title="Meta sincronizado">
                    El estado del canal quedó refrescado contra el adapter.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible sincronizar">
                    Revisá el estado del backend y del channel-adapter.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [syncOverview])

    const webhookUrl = useMemo(() => {
        const base = form.publicBaseUrl?.trim()
        if (!base) {
            return ''
        }
        return `${base.replace(/\/$/, '')}/webhooks/meta`
    }, [form.publicBaseUrl])

    const copySecret = useCallback(async (value: string | null | undefined, label: string) => {
        if (!value) {
            return
        }
        try {
            await navigator.clipboard.writeText(value)
            toast.push(
                <Notification type="success" title="Valor copiado">
                    {label}
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible copiar">
                    Intentá nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }, [])

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h4 className="m-0">Meta Channels</h4>
                            <Badge
                                className="capitalize"
                                content={
                                    overview?.status.webhookInboundReady
                                        ? 'ready'
                                        : 'needs_attention'
                                }
                                innerClass={toneClass(
                                    Boolean(overview?.status.webhookInboundReady),
                                )}
                            />
                        </div>
                        <p className="text-sm text-gray-600">
                            Gestión unificada para Facebook Messenger e Instagram.
                            El adapter sólo transporta mensajes; el runtime sigue
                            siendo el núcleo conversacional.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>Fuente: {overview?.meta.source ?? 'n/a'}</span>
                            <span>Actualizado: {formatDateTime(overview?.meta.updatedAt ?? null)}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void loadOverview()} loading={saving}>
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            onClick={() => void syncConfig()}
                            loading={saving}
                        >
                            Sync
                        </Button>
                    </div>
                </div>
            </Card>

            <Alert type="info" showIcon>
                Configurar el webhook público en Meta significa registrar una URL
                externa accesible que apunte a <code>/webhooks/meta</code>. Meta
                envía ahí los mensajes entrantes y usa el verify token para validar
                la suscripción inicial.
            </Alert>

            <Card>
                <h5 className="mb-4">Configuración operativa</h5>
                <FormContainer>
                    <div className="grid gap-4 md:grid-cols-2">
                        <FormItem label="Canal Meta habilitado">
                            <Switcher
                                checked={form.enabled}
                                onChange={(checked) =>
                                    setForm((current) => ({ ...current, enabled: checked }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Messenger habilitado">
                            <Switcher
                                checked={form.messengerEnabled}
                                onChange={(checked) =>
                                    setForm((current) => ({
                                        ...current,
                                        messengerEnabled: checked,
                                    }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Instagram habilitado">
                            <Switcher
                                checked={form.instagramEnabled}
                                onChange={(checked) =>
                                    setForm((current) => ({
                                        ...current,
                                        instagramEnabled: checked,
                                    }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Base URL pública">
                            <Input
                                value={form.publicBaseUrl ?? ''}
                                placeholder="https://tu-dominio-publico"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        publicBaseUrl: event.target.value,
                                    }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Meta App ID">
                            <Input
                                value={form.appId ?? ''}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        appId: event.target.value,
                                    }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Facebook Page ID">
                            <Input
                                value={form.pageId ?? ''}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        pageId: event.target.value,
                                    }))
                                }
                            />
                        </FormItem>
                        <FormItem label="Instagram Business Account ID">
                            <Input
                                value={form.instagramBusinessAccountId ?? ''}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        instagramBusinessAccountId:
                                            event.target.value,
                                    }))
                                }
                            />
                        </FormItem>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="solid"
                            onClick={() => void saveConfig()}
                            loading={saving}
                        >
                            Guardar
                        </Button>
                    </div>
                </FormContainer>
            </Card>

            <Card>
                <h5 className="mb-4">Credenciales sensibles</h5>
                <div className="mb-4 text-sm text-gray-600">
                    Estos valores se guardan en configuración sensible cifrada en
                    backend. Se muestran ocultos por defecto.
                </div>
                <FormContainer>
                    <div className="grid gap-4 md:grid-cols-2">
                        <FormItem label="Verify Token">
                            <Input
                                autoComplete="off"
                                type={form.verifyToken ? (showVerifyToken ? 'text' : 'password') : 'text'}
                                value={form.verifyToken ?? ''}
                                placeholder={
                                    overview?.status.verifyTokenPresent
                                        ? showVerifyToken
                                            ? 'Configurado externamente. Pegá un nuevo valor para reemplazarlo.'
                                            : '********'
                                        : ''
                                }
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        verifyToken: event.target.value,
                                    }))
                                }
                                suffix={buildSecretSuffix(
                                    showVerifyToken,
                                    Boolean(form.verifyToken || overview?.status.verifyTokenPresent),
                                    Boolean(form.verifyToken),
                                    () => setShowVerifyToken((value) => !value),
                                    () => void copySecret(form.verifyToken, 'Verify Token copiado'),
                                )}
                            />
                            <SecretValuePreview
                                visible={showVerifyToken}
                                value={form.verifyToken}
                            />
                            {!form.verifyToken && overview?.status.verifyTokenPresent ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    El verify token ya está configurado, pero no se reexpone por seguridad.
                                    Si querés cambiarlo, ingresá uno nuevo y guardá.
                                </p>
                            ) : null}
                        </FormItem>
                        <FormItem label="App Secret">
                            <Input
                                autoComplete="off"
                                type={form.appSecret ? (showAppSecret ? 'text' : 'password') : 'text'}
                                value={form.appSecret ?? ''}
                                placeholder={
                                    overview?.status.appSecretPresent
                                        ? showAppSecret
                                            ? 'Configurado externamente. Pegá un nuevo valor para reemplazarlo.'
                                            : '********'
                                        : ''
                                }
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        appSecret: event.target.value,
                                    }))
                                }
                                suffix={buildSecretSuffix(
                                    showAppSecret,
                                    Boolean(form.appSecret || overview?.status.appSecretPresent),
                                    Boolean(form.appSecret),
                                    () => setShowAppSecret((value) => !value),
                                    () => void copySecret(form.appSecret, 'App Secret copiado'),
                                )}
                            />
                            <SecretValuePreview
                                visible={showAppSecret}
                                value={form.appSecret}
                            />
                            {!form.appSecret && overview?.status.appSecretPresent ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    El app secret está configurado, pero no se reexpone por seguridad.
                                    Si querés cambiarlo, ingresá uno nuevo y guardá.
                                </p>
                            ) : null}
                        </FormItem>
                        <FormItem label="Meta Page Access Token">
                            <Input
                                autoComplete="off"
                                type={form.pageAccessToken ? (showPageToken ? 'text' : 'password') : 'text'}
                                value={form.pageAccessToken ?? ''}
                                placeholder={
                                    overview?.status.messenger.pageAccessTokenPresent
                                        ? showPageToken
                                            ? 'Configurado externamente. Pegá un nuevo valor para reemplazarlo.'
                                            : '********'
                                        : ''
                                }
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        pageAccessToken: event.target.value,
                                    }))
                                }
                                suffix={buildSecretSuffix(
                                    showPageToken,
                                    Boolean(
                                        form.pageAccessToken ||
                                            overview?.status.messenger.pageAccessTokenPresent,
                                    ),
                                    Boolean(form.pageAccessToken),
                                    () => setShowPageToken((value) => !value),
                                    () =>
                                        void copySecret(
                                            form.pageAccessToken,
                                            'Meta Page Access Token copiado',
                                        ),
                                )}
                            />
                            <SecretValuePreview
                                visible={showPageToken}
                                value={form.pageAccessToken}
                            />
                            {!form.pageAccessToken &&
                            overview?.status.messenger.pageAccessTokenPresent ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    El token de página ya está configurado, pero no se reexpone por seguridad.
                                    Si querés cambiarlo, ingresá uno nuevo y guardá.
                                </p>
                            ) : null}
                        </FormItem>
                        <FormItem label="Messenger Page Access Token">
                            <Input
                                autoComplete="off"
                                type={
                                    form.messengerPageAccessToken
                                        ? showMessengerToken
                                            ? 'text'
                                            : 'password'
                                        : 'text'
                                }
                                value={form.messengerPageAccessToken ?? ''}
                                placeholder={
                                    overview?.status.messenger.pageAccessTokenPresent
                                        ? showMessengerToken
                                            ? 'Configurado externamente. Pegá un nuevo valor para reemplazarlo.'
                                            : '********'
                                        : ''
                                }
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        messengerPageAccessToken:
                                            event.target.value,
                                    }))
                                }
                                suffix={buildSecretSuffix(
                                    showMessengerToken,
                                    Boolean(
                                        form.messengerPageAccessToken ||
                                            overview?.status.messenger.pageAccessTokenPresent,
                                    ),
                                    Boolean(form.messengerPageAccessToken),
                                    () => setShowMessengerToken((value) => !value),
                                    () =>
                                        void copySecret(
                                            form.messengerPageAccessToken,
                                            'Messenger Page Access Token copiado',
                                        ),
                                )}
                            />
                            <SecretValuePreview
                                visible={showMessengerToken}
                                value={form.messengerPageAccessToken}
                            />
                            {!form.messengerPageAccessToken &&
                            overview?.status.messenger.pageAccessTokenPresent ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    El token de Messenger ya está configurado, pero no se reexpone por seguridad.
                                    Si querés cambiarlo, ingresá uno nuevo y guardá.
                                </p>
                            ) : null}
                        </FormItem>
                        <FormItem label="Instagram Access Token" className="md:col-span-2">
                            <Input
                                autoComplete="off"
                                type={
                                    form.instagramAccessToken
                                        ? showInstagramToken
                                            ? 'text'
                                            : 'password'
                                        : 'text'
                                }
                                value={form.instagramAccessToken ?? ''}
                                placeholder={
                                    overview?.status.instagram.accessTokenPresent
                                        ? showInstagramToken
                                            ? 'Configurado externamente. Pegá un nuevo valor para reemplazarlo.'
                                            : '********'
                                        : ''
                                }
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        instagramAccessToken:
                                            event.target.value,
                                    }))
                                }
                                suffix={buildSecretSuffix(
                                    showInstagramToken,
                                    Boolean(
                                        form.instagramAccessToken ||
                                            overview?.status.instagram.accessTokenPresent,
                                    ),
                                    Boolean(form.instagramAccessToken),
                                    () => setShowInstagramToken((value) => !value),
                                    () =>
                                        void copySecret(
                                            form.instagramAccessToken,
                                            'Instagram Access Token copiado',
                                        ),
                                )}
                            />
                            <SecretValuePreview
                                visible={showInstagramToken}
                                value={form.instagramAccessToken}
                            />
                            {!form.instagramAccessToken &&
                            overview?.status.instagram.accessTokenPresent ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    El token de Instagram ya está configurado, pero no se reexpone por seguridad.
                                    Si querés cambiarlo, ingresá uno nuevo y guardá.
                                </p>
                            ) : null}
                        </FormItem>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="solid"
                            onClick={() => void saveConfig()}
                            loading={saving}
                        >
                            Guardar credenciales
                        </Button>
                    </div>
                </FormContainer>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <h5 className="mb-4">Webhook y secretos</h5>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span>Webhook URL</span>
                            <span className="text-right text-gray-600">
                                {overview?.status.publicWebhookUrl || webhookUrl || 'n/a'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>App ID</span>
                            <span className="text-gray-600">
                                {overview?.status.appId || 'n/a'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Verify token</span>
                            <span className="text-gray-600">
                                {maskBoolean(
                                    Boolean(overview?.status.verifyTokenPresent),
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>App secret</span>
                            <span className="text-gray-600">
                                {maskBoolean(
                                    Boolean(overview?.status.appSecretPresent),
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Webhook inbound ready</span>
                            <Badge
                                content={
                                    overview?.status.webhookInboundReady
                                        ? 'ready'
                                        : 'pending'
                                }
                                innerClass={toneClass(
                                    Boolean(overview?.status.webhookInboundReady),
                                )}
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <h5 className="mb-4">Capacidades</h5>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span>Texto</span>
                            <span className="text-gray-600">
                                {overview?.status.capabilities.text ? 'Sí' : 'No'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Adjuntos</span>
                            <span className="text-gray-600">
                                {overview?.status.capabilities.attachments
                                    ? 'Sí'
                                    : 'No'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Postbacks</span>
                            <span className="text-gray-600">
                                {overview?.status.capabilities.postbacks
                                    ? 'Sí'
                                    : 'No'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Quick replies</span>
                            <span className="text-gray-600">
                                {overview?.status.capabilities.quickReplies
                                    ? 'Sí'
                                    : 'No'}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h5 className="m-0">Facebook Messenger</h5>
                        <Badge
                            content={
                                overview?.status.messenger.outboundReady
                                    ? 'ready'
                                    : 'pending'
                            }
                            innerClass={toneClass(
                                Boolean(overview?.status.messenger.outboundReady),
                            )}
                        />
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span>Page ID</span>
                            <span className="text-gray-600">
                                {overview?.status.messenger.pageId || 'n/a'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Page token</span>
                            <span className="text-gray-600">
                                {maskBoolean(
                                    Boolean(
                                        overview?.status.messenger.pageAccessTokenPresent,
                                    ),
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Inbox CRM</span>
                            <span className="text-gray-600">
                                {overview?.inboxAccounts.messenger?.displayName || 'n/a'}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h5 className="m-0">Instagram Messaging</h5>
                        <Badge
                            content={
                                overview?.status.instagram.outboundReady
                                    ? 'ready'
                                    : 'pending'
                            }
                            innerClass={toneClass(
                                Boolean(overview?.status.instagram.outboundReady),
                            )}
                        />
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span>Business Account ID</span>
                            <span className="text-gray-600">
                                {overview?.status.instagram.businessAccountId || 'n/a'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Access token</span>
                            <span className="text-gray-600">
                                {maskBoolean(
                                    Boolean(
                                        overview?.status.instagram.accessTokenPresent,
                                    ),
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Inbox CRM</span>
                            <span className="text-gray-600">
                                {overview?.inboxAccounts.instagram?.displayName || 'n/a'}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default MetaChannelsSettings
