import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Input from '@/components/ui/Input'
import Switcher from '@/components/ui/Switcher'
import Select from '@/components/ui/Select'
import { FormContainer, FormItem } from '@/components/ui/Form'
import {
    apiCreateInboxAccount,
    apiGetInboxAccounts,
    apiSyncInboxAccount,
    apiUpdateInboxAccount,
    type EmailChannelSecurityOption,
    type InboxAccountDto,
    type InboxAccountMetadataDto,
} from '@/services/InboxService'
import { HiOutlineExternalLink, HiOutlinePencilAlt, HiOutlineRefresh } from 'react-icons/hi'

type AccountFormState = {
    id: string | null
    address: string
    displayName: string
    active: boolean
    imapHost: string
    imapPort: string
    imapSecurity: EmailChannelSecurityOption
    smtpHost: string
    smtpPort: string
    smtpSecurity: EmailChannelSecurityOption
    username: string
    password: string
    fromAddress: string
    fromName: string
    maxAttachmentSizeMb: string
    ratePerMinute: string
    pollIntervalMs: string
    pollBatchSize: string
}

const SECURITY_OPTIONS: EmailChannelSecurityOption[] = ['SSL_TLS', 'STARTTLS', 'NONE']

const emptyForm: AccountFormState = {
    id: null,
    address: '',
    displayName: '',
    active: true,
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
}

const formatDateTime = (value: string | null, fallback: string) => {
    if (!value) return fallback
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const normalizeChannel = (value: string) => value.trim().toUpperCase()

const toRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }
    return value as Record<string, unknown>
}

const toText = (value: unknown) => {
    if (typeof value !== 'string') {
        return ''
    }
    return value.trim()
}

const toNumberText = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value)
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? String(parsed) : ''
    }
    return ''
}

const toSecurityOption = (
    value: unknown,
    fallback: EmailChannelSecurityOption,
): EmailChannelSecurityOption => {
    if (typeof value === 'string' && SECURITY_OPTIONS.includes(value as EmailChannelSecurityOption)) {
        return value as EmailChannelSecurityOption
    }
    return fallback
}

const buildOption = (value: EmailChannelSecurityOption, label: string) => ({
    value,
    label,
})

const buildSelectValue = <T extends string>(
    options: Array<{ value: T; label: string }>,
    value: T,
) => options.find((option) => option.value === value) ?? options[0]

const parseMetadata = (metadata: InboxAccountDto['metadata']): AccountFormState => {
    const record = toRecord(metadata)
    const imap = toRecord(record?.imap)
    const smtp = toRecord(record?.smtp)
    const credentials = toRecord(record?.credentials)
    const defaults = toRecord(record?.defaults)
    const limits = toRecord(record?.limits)
    const polling = toRecord(record?.polling)

    return {
        ...emptyForm,
        imapHost: toText(imap?.host ?? record?.imapHost),
        imapPort: toNumberText(imap?.port ?? record?.imapPort),
        imapSecurity: toSecurityOption(imap?.security ?? record?.imapSecurity, emptyForm.imapSecurity),
        smtpHost: toText(smtp?.host ?? record?.smtpHost),
        smtpPort: toNumberText(smtp?.port ?? record?.smtpPort),
        smtpSecurity: toSecurityOption(smtp?.security ?? record?.smtpSecurity, emptyForm.smtpSecurity),
        username: toText(credentials?.user ?? record?.username),
        password: '',
        fromAddress: toText(defaults?.fromAddress ?? record?.fromAddress),
        fromName: toText(defaults?.fromName ?? record?.fromName),
        maxAttachmentSizeMb: toNumberText(limits?.maxAttachmentSizeMb ?? record?.maxAttachmentSizeMb),
        ratePerMinute: toNumberText(limits?.outgoingRatePerMinute ?? record?.ratePerMinute),
        pollIntervalMs: toNumberText(polling?.intervalMs ?? record?.pollIntervalMs),
        pollBatchSize: toNumberText(polling?.batchSize ?? record?.pollBatchSize),
    }
}

const sortAccounts = (accounts: InboxAccountDto[]) =>
    [...accounts].sort((left, right) => {
        if (left.active !== right.active) {
            return left.active ? -1 : 1
        }
        const leftLabel = (left.displayName || left.address || left.id).toLowerCase()
        const rightLabel = (right.displayName || right.address || right.id).toLowerCase()
        return leftLabel.localeCompare(rightLabel)
    })

const hasAccountConfiguration = (account: InboxAccountDto) => {
    const metadata = toRecord(account.metadata)
    const imap = toRecord(metadata?.imap)
    const smtp = toRecord(metadata?.smtp)
    const credentials = toRecord(metadata?.credentials)
    const defaults = toRecord(metadata?.defaults)

    return Boolean(
        account.address?.trim() &&
            imap?.host &&
            smtp?.host &&
            credentials?.user &&
            defaults?.fromAddress,
    )
}

const summarizeAccount = (
    account: InboxAccountDto,
    labels: { imap: string; smtp: string; user: string },
) => {
    const metadata = toRecord(account.metadata)
    const imap = toRecord(metadata?.imap)
    const smtp = toRecord(metadata?.smtp)
    const credentials = toRecord(metadata?.credentials)

    return [
        imap?.host ? `${labels.imap}: ${String(imap.host)}` : null,
        smtp?.host ? `${labels.smtp}: ${String(smtp.host)}` : null,
        credentials?.user ? `${labels.user}: ${String(credentials.user)}` : null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
}

const ChannelsEmailSettings = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [savingAccount, setSavingAccount] = useState(false)
    const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
    const [accounts, setAccounts] = useState<InboxAccountDto[]>([])
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState<AccountFormState>(emptyForm)

    const securityOptions = useMemo(
        () => [
            buildOption('SSL_TLS', t('settings.channelsEmail.security.sslTls', { defaultValue: 'SSL/TLS' })),
            buildOption('STARTTLS', t('settings.channelsEmail.security.startTls', { defaultValue: 'STARTTLS' })),
            buildOption('NONE', t('settings.channelsEmail.security.none', { defaultValue: 'None' })),
        ],
        [t],
    )

    const summaryLabels = useMemo(
        () => ({
            imap: t('settings.channelsEmail.list.summaryLabels.imap', {
                defaultValue: 'IMAP',
            }),
            smtp: t('settings.channelsEmail.list.summaryLabels.smtp', {
                defaultValue: 'SMTP',
            }),
            user: t('settings.channelsEmail.list.summaryLabels.user', {
                defaultValue: 'User',
            }),
        }),
        [t],
    )

    const unavailableLabel = useMemo(
        () =>
            t('settings.channelsEmail.list.unavailable', {
                defaultValue: 'N/A',
            }),
        [t],
    )

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const accountsResponse = await apiGetInboxAccounts({
                channel: 'EMAIL',
                includeInactive: true,
                includeUnconfigured: true,
            })

            setAccounts(
                Array.isArray(accountsResponse.data)
                    ? accountsResponse.data.filter(
                          (account) => normalizeChannel(account.channel) === 'EMAIL',
                      )
                    : [],
            )
        } catch (requestError) {
            setError((requestError as Error).message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const sortedAccounts = useMemo(() => sortAccounts(accounts), [accounts])

    const activeAccounts = useMemo(
        () => accounts.filter((account) => account.active),
        [accounts],
    )

    const configuredAccounts = useMemo(
        () => accounts.filter((account) => hasAccountConfiguration(account)),
        [accounts],
    )

    const editingAccount = useMemo(
        () => accounts.find((account) => account.id === form.id) ?? null,
        [accounts, form.id],
    )

    const fillFormFromAccount = useCallback((account: InboxAccountDto) => {
        setForm({
            ...parseMetadata(account.metadata),
            id: account.id,
            address: account.address ?? '',
            displayName: account.displayName ?? '',
            active: account.active,
        })
    }, [])

    const resetForm = useCallback(() => {
        setForm(emptyForm)
    }, [])

    const handleSyncAccount = useCallback(async (accountId: string) => {
        setSyncingAccountId(accountId)
        try {
            await apiSyncInboxAccount({ accountId })
            toast.push(
                <Notification
                    type="success"
                    title={t('settings.channelsEmail.notifications.syncSuccessTitle', {
                        defaultValue: 'Inbox account synced',
                    })}
                >
                    {t('settings.channelsEmail.notifications.syncSuccessBody', {
                        defaultValue: 'The account was refreshed and its mailboxes are ready for messages.',
                    })}
                </Notification>,
                { placement: 'top-end' },
            )
            await load()
        } catch (requestError) {
            toast.push(
                <Notification
                    type="danger"
                    title={t('settings.channelsEmail.notifications.syncErrorTitle', {
                        defaultValue: 'Unable to sync inbox account',
                    })}
                >
                    {(requestError as Error).message}
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSyncingAccountId(null)
        }
    }, [load, t])

    const handleToggleActive = useCallback(
        async (account: InboxAccountDto) => {
            setSavingAccount(true)
            try {
                await apiUpdateInboxAccount(account.id, {
                    active: !account.active,
                })
                toast.push(
                    <Notification
                        type="success"
                        title={
                            account.active
                                ? t('settings.channelsEmail.notifications.deactivatedTitle', {
                                      defaultValue: 'Account deactivated',
                                  })
                                : t('settings.channelsEmail.notifications.activatedTitle', {
                                      defaultValue: 'Account activated',
                                  })
                        }
                    >
                        {t('settings.channelsEmail.notifications.toggleActiveBody', {
                            defaultValue: 'The inbox account status was updated.',
                        })}
                    </Notification>,
                    { placement: 'top-end' },
                )
                await load()
                if (form.id === account.id) {
                    resetForm()
                }
            } catch (requestError) {
                toast.push(
                    <Notification
                        type="danger"
                        title={t('settings.channelsEmail.notifications.updateErrorTitle', {
                            defaultValue: 'Unable to update account',
                        })}
                    >
                        {(requestError as Error).message}
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setSavingAccount(false)
            }
        },
        [form.id, load, resetForm, t],
    )

    const buildPayloadMetadata = useCallback(
        (currentForm: AccountFormState): InboxAccountMetadataDto => {
            const parseOptionalNumber = (value: string) => {
                const trimmed = value.trim()
                if (!trimmed) {
                    return null
                }
                const parsed = Number(trimmed)
                return Number.isFinite(parsed) ? parsed : null
            }

            const metadata: InboxAccountMetadataDto = {
                imap: {
                    host: currentForm.imapHost.trim() || null,
                    port: parseOptionalNumber(currentForm.imapPort),
                    security: currentForm.imapSecurity,
                },
                smtp: {
                    host: currentForm.smtpHost.trim() || null,
                    port: parseOptionalNumber(currentForm.smtpPort),
                    security: currentForm.smtpSecurity,
                },
                credentials: {
                    user: currentForm.username.trim() || null,
                    ...(currentForm.password.trim()
                        ? { password: currentForm.password.trim() }
                        : {}),
                },
                defaults: {
                    fromAddress: currentForm.fromAddress.trim() || null,
                    fromName: currentForm.fromName.trim() || null,
                },
                limits: {
                    maxAttachmentSizeMb: parseOptionalNumber(currentForm.maxAttachmentSizeMb),
                    outgoingRatePerMinute: parseOptionalNumber(currentForm.ratePerMinute),
                },
                polling: {
                    intervalMs: parseOptionalNumber(currentForm.pollIntervalMs),
                    batchSize: parseOptionalNumber(currentForm.pollBatchSize),
                },
            }

            return metadata
        },
        [],
    )

    const handleSave = useCallback(async () => {
        setSavingAccount(true)
        try {
            const payload = {
                address: form.address.trim(),
                displayName: form.displayName.trim() || null,
                active: form.active,
                metadata: buildPayloadMetadata(form),
            }

            if (form.id) {
                await apiUpdateInboxAccount(form.id, payload)
                toast.push(
                    <Notification
                        type="success"
                        title={t('settings.channelsEmail.notifications.updatedTitle', {
                            defaultValue: 'Inbox account updated',
                        })}
                    >
                        {t('settings.channelsEmail.notifications.updatedBody', {
                            defaultValue: 'The account is now ready for message routing.',
                        })}
                    </Notification>,
                    { placement: 'top-end' },
                )
            } else {
                await apiCreateInboxAccount(payload)
                toast.push(
                    <Notification
                        type="success"
                        title={t('settings.channelsEmail.notifications.createdTitle', {
                            defaultValue: 'Inbox account created',
                        })}
                    >
                        {t('settings.channelsEmail.notifications.createdBody', {
                            defaultValue: 'The new email account was added to the channel registry.',
                        })}
                    </Notification>,
                    { placement: 'top-end' },
                )
            }
            await load()
            resetForm()
        } catch (requestError) {
            toast.push(
                <Notification
                    type="danger"
                    title={t('settings.channelsEmail.notifications.saveErrorTitle', {
                        defaultValue: 'Unable to save inbox account',
                    })}
                >
                    {(requestError as Error).message}
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSavingAccount(false)
        }
    }, [buildPayloadMetadata, form, load, resetForm, t])

    const formTitle = form.id
        ? t('settings.channelsEmail.editor.editing', { defaultValue: 'Editing account' })
        : t('settings.channelsEmail.editor.new', { defaultValue: 'New account' })

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-700">
                        {error}
                    </Alert>
                ) : null}

                <Card>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                {t('settings.channelsEmail.overview.kicker', { defaultValue: 'Channels' })}
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                {t('settings.channelsEmail.overview.title', {
                                    defaultValue: 'Email channel',
                                })}
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                {t('settings.channelsEmail.overview.description', {
                                    defaultValue:
                                        'This channel controls the operational email accounts that later appear inside CRM messages. Use it to add, edit, activate or deactivate one or many mailboxes before syncing them with the inbox runtime.',
                                })}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-indigo-50 text-indigo-700">
                                {t('settings.channelsEmail.overview.totalAccounts', {
                                    defaultValue: '{{count}} accounts',
                                    count: accounts.length,
                                })}
                            </Badge>
                            <Badge className="bg-emerald-50 text-emerald-700">
                                {t('settings.channelsEmail.overview.activeAccounts', {
                                    defaultValue: '{{count}} active',
                                    count: activeAccounts.length,
                                })}
                            </Badge>
                            <Badge className="bg-sky-50 text-sky-700">
                                {t('settings.channelsEmail.overview.configuredAccounts', {
                                    defaultValue: '{{count}} configured',
                                    count: configuredAccounts.length,
                                })}
                            </Badge>
                            <Button
                                type="button"
                                variant="plain"
                                icon={<HiOutlineRefresh />}
                                onClick={() => void load()}
                                disabled={loading}
                            >
                                {t('settings.channelsEmail.overview.refresh', {
                                    defaultValue: 'Refresh',
                                })}
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="xl:col-span-1">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    {t('settings.channelsEmail.editor.title', {
                                        defaultValue: 'Account editor',
                                    })}
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    {t('settings.channelsEmail.editor.description', {
                                        defaultValue:
                                            'Create or update the accounts that will be reflected in CRM messages and inbox routing.',
                                    })}
                                </p>
                            </div>
                            <Badge
                                className={
                                    form.id ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                                }
                            >
                                {formTitle}
                            </Badge>
                        </div>

                        <FormContainer className="mt-5 space-y-6">
                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.identity', {
                                        defaultValue: 'Identity',
                                    })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.address', {
                                            defaultValue: 'Email address',
                                        })}
                                        asterisk
                                    >
                                        <Input
                                            type="email"
                                            value={form.address}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    address: event.target.value,
                                                }))
                                            }
                                            placeholder={t('settings.channelsEmail.editor.placeholders.address', {
                                                defaultValue: 'support@example.com',
                                            })}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.displayName', {
                                            defaultValue: 'Display name',
                                        })}
                                    >
                                        <Input
                                            value={form.displayName}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    displayName: event.target.value,
                                                }))
                                            }
                                            placeholder={t('settings.channelsEmail.editor.placeholders.displayName', {
                                                defaultValue: 'Support inbox',
                                            })}
                                        />
                                    </FormItem>
                                </div>
                                <FormItem
                                    label={t('settings.channelsEmail.editor.fields.active', {
                                        defaultValue: 'Active',
                                    })}
                                >
                                    <Switcher
                                        checked={form.active}
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                active: checked,
                                            }))
                                        }
                                    />
                                </FormItem>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.imap', { defaultValue: 'IMAP' })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.imapHost', {
                                            defaultValue: 'IMAP host',
                                        })}
                                        asterisk
                                    >
                                        <Input
                                            value={form.imapHost}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    imapHost: event.target.value,
                                                }))
                                            }
                                            placeholder="mail.example.com"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.imapPort', {
                                            defaultValue: 'IMAP port',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.imapPort}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    imapPort: event.target.value,
                                                }))
                                            }
                                            placeholder="993"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.imapSecurity', {
                                            defaultValue: 'IMAP security',
                                        })}
                                    >
                                        <Select
                                            isClearable={false}
                                            options={securityOptions}
                                            value={buildSelectValue(securityOptions, form.imapSecurity)}
                                            onChange={(option) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    imapSecurity:
                                                        (option?.value as EmailChannelSecurityOption) ??
                                                        current.imapSecurity,
                                                }))
                                            }
                                        />
                                    </FormItem>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.smtp', { defaultValue: 'SMTP' })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.smtpHost', {
                                            defaultValue: 'SMTP host',
                                        })}
                                        asterisk
                                    >
                                        <Input
                                            value={form.smtpHost}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    smtpHost: event.target.value,
                                                }))
                                            }
                                            placeholder="mail.example.com"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.smtpPort', {
                                            defaultValue: 'SMTP port',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.smtpPort}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    smtpPort: event.target.value,
                                                }))
                                            }
                                            placeholder="587"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.smtpSecurity', {
                                            defaultValue: 'SMTP security',
                                        })}
                                    >
                                        <Select
                                            isClearable={false}
                                            options={securityOptions}
                                            value={buildSelectValue(securityOptions, form.smtpSecurity)}
                                            onChange={(option) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    smtpSecurity:
                                                        (option?.value as EmailChannelSecurityOption) ??
                                                        current.smtpSecurity,
                                                }))
                                            }
                                        />
                                    </FormItem>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.credentials', {
                                        defaultValue: 'Credentials',
                                    })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.username', {
                                            defaultValue: 'Username',
                                        })}
                                        asterisk
                                    >
                                        <Input
                                            value={form.username}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    username: event.target.value,
                                                }))
                                            }
                                            placeholder="support@example.com"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.password', {
                                            defaultValue: 'Password',
                                        })}
                                    >
                                        <Input
                                            type="password"
                                            value={form.password}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    password: event.target.value,
                                                }))
                                            }
                                            placeholder={t('settings.channelsEmail.editor.placeholders.keepPassword', {
                                                defaultValue: 'Leave blank to keep the current password',
                                            })}
                                        />
                                    </FormItem>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.defaults', {
                                        defaultValue: 'Defaults',
                                    })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.fromAddress', {
                                            defaultValue: 'From address',
                                        })}
                                        asterisk
                                    >
                                        <Input
                                            value={form.fromAddress}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    fromAddress: event.target.value,
                                                }))
                                            }
                                            placeholder="no-reply@example.com"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.fromName', {
                                            defaultValue: 'From name',
                                        })}
                                    >
                                        <Input
                                            value={form.fromName}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    fromName: event.target.value,
                                                }))
                                            }
                                            placeholder="Acme Support"
                                        />
                                    </FormItem>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                                    {t('settings.channelsEmail.editor.sections.limits', {
                                        defaultValue: 'Limits and polling',
                                    })}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.maxAttachmentSizeMb', {
                                            defaultValue: 'Max attachment size (MB)',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.maxAttachmentSizeMb}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    maxAttachmentSizeMb: event.target.value,
                                                }))
                                            }
                                            placeholder="25"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.ratePerMinute', {
                                            defaultValue: 'Outgoing rate per minute',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.ratePerMinute}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    ratePerMinute: event.target.value,
                                                }))
                                            }
                                            placeholder="60"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.pollIntervalMs', {
                                            defaultValue: 'Polling interval (ms)',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.pollIntervalMs}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    pollIntervalMs: event.target.value,
                                                }))
                                            }
                                            placeholder="120000"
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('settings.channelsEmail.editor.fields.pollBatchSize', {
                                            defaultValue: 'Polling batch size',
                                        })}
                                    >
                                        <Input
                                            type="number"
                                            value={form.pollBatchSize}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    pollBatchSize: event.target.value,
                                                }))
                                            }
                                            placeholder="50"
                                        />
                                    </FormItem>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="solid"
                                    loading={savingAccount}
                                    disabled={!form.address.trim()}
                                    onClick={() => void handleSave()}
                                >
                                    {form.id
                                        ? t('settings.channelsEmail.editor.actions.update', {
                                              defaultValue: 'Update account',
                                          })
                                        : t('settings.channelsEmail.editor.actions.create', {
                                              defaultValue: 'Create account',
                                          })}
                                </Button>
                                <Button
                                    type="button"
                                    variant="plain"
                                    disabled={savingAccount && !form.id}
                                    onClick={resetForm}
                                >
                                    {t('settings.channelsEmail.editor.actions.reset', {
                                        defaultValue: 'Reset',
                                    })}
                                </Button>
                            </div>
                        </FormContainer>

                        {editingAccount ? (
                            <Alert className="mt-4 border-indigo-200 bg-indigo-50 text-indigo-800">
                                {t('settings.channelsEmail.editor.editingBanner', {
                                    defaultValue: 'Editing {{label}}',
                                    label:
                                        editingAccount.displayName ||
                                        editingAccount.address ||
                                        editingAccount.id,
                                })}
                            </Alert>
                        ) : null}
                    </Card>

                    <Card className="xl:col-span-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    {t('settings.channelsEmail.list.title', {
                                        defaultValue: 'Registered email accounts',
                                    })}
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    {t('settings.channelsEmail.list.description', {
                                        defaultValue:
                                            'These accounts surface later in CRM messages and thread routing.',
                                    })}
                                </p>
                            </div>
                            <Button type="button" variant="plain" onClick={() => resetForm()}>
                                {t('settings.channelsEmail.list.actions.newAccount', {
                                    defaultValue: 'New account',
                                })}
                            </Button>
                        </div>

                        <div className="mt-5 overflow-hidden rounded border border-gray-200">
                            {sortedAccounts.length === 0 ? (
                                <div className="p-6 text-sm text-gray-500">
                                    {t('settings.channelsEmail.list.empty', {
                                        defaultValue: 'No EMAIL inbox accounts are available yet.',
                                    })}
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                {t('settings.channelsEmail.list.columns.account', {
                                                    defaultValue: 'Account',
                                                })}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                {t('settings.channelsEmail.list.columns.status', {
                                                    defaultValue: 'Status',
                                                })}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                {t('settings.channelsEmail.list.columns.updated', {
                                                    defaultValue: 'Updated',
                                                })}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium text-gray-500">
                                                {t('settings.channelsEmail.list.columns.actions', {
                                                    defaultValue: 'Actions',
                                                })}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {sortedAccounts.map((account) => {
                                            const configured = hasAccountConfiguration(account)
                                            const summary = summarizeAccount(account, summaryLabels)
                                            return (
                                                <tr key={account.id}>
                                                    <td className="px-4 py-4">
                                                        <div className="font-medium text-gray-900">
                                                            {account.displayName || account.address || account.id}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {account.address ||
                                                                t('settings.channelsEmail.list.noAddress', {
                                                                    defaultValue: 'No address set',
                                                                })}
                                                        </div>
                                                        {summary ? (
                                                            <div className="mt-1 text-xs text-gray-500">
                                                                {summary}
                                                            </div>
                                                        ) : null}
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <Badge
                                                                className={
                                                                    account.active
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-gray-100 text-gray-600'
                                                                }
                                                            >
                                                                {account.active
                                                                    ? t('settings.channelsEmail.list.badges.active', {
                                                                          defaultValue: 'Active',
                                                                      })
                                                                    : t('settings.channelsEmail.list.badges.inactive', {
                                                                          defaultValue: 'Inactive',
                                                                      })}
                                                            </Badge>
                                                            <Badge className="bg-sky-50 text-sky-700">
                                                                {t('settings.channelsEmail.list.badges.channelEmail', {
                                                                    defaultValue: 'Email',
                                                                })}
                                                            </Badge>
                                                            <Badge
                                                                className={
                                                                    configured
                                                                        ? 'bg-violet-50 text-violet-700'
                                                                        : 'bg-amber-50 text-amber-700'
                                                                }
                                                            >
                                                                {configured
                                                                    ? t('settings.channelsEmail.list.badges.configured', {
                                                                          defaultValue: 'Configured',
                                                                      })
                                                                    : t('settings.channelsEmail.list.badges.incomplete', {
                                                                          defaultValue: 'Incomplete',
                                                                      })}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {account.active
                                                            ? t('settings.channelsEmail.list.status.visible', {
                                                                  defaultValue: 'Visible in messages',
                                                              })
                                                            : t('settings.channelsEmail.list.status.hidden', {
                                                                  defaultValue: 'Hidden from normal routing',
                                                              })}
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {formatDateTime(account.updatedAt ?? null, unavailableLabel)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="plain"
                                                                icon={<HiOutlinePencilAlt />}
                                                                onClick={() => fillFormFromAccount(account)}
                                                            >
                                                                {t('settings.channelsEmail.list.actions.edit', {
                                                                    defaultValue: 'Edit',
                                                                })}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="plain"
                                                                icon={<HiOutlineExternalLink />}
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/app/crm/mail/inbox?account=${encodeURIComponent(
                                                                            account.id,
                                                                        )}`,
                                                                    )
                                                                }
                                                            >
                                                                {t('settings.channelsEmail.list.actions.messages', {
                                                                    defaultValue: 'Messages',
                                                                })}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="twoTone"
                                                                loading={syncingAccountId === account.id}
                                                                disabled={Boolean(syncingAccountId)}
                                                                onClick={() => void handleSyncAccount(account.id)}
                                                            >
                                                                {t('settings.channelsEmail.list.actions.sync', {
                                                                    defaultValue: 'Sync',
                                                                })}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={account.active ? 'plain' : 'solid'}
                                                                disabled={savingAccount}
                                                                onClick={() => void handleToggleActive(account)}
                                                            >
                                                                {account.active
                                                                    ? t('settings.channelsEmail.list.actions.deactivate', {
                                                                          defaultValue: 'Deactivate',
                                                                      })
                                                                    : t('settings.channelsEmail.list.actions.activate', {
                                                                          defaultValue: 'Activate',
                                                                      })}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </Loading>
    )
}

export default ChannelsEmailSettings
