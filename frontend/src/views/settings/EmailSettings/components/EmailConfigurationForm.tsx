import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Switcher from '@/components/ui/Switcher'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import Badge from '@/components/ui/Badge'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import {
    apiGetEmailConfig,
    apiUpdateEmailConfig,
    apiSendTestEmailConfig,
    apiGetInboxEmailConfig,
    apiUpdateInboxEmailConfig,
    EmailConfigPayload,
    InboxEmailConfigResponse,
} from '@/services/EmailConfigService'
import { HiOutlineMail } from 'react-icons/hi'

const PROVIDER_OPTIONS = [
    { value: 'SMTP', label: 'SMTP' },
    { value: 'SENDGRID', label: 'SendGrid' },
    { value: 'DEV', label: 'Developer (local file)' },
]

const INBOX_SECURITY_OPTIONS = [
    { value: 'SSL_TLS', label: 'SSL/TLS' },
    { value: 'STARTTLS', label: 'STARTTLS' },
    { value: 'NONE', label: 'None' },
]

type ProviderOptionValue = (typeof PROVIDER_OPTIONS)[number]['value']
type InboxSecurityOption = (typeof INBOX_SECURITY_OPTIONS)[number]['value']

type ProviderDraft = {
    provider: ProviderOptionValue
    fromAddress: string
    fromName: string
    customerEmailsEnabled: boolean
    adminEmailsEnabled: boolean
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    allowInvalidCerts: boolean
    smtpUser: string
    smtpPassword: string
    dirty: boolean
}

type InboxDraft = {
    imapHost: string
    imapPort: string
    imapSecurity: InboxSecurityOption
    smtpHost: string
    smtpPort: string
    smtpSecurity: InboxSecurityOption
    username: string
    password: string
    fromAddress: string
    fromName: string
    maxAttachmentSizeMb: string
    ratePerMinute: string
    pollIntervalMs: string
    pollBatchSize: string
    dirty: boolean
}

type InboxMeta = {
    source: 'environment' | 'database'
    updatedAt: string | null
    passwordSet: boolean
}

const DEFAULT_PROVIDER_DRAFT: ProviderDraft = {
    provider: 'DEV',
    fromAddress: '',
    fromName: '',
    customerEmailsEnabled: true,
    adminEmailsEnabled: true,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    allowInvalidCerts: false,
    smtpUser: '',
    smtpPassword: '',
    dirty: false,
}

const DEFAULT_INBOX_DRAFT: InboxDraft = {
    imapHost: '',
    imapPort: '',
    imapSecurity: 'SSL_TLS',
    smtpHost: '',
    smtpPort: '',
    smtpSecurity: 'STARTTLS',
    username: '',
    password: '',
    fromAddress: '',
    fromName: '',
    maxAttachmentSizeMb: '',
    ratePerMinute: '',
    pollIntervalMs: '',
    pollBatchSize: '',
    dirty: false,
}

const formatTimestamp = (value: string | null) => {
    if (!value) return null
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    } catch {
        return value
    }
}

const EmailConfigurationForm = () => {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingInbox, setSavingInbox] = useState(false)
    const [sendingTest, setSendingTest] = useState(false)
    const [providerDraft, setProviderDraft] = useState<ProviderDraft>(DEFAULT_PROVIDER_DRAFT)
    const [inboxDraft, setInboxDraft] = useState<InboxDraft>(DEFAULT_INBOX_DRAFT)
    const [inboxMeta, setInboxMeta] = useState<InboxMeta>({
        source: 'environment',
        updatedAt: null,
        passwordSet: false,
    })
    const [testRecipient, setTestRecipient] = useState('')

    const smtpVisible = useMemo(() => providerDraft.provider === 'SMTP', [providerDraft.provider])
    const inboxUpdatedLabel = useMemo(() => formatTimestamp(inboxMeta.updatedAt), [inboxMeta.updatedAt])

    const load = useCallback(async () => {
        setLoading(true)
        const formatNumber = (value?: number | null) => (value === null || value === undefined ? '' : String(value))
        try {
            const [configResponse, inboxResponse] = await Promise.all([
                apiGetEmailConfig<EmailConfigPayload>(),
                apiGetInboxEmailConfig<InboxEmailConfigResponse>(),
            ])
            const config = configResponse.data
            if (config) {
                setProviderDraft({
                    provider: config.provider,
                    fromAddress: config.fromAddress,
                    fromName: config.fromName,
                    customerEmailsEnabled: config.customerEmailsEnabled ?? true,
                    adminEmailsEnabled: config.adminEmailsEnabled ?? true,
                    smtpHost: config.smtp?.host ?? '',
                    smtpPort: config.smtp?.port ?? 587,
                    smtpSecure: config.smtp?.secure ?? false,
                    allowInvalidCerts: config.smtp?.allowInvalidCerts ?? false,
                    smtpUser: config.smtp?.user ?? '',
                    smtpPassword: '',
                    dirty: false,
                })
            }
            const inbox = inboxResponse.data
            if (inbox) {
                setInboxDraft({
                    imapHost: inbox.imapHost ?? '',
                    imapPort: formatNumber(inbox.imapPort),
                    imapSecurity: inbox.imapSecurity,
                    smtpHost: inbox.smtpHost ?? '',
                    smtpPort: formatNumber(inbox.smtpPort),
                    smtpSecurity: inbox.smtpSecurity,
                    username: inbox.username ?? '',
                    password: '',
                    fromAddress: inbox.fromAddress ?? '',
                    fromName: inbox.fromName ?? '',
                    maxAttachmentSizeMb: formatNumber(inbox.maxAttachmentSizeMb),
                    ratePerMinute: formatNumber(inbox.ratePerMinute),
                    pollIntervalMs: formatNumber(inbox.pollIntervalMs),
                    pollBatchSize: formatNumber(inbox.pollBatchSize),
                    dirty: false,
                })
                setInboxMeta({
                    source: inbox.source,
                    updatedAt: inbox.updatedAt,
                    passwordSet: inbox.passwordSet,
                })
            }
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        load()
    }, [load])

    const handleProviderChange = <K extends keyof ProviderDraft>(key: K, value: ProviderDraft[K]) => {
        setProviderDraft((prev) => ({
            ...prev,
            [key]: value,
            dirty: true,
        }))
    }

    const handleInboxChange = <K extends keyof InboxDraft>(key: K, value: InboxDraft[K]) => {
        setInboxDraft((prev) => ({
            ...prev,
            [key]: value,
            dirty: true,
        }))
    }

    const handleProviderSave = async () => {
        setSaving(true)
        try {
            await apiUpdateEmailConfig({
                provider: providerDraft.provider,
                fromAddress: providerDraft.fromAddress,
                fromName: providerDraft.fromName,
                customerEmailsEnabled: providerDraft.customerEmailsEnabled,
                adminEmailsEnabled: providerDraft.adminEmailsEnabled,
                smtp:
                    providerDraft.provider === 'SMTP'
                        ? {
                              host: providerDraft.smtpHost,
                              port: providerDraft.smtpPort,
                              secure: providerDraft.smtpSecure,
                              allowInvalidCerts: providerDraft.allowInvalidCerts,
                              user: providerDraft.smtpUser || undefined,
                              password: providerDraft.smtpPassword || undefined,
                          }
                        : null,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.config.saveSuccess', { defaultValue: 'Configuration saved successfully.' })}
                </Notification>,
            )
            setProviderDraft((prev) => ({ ...prev, dirty: false, smtpPassword: '' }))
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSaving(false)
        }
    }

    const handleInboxSave = async () => {
        setSavingInbox(true)
        try {
            const parseNumberInput = (value: string) => {
                const trimmed = value?.trim()
                if (!trimmed) {
                    return null
                }
                const parsed = Number(trimmed)
                return Number.isFinite(parsed) ? parsed : null
            }
            await apiUpdateInboxEmailConfig({
                imapHost: inboxDraft.imapHost || null,
                imapPort: parseNumberInput(inboxDraft.imapPort),
                imapSecurity: inboxDraft.imapSecurity,
                smtpHost: inboxDraft.smtpHost || null,
                smtpPort: parseNumberInput(inboxDraft.smtpPort),
                smtpSecurity: inboxDraft.smtpSecurity,
                username: inboxDraft.username || null,
                password: inboxDraft.password || undefined,
                fromAddress: inboxDraft.fromAddress || null,
                fromName: inboxDraft.fromName || null,
                maxAttachmentSizeMb: parseNumberInput(inboxDraft.maxAttachmentSizeMb),
                ratePerMinute: parseNumberInput(inboxDraft.ratePerMinute),
                pollIntervalMs: parseNumberInput(inboxDraft.pollIntervalMs),
                pollBatchSize: parseNumberInput(inboxDraft.pollBatchSize),
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.inbox.saveSuccess', { defaultValue: 'Inbox configuration saved successfully.' })}
                </Notification>,
            )
            setInboxDraft((prev) => ({ ...prev, dirty: false, password: '' }))
            load()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSavingInbox(false)
        }
    }

    const handleSendTest = async () => {
        const email = testRecipient.trim()
        if (!email || !email.includes('@')) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.email.validation.invalidEmail', { defaultValue: 'Enter a valid email address.' })}
                </Notification>,
            )
            return
        }
        setSendingTest(true)
        try {
            await apiSendTestEmailConfig({ to: email })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.config.testSuccess', { defaultValue: 'Test email queued successfully.' })}
                </Notification>,
            )
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSendingTest(false)
        }
    }

    if (loading) {
        return (
            <Card className="flex items-center justify-center py-20">
                <Spinner size={32} />
            </Card>
        )
    }

    return (
        <>
        <Card className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                <div>
                    <h5 className="text-lg font-semibold">
                        {t('settings.email.config.title', { defaultValue: 'Email provider configuration' })}
                    </h5>
                    <p className="text-sm text-gray-500">
                        {t('settings.email.config.description', {
                            defaultValue:
                                'Manage SMTP credentials, sender details, and test connectivity to ensure transactional emails are delivered.',
                        })}
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="plain"
                    icon={<HiOutlineMail />}
                    onClick={handleSendTest}
                    loading={sendingTest}
                    disabled={sendingTest}
                >
                    {t('settings.email.config.sendTest', { defaultValue: 'Send test' })}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded border border-gray-200 p-4">
                    <div className="space-y-1">
                        <span className="text-sm font-semibold text-gray-700">
                            {t('settings.email.config.delivery.customerLabel', { defaultValue: 'Customer deliveries' })}
                        </span>
                        <p className="text-xs text-gray-500">
                            {t('settings.email.config.delivery.customerDescription', {
                                defaultValue: 'Send transactional emails to ecommerce customers.',
                            })}
                        </p>
                    </div>
                    <Switcher
                        checked={providerDraft.customerEmailsEnabled}
                        onChange={(value) => handleProviderChange('customerEmailsEnabled', value)}
                    />
                </div>
                <div className="flex items-start justify-between gap-4 rounded border border-gray-200 p-4">
                    <div className="space-y-1">
                        <span className="text-sm font-semibold text-gray-700">
                            {t('settings.email.config.delivery.adminLabel', { defaultValue: 'Admin & superadmin deliveries' })}
                        </span>
                        <p className="text-xs text-gray-500">
                            {t('settings.email.config.delivery.adminDescription', {
                                defaultValue: 'Send notifications to internal admins and role-based rules.',
                            })}
                        </p>
                    </div>
                    <Switcher
                        checked={providerDraft.adminEmailsEnabled}
                        onChange={(value) => handleProviderChange('adminEmailsEnabled', value)}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.provider', { defaultValue: 'Provider' })}
                    </span>
                    <Select
                        options={PROVIDER_OPTIONS}
                        value={PROVIDER_OPTIONS.find((option) => option.value === providerDraft.provider) ?? PROVIDER_OPTIONS[0]}
                        onChange={(option) =>
                            handleProviderChange('provider', (option?.value as ProviderOptionValue) || 'DEV')
                        }
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromAddress', { defaultValue: 'From address' })}
                    </span>
                    <Input
                        value={providerDraft.fromAddress}
                        onChange={(event) => handleProviderChange('fromAddress', event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromName', { defaultValue: 'From name' })}
                    </span>
                    <Input value={providerDraft.fromName} onChange={(event) => handleProviderChange('fromName', event.target.value)} />
                </div>
            </div>

            {smtpVisible && (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpHost', { defaultValue: 'SMTP host' })}
                            </span>
                            <Input
                                value={providerDraft.smtpHost}
                                onChange={(event) => handleProviderChange('smtpHost', event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpPort', { defaultValue: 'SMTP port' })}
                            </span>
                            <Input
                                type="number"
                                value={providerDraft.smtpPort}
                                onChange={(event) =>
                                    handleProviderChange('smtpPort', Number(event.target.value) || 0)
                                }
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpUser', { defaultValue: 'SMTP user' })}
                            </span>
                            <Input
                                value={providerDraft.smtpUser}
                                onChange={(event) => handleProviderChange('smtpUser', event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpPassword', { defaultValue: 'SMTP password' })}
                            </span>
                            <Input
                                type="password"
                                value={providerDraft.smtpPassword}
                                onChange={(event) => handleProviderChange('smtpPassword', event.target.value)}
                                placeholder={
                                    providerDraft.smtpPassword
                                        ? '••••••••'
                                        : t('settings.email.config.smtpPasswordPlaceholder', { defaultValue: 'Leave blank to keep current password' })
                                }
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                            <span className="text-sm text-gray-600">
                                {t('settings.email.config.smtpSecure', { defaultValue: 'Use TLS/SSL' })}
                            </span>
                            <Switcher
                                checked={providerDraft.smtpSecure}
                                onChange={(value) => handleProviderChange('smtpSecure', value)}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                            <span className="text-sm text-gray-600">
                                {t('settings.email.config.allowInvalidCerts', { defaultValue: 'Allow invalid certificates' })}
                            </span>
                            <Switcher
                                checked={providerDraft.allowInvalidCerts}
                                onChange={(value) => handleProviderChange('allowInvalidCerts', value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="solid"
                        disabled={saving || !providerDraft.dirty}
                        loading={saving}
                        onClick={handleProviderSave}
                    >
                        {t('settings.email.actions.save', { defaultValue: 'Save changes' })}
                    </Button>
                    <Button type="button" variant="plain" onClick={load} disabled={saving || loading}>
                        {t('common.reset', { defaultValue: 'Reset' })}
                    </Button>
                </div>
                <div className="flex gap-2 items-center">
                    <Input
                        placeholder={t('settings.email.config.testRecipient', { defaultValue: 'Test recipient email' })}
                        value={testRecipient}
                        onChange={(event) => setTestRecipient(event.target.value)}
                        className="w-64"
                    />
                    <Button
                        type="button"
                        variant="twoTone"
                        loading={sendingTest}
                        disabled={sendingTest}
                        onClick={handleSendTest}
                    >
                        {t('settings.email.config.sendTest', { defaultValue: 'Send test' })}
                    </Button>
                </div>
            </div>
        </Card>

        <Card className="space-y-6">
            <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h5 className="text-lg font-semibold">
                            {t('settings.email.inbox.title', { defaultValue: 'Inbox account (IMAP/SMTP)' })}
                        </h5>
                        <p className="text-sm text-gray-500">
                            {t('settings.email.inbox.description', {
                                defaultValue:
                                    'Configure the shared mailbox used by the inbox module. Credentials are encrypted when stored in the database.',
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            className={
                                inboxMeta.source === 'database'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600'
                            }
                        >
                            {inboxMeta.source === 'database'
                                ? t('settings.email.inbox.badge.custom', { defaultValue: 'Custom configuration' })
                                : t('settings.email.inbox.badge.environment', { defaultValue: 'Environment defaults' })}
                        </Badge>
                        {inboxUpdatedLabel ? (
                            <span className="text-xs text-gray-500">
                                {t('settings.email.updatedAtExact', {
                                    defaultValue: 'Last updated {{value}}',
                                    value: inboxUpdatedLabel,
                                })}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.imapHost', { defaultValue: 'IMAP host' })}
                    </span>
                    <Input value={inboxDraft.imapHost} onChange={(event) => handleInboxChange('imapHost', event.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.imapPort', { defaultValue: 'IMAP port' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.imapPort}
                        onChange={(event) => handleInboxChange('imapPort', event.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.imapSecurity', { defaultValue: 'IMAP security' })}
                    </span>
                    <Select
                        options={INBOX_SECURITY_OPTIONS}
                        value={
                            INBOX_SECURITY_OPTIONS.find((option) => option.value === inboxDraft.imapSecurity) ??
                            INBOX_SECURITY_OPTIONS[0]
                        }
                        onChange={(option) =>
                            handleInboxChange('imapSecurity', (option?.value as InboxSecurityOption) || 'SSL_TLS')
                        }
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.smtpSecurity', { defaultValue: 'SMTP security' })}
                    </span>
                    <Select
                        options={INBOX_SECURITY_OPTIONS}
                        value={
                            INBOX_SECURITY_OPTIONS.find((option) => option.value === inboxDraft.smtpSecurity) ??
                            INBOX_SECURITY_OPTIONS[1]
                        }
                        onChange={(option) =>
                            handleInboxChange('smtpSecurity', (option?.value as InboxSecurityOption) || 'STARTTLS')
                        }
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.smtpHost', { defaultValue: 'SMTP host' })}
                    </span>
                    <Input value={inboxDraft.smtpHost} onChange={(event) => handleInboxChange('smtpHost', event.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.smtpPort', { defaultValue: 'SMTP port' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.smtpPort}
                        onChange={(event) => handleInboxChange('smtpPort', event.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.username', { defaultValue: 'Username' })}
                    </span>
                    <Input value={inboxDraft.username} onChange={(event) => handleInboxChange('username', event.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.password', { defaultValue: 'Password' })}
                    </span>
                    <Input
                        type="password"
                        value={inboxDraft.password}
                        onChange={(event) => handleInboxChange('password', event.target.value)}
                        placeholder={
                            inboxDraft.password
                                ? '••••••••'
                                : inboxMeta.passwordSet
                                  ? '••••••••'
                                  : t('settings.email.inbox.passwordPlaceholder', {
                                        defaultValue: 'Leave blank to keep current password',
                                    })
                        }
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromAddress', { defaultValue: 'From address' })}
                    </span>
                    <Input value={inboxDraft.fromAddress} onChange={(event) => handleInboxChange('fromAddress', event.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromName', { defaultValue: 'From name' })}
                    </span>
                    <Input value={inboxDraft.fromName} onChange={(event) => handleInboxChange('fromName', event.target.value)} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.maxAttachmentSizeMb', { defaultValue: 'Max attachment size (MB)' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.maxAttachmentSizeMb}
                        onChange={(event) => handleInboxChange('maxAttachmentSizeMb', event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.ratePerMinute', { defaultValue: 'Send rate per minute' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.ratePerMinute}
                        onChange={(event) => handleInboxChange('ratePerMinute', event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.pollIntervalMs', { defaultValue: 'Polling interval (ms)' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.pollIntervalMs}
                        onChange={(event) => handleInboxChange('pollIntervalMs', event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.inbox.fields.pollBatchSize', { defaultValue: 'Polling batch size' })}
                    </span>
                    <Input
                        type="number"
                        value={inboxDraft.pollBatchSize}
                        onChange={(event) => handleInboxChange('pollBatchSize', event.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="solid"
                        disabled={savingInbox || !inboxDraft.dirty}
                        loading={savingInbox}
                        onClick={handleInboxSave}
                    >
                        {t('settings.email.inbox.actions.save', { defaultValue: 'Save inbox settings' })}
                    </Button>
                    <Button type="button" variant="plain" onClick={load} disabled={savingInbox || loading}>
                        {t('common.reset', { defaultValue: 'Reset' })}
                    </Button>
                </div>
                <span className="text-xs text-gray-500">
                    {t('settings.email.inbox.passwordHint', {
                        defaultValue: 'Passwords are encrypted; leave blank to keep the stored value.',
                    })}
                </span>
            </div>
        </Card>
        </>
    )
}

export default EmailConfigurationForm
