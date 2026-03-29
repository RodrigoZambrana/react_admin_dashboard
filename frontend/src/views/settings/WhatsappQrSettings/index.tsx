import { useCallback, useEffect, useState } from 'react'
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
import {
    apiBackfillWhatsappQrHistory,
    apiGetWhatsappQrOverview,
    apiReconnectWhatsappQrSession,
    apiResetWhatsappQrSession,
    apiSyncWhatsappQrConfig,
    apiStartWhatsappQrSession,
    apiStopWhatsappQrSession,
    apiUpdateWhatsappQrConfig,
    type WhatsappQrOverview,
    type WhatsappQrChannelConfig,
} from '@/services/WhatsappQrChannelService'

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

const stateTone = (state: string) => {
    switch (state) {
        case 'connected':
            return 'success'
        case 'qr_ready':
        case 'connecting':
        case 'reconnecting':
            return 'warning'
        case 'disabled':
        case 'idle':
        case 'stopped':
            return 'default'
        default:
            return 'danger'
    }
}

const defaultConfig: WhatsappQrChannelConfig = {
    enabled: false,
    displayName: 'WhatsApp QR',
    address: '',
    autoStart: true,
    typingIndicatorEnabled: true,
    presenceIndicatorEnabled: true,
    humanDelayEnabled: true,
    minReplyDelayMs: 3000,
    maxReplyDelayMs: 9000,
    maxOutboundPerHour: 40,
    maxOutboundPerDay: 250,
    reactionsEnabled: true,
    readReceiptsEnabled: true,
    allowProactiveOutbound: false,
    quietHoursStart: '',
    quietHoursEnd: '',
}

const hasConsistencyDrift = (overview: WhatsappQrOverview | null) =>
    Boolean(
        overview &&
            (!overview.consistency.adapterReachable ||
                !overview.consistency.adapterEnabledMatchesConfig ||
                !overview.consistency.inboxActiveMatchesConfig ||
                !overview.consistency.inboxAddressMatchesConfig ||
                !overview.consistency.inboxTransportMatches),
    )

const WhatsappQrSettings = () => {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [overview, setOverview] = useState<WhatsappQrOverview | null>(null)
    const [form, setForm] = useState<WhatsappQrChannelConfig>(defaultConfig)

    const loadOverview = useCallback(async () => {
        setLoading(true)
        try {
            const response = await apiGetWhatsappQrOverview()
            setOverview(response.data)
            setForm({
                ...response.data.config,
                displayName: response.data.config.displayName ?? '',
                address: response.data.config.address ?? '',
                quietHoursStart: response.data.config.quietHoursStart ?? '',
                quietHoursEnd: response.data.config.quietHoursEnd ?? '',
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible cargar WhatsApp QR">
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

    useEffect(() => {
        const timer = window.setInterval(() => {
            void loadOverview()
        }, 10000)
        return () => window.clearInterval(timer)
    }, [loadOverview])

    const syncOverview = useCallback((next: WhatsappQrOverview) => {
        setOverview(next)
        setForm({
            ...next.config,
            displayName: next.config.displayName ?? '',
            address: next.config.address ?? '',
            quietHoursStart: next.config.quietHoursStart ?? '',
            quietHoursEnd: next.config.quietHoursEnd ?? '',
        })
    }, [])

    const saveConfig = useCallback(async () => {
        setSaving(true)
        try {
            const payload = {
                ...form,
                displayName: form.displayName || null,
                address: form.address || null,
                quietHoursStart: form.quietHoursStart || null,
                quietHoursEnd: form.quietHoursEnd || null,
            }
            const response = await apiUpdateWhatsappQrConfig(payload)
            syncOverview(response.data)
            toast.push(
                <Notification type="success" title="WhatsApp QR actualizado">
                    La configuración del canal quedó guardada.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible guardar">
                    Verificá los campos del canal y reintentá.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [form, syncOverview])

    const generateQr = useCallback(async () => {
        setSaving(true)
        try {
            const prepared = await apiUpdateWhatsappQrConfig({
                ...form,
                enabled: true,
                autoStart: true,
                displayName: form.displayName || null,
                address: form.address || null,
                quietHoursStart: form.quietHoursStart || null,
                quietHoursEnd: form.quietHoursEnd || null,
            })
            syncOverview(prepared.data)

            const response = await apiStartWhatsappQrSession()
            syncOverview(response.data)
            toast.push(
                <Notification type="success" title="Generando QR">
                    El canal quedó habilitado y se inició la sesión para vincular la cuenta.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger" title="No fue posible generar el QR">
                    Revisá la configuración del canal y volvé a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSaving(false)
        }
    }, [form, syncOverview])

    const runSessionAction = useCallback(
        async (
            action:
                | 'start'
                | 'stop'
                | 'reconnect'
                | 'reset'
                | 'sync',
        ) => {
            setSaving(true)
            try {
                const response =
                    action === 'sync'
                        ? await apiSyncWhatsappQrConfig()
                        : action === 'start'
                        ? await apiStartWhatsappQrSession()
                        : action === 'stop'
                          ? await apiStopWhatsappQrSession()
                          : action === 'reconnect'
                            ? await apiReconnectWhatsappQrSession()
                            : await apiResetWhatsappQrSession()
                syncOverview(response.data)
            } catch (error) {
                console.error(error)
                toast.push(
                    <Notification type="danger" title="No fue posible ejecutar la acción">
                        Revisá el estado del canal y volvé a intentar.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setSaving(false)
            }
        },
        [syncOverview],
    )

    const consistencyDrift = hasConsistencyDrift(overview)

    if (loading) {
        return <Loading loading />
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h4 className="m-0">WhatsApp QR</h4>
                            <Badge className="capitalize" content={overview?.status.state ?? 'n/a'} innerClass={stateTone(overview?.status.state ?? 'idle') === 'success' ? 'bg-emerald-100 text-emerald-700' : stateTone(overview?.status.state ?? 'idle') === 'warning' ? 'bg-amber-100 text-amber-700' : stateTone(overview?.status.state ?? 'idle') === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'} />
                        </div>
                        <p className="text-sm text-gray-600">
                            Canal transversal por QR, desacoplado del runtime ecommerce y listo
                            para una futura migración a Meta sin reescribir la lógica del chat.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void loadOverview()} loading={saving}>
                            Refrescar
                        </Button>
                        <Button size="sm" variant="solid" onClick={() => void generateQr()} loading={saving}>
                            Generar QR
                        </Button>
                        <Button size="sm" onClick={() => void runSessionAction('sync')} loading={saving}>
                            Sincronizar
                        </Button>
                        <Button size="sm" onClick={async () => {
                            setSaving(true)
                            try {
                                const response = await apiBackfillWhatsappQrHistory()
                                syncOverview(response.data.overview)
                                toast.push(
                                    <Notification type="success" title="Historial sincronizado">
                                        {`Mensajes importados: ${response.data.backfill.importedMessages}. Conversaciones nuevas: ${response.data.backfill.importedConversations}. Hilos detectados desde la sesión: ${response.data.backfill.bootstrappedFromAuth}/${response.data.backfill.authBootstrapCandidates}. Ruido eliminado: ${response.data.cleanup.deletedConversations} conversaciones.`}
                                    </Notification>,
                                    { placement: 'top-end' },
                                )
                            } catch (error) {
                                console.error(error)
                                toast.push(
                                    <Notification type="danger" title="No fue posible sincronizar el historial">
                                        Revisá el estado del canal y reintentá.
                                    </Notification>,
                                    { placement: 'top-end' },
                                )
                            } finally {
                                setSaving(false)
                            }
                        }} loading={saving}>
                            Traer historial
                        </Button>
                        <Button size="sm" onClick={() => void runSessionAction('start')} loading={saving}>
                            Iniciar
                        </Button>
                        <Button size="sm" onClick={() => void runSessionAction('reconnect')} loading={saving}>
                            Reconectar
                        </Button>
                        <Button size="sm" onClick={() => void runSessionAction('stop')} loading={saving}>
                            Detener
                        </Button>
                        <Button size="sm" color="red-500" onClick={() => void runSessionAction('reset')} loading={saving}>
                            Resetear sesión
                        </Button>
                    </div>
                </div>
            </Card>

            {overview?.status.lastError ? (
                <Alert type="danger" showIcon>
                    {overview.status.lastError}
                </Alert>
            ) : null}

            {overview?.status.state === 'disabled' ? (
                <Alert type="info" showIcon>
                    El canal está deshabilitado. Para vincular la cuenta y mostrar el QR,
                    usá “Generar QR”.
                </Alert>
            ) : null}

            {overview?.status.state === 'connecting' ? (
                <Alert type="info" showIcon>
                    Estamos iniciando la sesión. El QR debería aparecer en unos segundos.
                </Alert>
            ) : null}

            {overview?.status.state === 'qr_ready' ? (
                <Alert type="success" showIcon>
                    Escaneá el QR desde WhatsApp en el teléfono que quieras vincular.
                </Alert>
            ) : null}

            {overview?.status.state === 'connected' ? (
                <Alert type="success" showIcon>
                    La cuenta ya está vinculada y el canal quedó operativo.
                </Alert>
            ) : null}

            {overview?.status.history?.lastBackfillResult ? (
                <Alert type="info" showIcon>
                    {`Último backfill: ${overview.status.history.lastBackfillResult.importedMessages} mensajes importados, ${overview.status.history.lastBackfillResult.importedConversations} conversaciones nuevas y ${overview.status.history.lastBackfillResult.bootstrappedFromAuth} hilos recuperados desde el estado local de la sesión.`}
                </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                <Card>
                    <div className="space-y-4">
                        <h5 className="m-0">Configuración del canal</h5>
                        <FormContainer>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <FormItem label="Habilitado">
                                    <Switcher
                                        checked={form.enabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                enabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Auto start">
                                    <Switcher
                                        checked={form.autoStart}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                autoStart: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Nombre visible">
                                    <Input
                                        value={form.displayName ?? ''}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                displayName: event.target.value,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Número / alias">
                                    <Input
                                        value={form.address ?? ''}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                address: event.target.value,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Delay mínimo (ms)">
                                    <Input
                                        type="number"
                                        value={String(form.minReplyDelayMs)}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                minReplyDelayMs: Number(event.target.value || 0),
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Delay máximo (ms)">
                                    <Input
                                        type="number"
                                        value={String(form.maxReplyDelayMs)}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                maxReplyDelayMs: Number(event.target.value || 0),
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Máximo por hora">
                                    <Input
                                        type="number"
                                        value={String(form.maxOutboundPerHour)}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                maxOutboundPerHour: Number(event.target.value || 0),
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Máximo por día">
                                    <Input
                                        type="number"
                                        value={String(form.maxOutboundPerDay)}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                maxOutboundPerDay: Number(event.target.value || 0),
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Franja silenciosa inicio">
                                    <Input
                                        placeholder="22:00"
                                        value={form.quietHoursStart ?? ''}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                quietHoursStart: event.target.value,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Franja silenciosa fin">
                                    <Input
                                        placeholder="08:00"
                                        value={form.quietHoursEnd ?? ''}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                quietHoursEnd: event.target.value,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Typing">
                                    <Switcher
                                        checked={form.typingIndicatorEnabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                typingIndicatorEnabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Presence">
                                    <Switcher
                                        checked={form.presenceIndicatorEnabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                presenceIndicatorEnabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Delay humano">
                                    <Switcher
                                        checked={form.humanDelayEnabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                humanDelayEnabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Permitir proactive outbound">
                                    <Switcher
                                        checked={form.allowProactiveOutbound}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                allowProactiveOutbound: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Reacciones">
                                    <Switcher
                                        checked={form.reactionsEnabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                reactionsEnabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                                <FormItem label="Read receipts">
                                    <Switcher
                                        checked={form.readReceiptsEnabled}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                readReceiptsEnabled: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                            </div>
                            <div className="flex justify-end">
                                <Button variant="solid" onClick={() => void saveConfig()} loading={saving}>
                                    Guardar canal
                                </Button>
                            </div>
                        </FormContainer>
                    </div>
                </Card>

                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="space-y-3">
                            <h5 className="m-0">Sesión</h5>
                            <div className="text-sm text-gray-700">
                                <div>Estado: <strong>{overview?.status.state ?? 'n/a'}</strong></div>
                                <div>Conectado: <strong>{formatDateTime(overview?.status.connectedAt ?? null)}</strong></div>
                                <div>Teléfono: <strong>{overview?.status.connectedPhone ?? 'n/a'}</strong></div>
                                <div>Reintento: <strong>{formatDateTime(overview?.status.reconnectScheduledAt ?? null)}</strong></div>
                                <div>Última desconexión: <strong>{formatDateTime(overview?.status.lastDisconnectAt ?? null)}</strong></div>
                            </div>
                            {overview?.status.qrCodeDataUrl ? (
                                <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4">
                                    <img
                                        src={overview.status.qrCodeDataUrl}
                                        alt="WhatsApp QR"
                                        className="h-72 w-72 rounded-lg bg-white p-3"
                                    />
                                    <span className="text-xs text-gray-500">
                                        QR vigente hasta {formatDateTime(overview.status.qrCodeExpiresAt)}
                                    </span>
                                </div>
                            ) : (
                                <Alert type="info" showIcon>
                                    Cuando la sesión requiera autenticación, el QR aparecerá aquí.
                                </Alert>
                            )}
                        </div>
                    </Card>

                    <Card>
                        <div className="space-y-3">
                            <h5 className="m-0">Canal</h5>
                            <div className="text-sm text-gray-700">
                                <div>Nombre: <strong>{overview?.inboxAccount?.displayName ?? form.displayName ?? 'n/a'}</strong></div>
                                <div>Dirección: <strong>{overview?.inboxAccount?.address ?? form.address ?? 'n/a'}</strong></div>
                            </div>
                        </div>
                    </Card>

                    {consistencyDrift ? (
                        <Card>
                            <div className="space-y-3">
                                <h5 className="m-0">Diagnóstico</h5>
                                <Alert type="warning" showIcon>
                                    Detectamos diferencias entre backend, inbox y adapter.
                                    Usá “Sincronizar” antes de reiniciar o reautenticar el canal.
                                </Alert>
                            </div>
                        </Card>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default WhatsappQrSettings
