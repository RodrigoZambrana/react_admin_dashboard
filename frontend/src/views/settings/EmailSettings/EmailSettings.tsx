import { useCallback, useEffect, useMemo, useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Switcher from '@/components/ui/Switcher'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import Notification from '@/components/ui/Notification'
import Textarea from '@/components/ui/Textarea'
import toast from '@/components/ui/toast'
import dayjs from 'dayjs'
import { HiOutlineTrash, HiX } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import {
    apiCreateEmailRoleRule,
    apiDeleteEmailRoleRule,
    apiGetEmailRoleOptions,
    apiGetEmailRoleRules,
    apiGetEmailSettings,
    apiListEmailLogs,
    apiListEmailTemplates,
    apiSendEmailTest,
    apiUpdateEmailRoleRule,
    apiUpdateEmailSettings,
    apiGetEmailTemplate,
    apiUpdateEmailTemplate,
    apiPreviewEmailTemplate,
    apiGetEmailTemplateSamples,
    apiGetEmailMetrics,
} from '@/services/SettingsService'
import classNames from 'classnames'
import useConfirmation from '@/hooks/useConfirmation'

type EmailCategory = 'ORDERS' | 'PAYMENTS' | 'AUTH'

type EmailTemplateVariant = 'CUSTOMER' | 'ADMIN'

type CategorySettingResponse = {
    category: EmailCategory
    fromAddress: string
    fromName?: string | null
    adminRecipients: string[]
    cc: string[]
    bcc: string[]
    enabled: boolean
    updatedAt?: string
}

type RoleRuleResponse = {
    id: number
    role: string
    categories: EmailCategory[]
    enabled: boolean
    createdAt?: string
    updatedAt?: string
}

type EmailLogResponse = {
    id: number
    category: EmailCategory
    templateId?: number | null
    locale: string
    recipientType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
    toAddress: string
    ccAddresses: string[]
    bccAddresses: string[]
    subject: string
    status: 'QUEUED' | 'SENT' | 'FAILED' | 'RETRYING'
    providerMessageId?: string | null
    errorMessage?: string | null
    attempts: number
    createdAt: string
    updatedAt: string
    lastAttemptAt?: string | null
}

type EmailLogPayload = {
    logs: EmailLogResponse[]
    nextCursor: number | null
}

type EmailTemplateSummary = {
    id: number
    category: EmailCategory
    variant: EmailTemplateVariant
    locale: string
    version: number
    updatedAt: string
}

type EmailTemplateDetail = EmailTemplateSummary & {
    subject: string
    body: string
    active: boolean
}

type TemplateScenarioOption = {
    key: string
    label: string
}

type EmailTemplatePreview = {
    subject: string
    html: string
    text: string
}

type MetricsCounters = {
    attempts: number
    sent: number
    failed: number
}

type EmailMetrics = {
    totals: MetricsCounters
    perCategory: Record<string, MetricsCounters>
    perTemplate: Record<string, MetricsCounters>
}

type CategoryDraft = {
    enabled: boolean
    fromAddress: string
    fromName: string
    adminRecipients: string[]
    cc: string[]
    bcc: string[]
    updatedAt?: string
    dirty: boolean
}

type RoleOption = {
    label: string
    value: string
}

const CATEGORY_ORDER: EmailCategory[] = ['ORDERS', 'PAYMENTS', 'AUTH']

const VARIANT_OPTIONS: Array<{ value: EmailTemplateVariant; label: string }> = [
    { value: 'CUSTOMER', label: 'Customer' },
    { value: 'ADMIN', label: 'Administrator' },
]

const LOCALE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
]

const { TabList, TabNav, TabContent } = Tabs
const { Tr, Th, Td, TBody, THead } = Table

const buildCategoryLabel = (t: (k: string, opts?: Record<string, unknown>) => string) => ({
    ORDERS: t('settings.email.categories.orders', { defaultValue: 'Orders' }),
    PAYMENTS: t('settings.email.categories.payments', { defaultValue: 'Payments' }),
    AUTH: t('settings.email.categories.auth', { defaultValue: 'Authentication' }),
})

const buildStatusLabel = (t: (k: string, opts?: Record<string, unknown>) => string) => ({
    QUEUED: t('settings.email.logs.status.queued', { defaultValue: 'Queued' }),
    SENT: t('settings.email.logs.status.sent', { defaultValue: 'Sent' }),
    FAILED: t('settings.email.logs.status.failed', { defaultValue: 'Failed' }),
    RETRYING: t('settings.email.logs.status.retrying', { defaultValue: 'Retrying' }),
})

const buildRecipientLabel = (t: (k: string, opts?: Record<string, unknown>) => string) => ({
    CUSTOMER: t('settings.email.logs.recipient.customer', { defaultValue: 'Customer' }),
    ADMIN: t('settings.email.logs.recipient.admin', { defaultValue: 'Administrator' }),
    SYSTEM: t('settings.email.logs.recipient.system', { defaultValue: 'System' }),
})

type EmailListEditorProps = {
    label: string
    values: string[]
    placeholder: string
    disabled?: boolean
    onChange: (values: string[]) => void
}

const EmailListEditor = ({
    label,
    values,
    placeholder,
    disabled,
    onChange,
}: EmailListEditorProps) => {
    const [draft, setDraft] = useState('')
    const { t } = useTranslation()

    const addEmail = useCallback(() => {
        const normalized = draft.trim().toLowerCase()
        if (!normalized.length) return
        if (!normalized.includes('@')) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.email.validation.invalidEmail', {
                        defaultValue: 'Enter a valid email address.',
                    })}
                </Notification>,
            )
            return
        }
        if (values.includes(normalized)) {
            setDraft('')
            return
        }
        onChange([...values, normalized])
        setDraft('')
    }, [draft, onChange, t, values])

    const removeEmail = useCallback(
        (email: string) => {
            onChange(values.filter((value) => value !== email))
        },
        [onChange, values],
    )

    return (
        <div className="flex flex-col gap-2">
            <span className="font-semibold text-sm text-gray-600">{label}</span>
            <div className="flex flex-wrap gap-2 items-center">
                {values.length === 0 && (
                    <Badge className="bg-gray-100 text-gray-500">
                        {t('settings.email.recipients.empty', { defaultValue: 'No recipients' })}
                    </Badge>
                )}
                {values.map((email) => (
                    <span
                        key={email}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                    >
                        {email}
                        <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700"
                            aria-label={t('settings.email.actions.removeRecipient', { defaultValue: 'Remove recipient' })}
                            onClick={() => removeEmail(email)}
                        >
                            <HiX />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder={placeholder}
                    value={draft}
                    disabled={disabled}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            addEmail()
                        }
                    }}
                />
                <Button type="button" disabled={disabled} onClick={addEmail}>
                    {t('settings.email.actions.add', { defaultValue: 'Add' })}
                </Button>
            </div>
        </div>
    )
}

type CategoryFormProps = {
    category: EmailCategory
    draft: CategoryDraft
    saving: boolean
    onChange: (category: EmailCategory, key: keyof CategoryDraft, value: unknown) => void
    onSave: (category: EmailCategory) => Promise<void>
}

const CategoryForm = ({ category, draft, saving, onChange, onSave }: CategoryFormProps) => {
    const { t } = useTranslation()
    const categoryLabels = buildCategoryLabel(t)
    const variantLabel = useMemo(() => {
        switch (category) {
            case 'ORDERS':
                return t('settings.email.test.variant.orders', { defaultValue: 'Email type' })
            case 'PAYMENTS':
                return t('settings.email.test.variant.payments', { defaultValue: 'Email type' })
            case 'AUTH':
            default:
                return t('settings.email.test.variant.auth', { defaultValue: 'Email type' })
        }
    }, [category, t])

    const [testRecipient, setTestRecipient] = useState('')
    const [testVariant, setTestVariant] = useState<EmailTemplateVariant>('CUSTOMER')
    const [testLocale, setTestLocale] = useState('en')
    const [sendingTest, setSendingTest] = useState(false)

    const handleToggle = (value: boolean) => {
        onChange(category, 'enabled', value)
    }

    const handleSave = async () => {
        await onSave(category)
    }

    const handleTestSend = async () => {
        const email = testRecipient.trim().toLowerCase()
        if (!email.includes('@')) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.email.validation.invalidEmail', {
                        defaultValue: 'Enter a valid email address.',
                    })}
                </Notification>,
            )
            return
        }
        setSendingTest(true)
        try {
            await apiSendEmailTest<Record<string, unknown>, { category: EmailCategory; variant: EmailTemplateVariant; to: string; locale: string }>({
                category,
                variant: testVariant,
                to: email,
                locale: testLocale,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.test.sent', { defaultValue: 'Test email queued successfully.' })}
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

    return (
        <Card className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                <div>
                    <h5 className="text-lg font-semibold">{categoryLabels[category]}</h5>
                    <p className="text-sm text-gray-500">
                        {t('settings.email.category.description', {
                            defaultValue: 'Configure sender information and recipients for this email category.',
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {draft.enabled
                            ? t('settings.email.status.enabled', { defaultValue: 'Enabled' })
                            : t('settings.email.status.disabled', { defaultValue: 'Disabled' })}
                    </span>
                    <Switcher checked={draft.enabled} onChange={handleToggle} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.fields.fromName', { defaultValue: 'From name' })}
                    </span>
                    <Input
                        placeholder="Acme Inc."
                        value={draft.fromName}
                        onChange={(event) => onChange(category, 'fromName', event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.fields.fromAddress', { defaultValue: 'From email' })}
                    </span>
                    <Input
                        placeholder="no-reply@example.com"
                        value={draft.fromAddress}
                        onChange={(event) => onChange(category, 'fromAddress', event.target.value)}
                    />
                </div>
            </div>

            <EmailListEditor
                label={t('settings.email.recipients.admin', { defaultValue: 'Administrator recipients' })}
                values={draft.adminRecipients}
                placeholder="admin@example.com"
                onChange={(value) => onChange(category, 'adminRecipients', value)}
            />

            <div className="grid gap-6 md:grid-cols-2">
                <EmailListEditor
                    label="CC"
                    values={draft.cc}
                    placeholder="finance@example.com"
                    onChange={(value) => onChange(category, 'cc', value)}
                />
                <EmailListEditor
                    label="BCC"
                    values={draft.bcc}
                    placeholder="audit@example.com"
                    onChange={(value) => onChange(category, 'bcc', value)}
                />
            </div>

            <div className="flex flex-wrap gap-3 items-center border-t border-gray-200 pt-4">
                <Button
                    variant="solid"
                    loading={saving}
                    disabled={!draft.dirty || saving}
                    onClick={handleSave}
                >
                    {t('settings.email.actions.save', { defaultValue: 'Save changes' })}
                </Button>
                {draft.updatedAt && (
                    <span className="text-xs text-gray-400">
                        {t('settings.email.updatedAtExact', {
                            defaultValue: 'Last updated {{value}}',
                            value: dayjs(draft.updatedAt).format('YYYY-MM-DD HH:mm'),
                        })}
                    </span>
                )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
                <h6 className="font-semibold text-sm text-gray-600">
                    {t('settings.email.test.title', { defaultValue: 'Send test email' })}
                </h6>
                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        placeholder={t('settings.email.test.emailPlaceholder', {
                            defaultValue: 'Email address',
                        })}
                        value={testRecipient}
                        onChange={(event) => setTestRecipient(event.target.value)}
                    />
                    <Select
                        options={VARIANT_OPTIONS}
                        value={VARIANT_OPTIONS.find((option) => option.value === testVariant)}
                        onChange={(option) => setTestVariant((option?.value as EmailTemplateVariant) ?? 'CUSTOMER')}
                        placeholder={variantLabel}
                    />
                    <Select
                        options={LOCALE_OPTIONS}
                        value={LOCALE_OPTIONS.find((option) => option.value === testLocale)}
                        onChange={(option) => setTestLocale((option?.value as string) ?? 'en')}
                        placeholder={t('settings.email.test.locale', { defaultValue: 'Locale' })}
                    />
                </div>
                <Button
                    variant="twoTone"
                    loading={sendingTest}
                    disabled={sendingTest}
                    onClick={handleTestSend}
                >
                    {t('settings.email.actions.sendTest', { defaultValue: 'Send test email' })}
                </Button>
            </div>
        </Card>
    )
}

const RoleRulesPanel = ({
    roleRules,
    roleOptions,
    loading,
    onRefresh,
    onToggle,
    onDelete,
    onCreate,
}: {
    roleRules: RoleRuleResponse[]
    roleOptions: RoleOption[]
    loading: boolean
    onRefresh: () => void
    onToggle: (rule: RoleRuleResponse, enabled: boolean) => Promise<void>
    onDelete: (rule: RoleRuleResponse) => Promise<void>
    onCreate: (role: string, categories: EmailCategory[]) => Promise<void>
}) => {
    const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null)
    const [selectedCategories, setSelectedCategories] = useState<EmailCategory[]>(['ORDERS'])
    const [creating, setCreating] = useState(false)
    const { t } = useTranslation()

    const categoryLabels = buildCategoryLabel(t)

    const handleCreate = async () => {
        if (!selectedRole) return
        if (!selectedCategories.length) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.email.validation.selectCategory', {
                        defaultValue: 'Select at least one category.',
                    })}
                </Notification>,
            )
            return
        }
        setCreating(true)
        try {
            await onCreate(selectedRole.value, selectedCategories)
            setSelectedCategories(['ORDERS'])
        } finally {
            setCreating(false)
        }
    }

    return (
        <Card className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h5 className="text-lg font-semibold">
                        {t('settings.email.roles.title', { defaultValue: 'Role routing rules' })}
                    </h5>
                    <p className="text-sm text-gray-500">
                        {t('settings.email.roles.description', {
                            defaultValue:
                                'Automatically notify internal users based on their role. Recipients are merged with manual admin recipients.',
                        })}
                    </p>
                </div>
                <Button variant="plain" onClick={onRefresh}>
                    {t('settings.email.actions.refresh', { defaultValue: 'Refresh' })}
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.roles.fields.role', { defaultValue: 'Role' })}
                    </span>
                    <Select
                        options={roleOptions}
                        value={selectedRole}
                        placeholder={t('settings.email.roles.placeholders.role', {
                            defaultValue: 'Select role',
                        })}
                        onChange={(option) => setSelectedRole(option as RoleOption)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.roles.fields.categories', { defaultValue: 'Categories' })}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_ORDER.map((category) => {
                            const selected = selectedCategories.includes(category)
                            return (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() =>
                                        setSelectedCategories((prev) =>
                                            prev.includes(category)
                                                ? prev.filter((value) => value !== category)
                                                : [...prev, category],
                                        )
                                    }
                                    className={classNames(
                                        'rounded-full border px-3 py-1 text-sm transition',
                                        selected
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                            : 'border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-500',
                                    )}
                                >
                                    {categoryLabels[category]}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    variant="solid"
                    disabled={!selectedRole || creating}
                    loading={creating}
                    onClick={handleCreate}
                >
                    {t('settings.email.actions.addRule', { defaultValue: 'Add rule' })}
                </Button>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h6 className="font-semibold text-sm text-gray-600">
                        {t('settings.email.roles.list', { defaultValue: 'Existing rules' })}
                    </h6>
                    {loading && <Spinner size={18} />}
                </div>
                {roleRules.length === 0 ? (
                    <p className="text-sm text-gray-500">
                        {t('settings.email.roles.empty', { defaultValue: 'No role-based rules defined yet.' })}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {roleRules.map((rule) => (
                            <div
                                key={rule.id}
                                className="flex items-center justify-between gap-3 rounded border border-gray-200 p-3"
                            >
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm text-gray-700">
                                        {rule.role}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {rule.categories.map((category) => categoryLabels[category]).join(', ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switcher
                                        checked={rule.enabled}
                                        onChange={(checked) => onToggle(rule, checked)}
                                    />
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        icon={<HiOutlineTrash />}
                                        onClick={() => onDelete(rule)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}

const LogsPanel = ({
    categoryLabels,
    statusLabels,
    recipientLabels,
}: {
    categoryLabels: Record<EmailCategory, string>
    statusLabels: Record<'QUEUED' | 'SENT' | 'FAILED' | 'RETRYING', string>
    recipientLabels: Record<'CUSTOMER' | 'ADMIN' | 'SYSTEM', string>
}) => {
    const { t } = useTranslation()
    const [logs, setLogs] = useState<EmailLogResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [nextCursor, setNextCursor] = useState<number | null>(null)
    const [filters, setFilters] = useState<{
        category?: EmailCategory
        status?: 'QUEUED' | 'SENT' | 'FAILED' | 'RETRYING'
        recipientType?: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
    }>({})

    const fetchLogs = useCallback(
        async (cursor?: number | null, append = false) => {
            setLoading(true)
            try {
                const params: Record<string, unknown> = {
                    take: 25,
                }
                if (cursor) {
                    params.cursor = cursor
                }
                if (filters.category) {
                    params.category = filters.category
                }
                if (filters.status) {
                    params.status = filters.status
                }
                if (filters.recipientType) {
                    params.recipientType = filters.recipientType
                }
                const response = await apiListEmailLogs<EmailLogPayload>(params)
                const payload = response.data
                if (append) {
                    setLogs((prev) => [...prev, ...(payload.logs ?? [])])
                } else {
                    setLogs(payload.logs ?? [])
                }
                setNextCursor(payload.nextCursor ?? null)
            } catch (error: any) {
                toast.push(
                    <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                        {error?.response?.data?.message || error?.message || String(error)}
                    </Notification>,
                )
            } finally {
                setLoading(false)
            }
        },
        [filters.category, filters.recipientType, filters.status, t],
    )

    useEffect(() => {
        fetchLogs(undefined, false)
    }, [fetchLogs])

    const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
        value,
        label,
    }))
    const recipientOptions = Object.entries(recipientLabels).map(([value, label]) => ({
        value,
        label,
    }))

    return (
        <Card className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h5 className="text-lg font-semibold">
                        {t('settings.email.logs.title', { defaultValue: 'Delivery logs' })}
                    </h5>
                    <p className="text-sm text-gray-500">
                        {t('settings.email.logs.description', {
                            defaultValue: 'Inspect recent email deliveries, statuses, and errors.',
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="plain"
                        onClick={() => fetchLogs(undefined, false)}
                        disabled={loading}
                    >
                        {t('settings.email.actions.refresh', { defaultValue: 'Refresh' })}
                    </Button>
                    {loading && <Spinner size={18} />}
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                <Select
                    isClearable
                    placeholder={t('settings.email.logs.filters.category', { defaultValue: 'All categories' })}
                    options={CATEGORY_ORDER.map((category) => ({
                        value: category,
                        label: categoryLabels[category],
                    }))}
                    value={
                        filters.category
                            ? {
                                  value: filters.category,
                                  label: categoryLabels[filters.category],
                              }
                            : null
                    }
                    onChange={(option) => {
                        setFilters((prev) => ({
                            ...prev,
                            category: (option?.value as EmailCategory | undefined) || undefined,
                        }))
                    }}
                />
                <Select
                    isClearable
                    placeholder={t('settings.email.logs.filters.status', { defaultValue: 'All statuses' })}
                    options={statusOptions}
                    value={
                        filters.status
                            ? {
                                  value: filters.status,
                                  label: statusLabels[filters.status],
                              }
                            : null
                    }
                    onChange={(option) => {
                        setFilters((prev) => ({
                            ...prev,
                            status: (option?.value as typeof filters.status | undefined) || undefined,
                        }))
                    }}
                />
                <Select
                    isClearable
                    placeholder={t('settings.email.logs.filters.recipient', { defaultValue: 'All recipients' })}
                    options={recipientOptions}
                    value={
                        filters.recipientType
                            ? {
                                  value: filters.recipientType,
                                  label: recipientLabels[filters.recipientType],
                              }
                            : null
                    }
                    onChange={(option) => {
                        setFilters((prev) => ({
                            ...prev,
                            recipientType: (option?.value as typeof filters.recipientType | undefined) || undefined,
                        }))
                    }}
                />
            </div>
            <div className="border-t border-gray-200">
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.email.logs.columns.date', { defaultValue: 'Date' })}</Th>
                            <Th>{t('settings.email.logs.columns.category', { defaultValue: 'Category' })}</Th>
                            <Th>{t('settings.email.logs.columns.recipient', { defaultValue: 'Recipient' })}</Th>
                            <Th>{t('settings.email.logs.columns.subject', { defaultValue: 'Subject' })}</Th>
                            <Th>{t('settings.email.logs.columns.status', { defaultValue: 'Status' })}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {logs.length === 0 ? (
                            <Tr>
                                <Td colSpan={5} className="text-center text-sm text-gray-500 py-6">
                                    {loading
                                        ? t('common.loading', { defaultValue: 'Loading…' })
                                        : t('settings.email.logs.empty', { defaultValue: 'No logs found.' })}
                                </Td>
                            </Tr>
                        ) : (
                            logs.map((log) => (
                                <Tr key={log.id}>
                                    <Td>{dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}</Td>
                                    <Td>{categoryLabels[log.category]}</Td>
                                    <Td>
                                        <div className="flex flex-col">
                                            <span>{log.toAddress}</span>
                                            <span className="text-xs text-gray-500">
                                                {recipientLabels[log.recipientType]}
                                            </span>
                                        </div>
                                    </Td>
                                    <Td className="max-w-xs truncate" title={log.subject}>
                                        {log.subject}
                                    </Td>
                                    <Td>
                                        <Badge
                                            className={classNames('px-2 py-1 text-xs', {
                                                'bg-green-100 text-green-700': log.status === 'SENT',
                                                'bg-yellow-100 text-yellow-700':
                                                    log.status === 'QUEUED' || log.status === 'RETRYING',
                                                'bg-red-100 text-red-700': log.status === 'FAILED',
                                            })}
                                        >
                                            {statusLabels[log.status]}
                                        </Badge>
                                        {log.errorMessage && (
                                            <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={log.errorMessage}>
                                                {log.errorMessage}
                                            </div>
                                        )}
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </div>
            {nextCursor && (
                <div className="flex justify-center">
                    <Button
                        variant="twoTone"
                        loading={loading}
                        disabled={loading}
                        onClick={() => fetchLogs(nextCursor, true)}
                    >
                        {t('settings.email.logs.actions.loadMore', { defaultValue: 'Load more' })}
                    </Button>
                </div>
            )}
        </Card>
    )
}

const TemplatesPanel = ({
    templates,
    selectedTemplateId,
    onSelect,
}: {
    templates: EmailTemplateSummary[]
    selectedTemplateId: number | null
    onSelect: (id: number) => void
}) => {
    const { t } = useTranslation()
    const categoryLabels = buildCategoryLabel(t)

    if (!templates.length) {
        return null
    }

    return (
        <Card className="space-y-3">
            <div>
                <h5 className="text-lg font-semibold">
                    {t('settings.email.templates.title', { defaultValue: 'Active templates' })}
                </h5>
                <p className="text-sm text-gray-500">
                    {t('settings.email.templates.description', {
                        defaultValue: 'Overview of active MJML templates per category, locale, and variant.',
                    })}
                </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        onClick={() => onSelect(template.id)}
                        className={classNames(
                            'rounded border px-3 py-2 text-left transition-colors',
                            template.id === selectedTemplateId
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-200',
                        )}
                    >
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                            <span>{categoryLabels[template.category]}</span>
                            <span>{template.variant}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex justify-between">
                            <span>{template.locale.toUpperCase()}</span>
                            <span>
                                v{template.version} · {dayjs(template.updatedAt).format('YYYY-MM-DD')}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    )
}

const EmailSettings = () => {
    const { t } = useTranslation()
    const { confirm, ConfirmationDialog } = useConfirmation()
    const [activeTab, setActiveTab] = useState<EmailCategory>('ORDERS')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<Record<EmailCategory, boolean>>({
        ORDERS: false,
        PAYMENTS: false,
        AUTH: false,
    })
    const [drafts, setDrafts] = useState<Record<EmailCategory, CategoryDraft>>({
        ORDERS: {
            enabled: true,
            fromAddress: '',
            fromName: '',
            adminRecipients: [],
            cc: [],
            bcc: [],
            dirty: false,
        },
        PAYMENTS: {
            enabled: true,
            fromAddress: '',
            fromName: '',
            adminRecipients: [],
            cc: [],
            bcc: [],
            dirty: false,
        },
        AUTH: {
            enabled: true,
            fromAddress: '',
            fromName: '',
            adminRecipients: [],
            cc: [],
            bcc: [],
            dirty: false,
        },
    })
    const [roleRules, setRoleRules] = useState<RoleRuleResponse[]>([])
    const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])
    const [loadingRules, setLoadingRules] = useState(false)
    const [templates, setTemplates] = useState<EmailTemplateSummary[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
    const [templateDetail, setTemplateDetail] = useState<EmailTemplateDetail | null>(null)
    const [templateDirty, setTemplateDirty] = useState(false)
    const [templateSaving, setTemplateSaving] = useState(false)
    const [previewLocale, setPreviewLocale] = useState('en')
    const [scenarioOptions, setScenarioOptions] = useState<TemplateScenarioOption[]>([])
    const [scenarioKey, setScenarioKey] = useState<string | undefined>(undefined)
    const [preview, setPreview] = useState<EmailTemplatePreview | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [metrics, setMetrics] = useState<EmailMetrics | null>(null)
    const [metricsLoading, setMetricsLoading] = useState(false)

    const categoryLabels = useMemo(() => buildCategoryLabel(t), [t])
    const statusLabels = useMemo(() => buildStatusLabel(t), [t])
    const recipientLabels = useMemo(() => buildRecipientLabel(t), [t])
    const scenarioSelectOptions = useMemo(
        () => scenarioOptions.map((option) => ({ value: option.key, label: option.label })),
        [scenarioOptions],
    )
    const scenarioSelectValue = useMemo(
        () =>
            scenarioKey
                ? scenarioSelectOptions.find((option) => option.value === scenarioKey) ?? null
                : null,
        [scenarioKey, scenarioSelectOptions],
    )

    const mapResponseToDraft = (setting: CategorySettingResponse): CategoryDraft => ({
        enabled: setting.enabled,
        fromAddress: setting.fromAddress,
        fromName: setting.fromName ?? '',
        adminRecipients: setting.adminRecipients ?? [],
        cc: setting.cc ?? [],
        bcc: setting.bcc ?? [],
        updatedAt: setting.updatedAt,
        dirty: false,
    })

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [settingsRes, rulesRes, roleOptionsRes, templateRes] = await Promise.all([
                apiGetEmailSettings<CategorySettingResponse[]>(),
                apiGetEmailRoleRules<RoleRuleResponse[]>(),
                apiGetEmailRoleOptions<string[]>(),
                apiListEmailTemplates<EmailTemplateSummary[]>(),
            ])
            const settings = settingsRes.data ?? []
            setDrafts((prev) => {
                const next = { ...prev }
                for (const setting of settings) {
                    next[setting.category] = mapResponseToDraft(setting)
                }
                return next
            })
            setRoleRules(rulesRes.data ?? [])
            setRoleOptions(
                (roleOptionsRes.data ?? []).map((role) => ({
                    value: role,
                    label: role,
                })),
            )
            const templateList = templateRes.data ?? []
            setTemplates(templateList)
            setSelectedTemplateId((prev) => (prev !== null ? prev : templateList[0]?.id ?? null))
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
        fetchAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const updateDraft = (category: EmailCategory, key: keyof CategoryDraft, value: unknown) => {
        setDrafts((prev) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value,
                dirty: true,
            },
        }))
    }

    const handleSave = async (category: EmailCategory) => {
        const draft = drafts[category]
        if (!draft) return
        setSaving((prev) => ({ ...prev, [category]: true }))
        try {
            await apiUpdateEmailSettings<CategorySettingResponse, Partial<CategoryDraft>>(category, {
                enabled: draft.enabled,
                fromAddress: draft.fromAddress,
                fromName: draft.fromName,
                adminRecipients: draft.adminRecipients,
                cc: draft.cc,
                bcc: draft.bcc,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.saveSuccess', { defaultValue: 'Settings were updated successfully.' })}
                </Notification>,
            )
            setDrafts((prev) => ({
                ...prev,
                [category]: {
                    ...prev[category],
                    dirty: false,
                    updatedAt: new Date().toISOString(),
                },
            }))
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSaving((prev) => ({ ...prev, [category]: false }))
        }
    }

    const refreshRoleRules = async () => {
        setLoadingRules(true)
        try {
            const response = await apiGetEmailRoleRules<RoleRuleResponse[]>()
            setRoleRules(response.data ?? [])
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setLoadingRules(false)
        }
    }

    const handleToggleRule = async (rule: RoleRuleResponse, enabled: boolean) => {
        try {
            await apiUpdateEmailRoleRule<boolean, { enabled: boolean; categories: EmailCategory[]; role: string }>(
                rule.id,
                {
                    enabled,
                    categories: rule.categories,
                    role: rule.role,
                },
            )
            setRoleRules((prev) =>
                prev.map((item) =>
                    item.id === rule.id
                        ? {
                              ...item,
                              enabled,
                          }
                        : item,
                ),
            )
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        }
    }

    const handleDeleteRule = async (rule: RoleRuleResponse) => {
        const confirmed = await confirm({
            title: t('settings.email.roles.deleteTitle', {
                defaultValue: 'Delete rule',
            }),
            message: t('settings.email.roles.deleteConfirm', {
                defaultValue:
                    'Are you sure you want to delete notifications for the role "{{role}}"?',
                role: rule.role,
            }),
            confirmText: t('text.actions.delete'),
            cancelText: t('text.actions.cancel'),
        })
        if (!confirmed) {
            return
        }
        try {
            await apiDeleteEmailRoleRule<boolean>(rule.id)
            setRoleRules((prev) => prev.filter((item) => item.id !== rule.id))
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        }
    }

    const handleCreateRule = async (role: string, categories: EmailCategory[]) => {
        try {
            await apiCreateEmailRoleRule<RoleRuleResponse, { role: string; categories: EmailCategory[]; enabled: boolean }>({
                role,
                categories,
                enabled: true,
            })
            await refreshRoleRules()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        }
    }

    const handleTemplateFieldChange = (field: 'subject' | 'body', value: string) => {
        setTemplateDetail((prev) => (prev ? { ...prev, [field]: value } : prev))
        setTemplateDirty(true)
    }

    const handlePreviewRefresh = async () => {
        if (!selectedTemplateId || !templateDetail) return
        setPreviewLoading(true)
        try {
            const response = await apiPreviewEmailTemplate<EmailTemplatePreview>(selectedTemplateId, {
                locale: previewLocale,
                scenarioKey,
            })
            setPreview(response.data ?? null)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setPreviewLoading(false)
        }
    }

    const handleTemplateSave = async () => {
        if (!selectedTemplateId || !templateDetail) return
        setTemplateSaving(true)
        try {
            const response = await apiUpdateEmailTemplate<EmailTemplateDetail, Partial<EmailTemplateDetail>>(selectedTemplateId, {
                subject: templateDetail.subject,
                body: templateDetail.body,
            })
            const updated = response.data
            setTemplateDetail(updated)
            setTemplateDirty(false)
            setTemplates((prev) =>
                prev.map((item) =>
                    item.id === updated.id
                        ? {
                              ...item,
                              locale: updated.locale,
                              version: updated.version,
                              updatedAt: updated.updatedAt,
                          }
                        : item,
                ),
            )
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.templates.saveSuccess', {
                        defaultValue: 'Template updated successfully.',
                    })}
                </Notification>,
            )
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setTemplateSaving(false)
        }
    }

    useEffect(() => {
        if (!selectedTemplateId) {
            setTemplateDetail(null)
            setTemplateDirty(false)
            setScenarioOptions([])
            setScenarioKey(undefined)
            setPreview(null)
            return
        }
        let mounted = true
        const loadDetail = async () => {
            try {
                const response = await apiGetEmailTemplate<EmailTemplateDetail>(selectedTemplateId)
                if (!mounted) return
                const detail = response.data
                setTemplateDetail(detail)
                setTemplateDirty(false)
                const localeValue = detail?.locale ?? 'en'
                setPreviewLocale(localeValue)
            } catch (error: any) {
                if (!mounted) return
                toast.push(
                    <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                        {error?.response?.data?.message || error?.message || String(error)}
                    </Notification>,
                )
            }
        }
        loadDetail()
        return () => {
            mounted = false
        }
    }, [selectedTemplateId, t])

    useEffect(() => {
        if (!selectedTemplateId) {
            setScenarioOptions([])
            setScenarioKey(undefined)
            return
        }
        let mounted = true
        const loadScenarios = async () => {
            try {
                const response = await apiGetEmailTemplateSamples<{ options: TemplateScenarioOption[] }>(
                    selectedTemplateId,
                    { locale: previewLocale },
                )
                if (!mounted) return
                const options = response.data?.options ?? []
                setScenarioOptions(options)
                setScenarioKey((prev) => {
                    if (prev && options.some((option) => option.key === prev)) {
                        return prev
                    }
                    return options[0]?.key
                })
            } catch (error: any) {
                if (!mounted) return
                toast.push(
                    <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                        {error?.response?.data?.message || error?.message || String(error)}
                    </Notification>,
                )
            }
        }
        loadScenarios()
        return () => {
            mounted = false
        }
    }, [selectedTemplateId, previewLocale, t])

    useEffect(() => {
        if (!selectedTemplateId || !templateDetail) {
            setPreview(null)
            return
        }
        let mounted = true
        const loadPreview = async () => {
            setPreviewLoading(true)
            try {
                const response = await apiPreviewEmailTemplate<EmailTemplatePreview>(selectedTemplateId, {
                    locale: previewLocale,
                    scenarioKey,
                })
                if (!mounted) return
                setPreview(response.data ?? null)
            } catch (error: any) {
                if (!mounted) return
                toast.push(
                    <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                        {error?.response?.data?.message || error?.message || String(error)}
                    </Notification>,
                )
            } finally {
                if (mounted) {
                    setPreviewLoading(false)
                }
            }
        }
        loadPreview()
        return () => {
            mounted = false
        }
    }, [selectedTemplateId, templateDetail, previewLocale, scenarioKey, t])

    const loadMetrics = useCallback(async () => {
        setMetricsLoading(true)
        try {
            const response = await apiGetEmailMetrics<EmailMetrics>()
            setMetrics(response.data ?? null)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setMetricsLoading(false)
        }
    }, [t])

    useEffect(() => {
        loadMetrics()
    }, [loadMetrics])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size={32} />
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col gap-6">
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value as EmailCategory)}>
                <TabList>
                    {CATEGORY_ORDER.map((category) => (
                        <TabNav key={category} value={category}>
                            {categoryLabels[category]}
                        </TabNav>
                    ))}
                </TabList>
                {CATEGORY_ORDER.map((category) => (
                    <TabContent key={category} value={category}>
                        <CategoryForm
                            category={category}
                            draft={drafts[category]}
                            saving={saving[category]}
                            onChange={updateDraft}
                            onSave={handleSave}
                        />
                    </TabContent>
                ))}
            </Tabs>

            <RoleRulesPanel
                roleRules={roleRules}
                roleOptions={roleOptions}
                loading={loadingRules}
                onRefresh={refreshRoleRules}
                onToggle={handleToggleRule}
                onDelete={handleDeleteRule}
                onCreate={handleCreateRule}
            />

            <LogsPanel
                categoryLabels={categoryLabels}
                statusLabels={statusLabels}
                recipientLabels={recipientLabels}
            />

            <TemplatesPanel
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
            />

            {templateDetail && (
                <Card className="space-y-6">
                    <div>
                        <h5 className="text-lg font-semibold">
                            {t('settings.email.templates.editorTitle', { defaultValue: 'Template editor' })}
                        </h5>
                        <p className="text-sm text-gray-500">
                            {t('settings.email.templates.editorDescription', {
                                defaultValue: 'Adjust subject and template body, then preview with sample data before saving.',
                            })}
                        </p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-gray-600">
                                    {t('settings.email.templates.fields.subject', { defaultValue: 'Subject' })}
                                </span>
                                <Input
                                    value={templateDetail.subject}
                                    onChange={(event) => handleTemplateFieldChange('subject', event.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-gray-600">
                                    {t('settings.email.templates.fields.body', { defaultValue: 'Template body' })}
                                </span>
                                <Textarea
                                    className="min-h-[280px]"
                                    value={templateDetail.body}
                                    onChange={(event) => handleTemplateFieldChange('body', event.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="solid"
                                    type="button"
                                    disabled={!templateDirty || templateSaving}
                                    loading={templateSaving}
                                    onClick={handleTemplateSave}
                                >
                                    {t('settings.email.actions.saveTemplate', { defaultValue: 'Save template' })}
                                </Button>
                                {templateDirty && (
                                    <Badge className="bg-yellow-100 text-yellow-700">
                                        {t('settings.email.templates.unsaved', { defaultValue: 'Unsaved changes' })}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-gray-600">
                                    {t('settings.email.templates.previewSettings', { defaultValue: 'Preview settings' })}
                                </span>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <Select
                                        value={LOCALE_OPTIONS.find((option) => option.value === previewLocale) || LOCALE_OPTIONS[0]}
                                        options={LOCALE_OPTIONS}
                                        onChange={(option) => setPreviewLocale((option?.value as string) || 'en')}
                                    />
                                    <Select
                                        value={scenarioSelectValue}
                                        options={scenarioSelectOptions}
                                        placeholder={t('settings.email.templates.scenarioPlaceholder', {
                                            defaultValue: 'Scenario',
                                        })}
                                        onChange={(option) =>
                                            setScenarioKey((option?.value as string | undefined) ?? undefined)
                                        }
                                        isClearable
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <h6 className="font-semibold text-sm text-gray-600">
                                    {t('settings.email.templates.previewTitle', { defaultValue: 'Live preview' })}
                                </h6>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="plain"
                                    onClick={handlePreviewRefresh}
                                    disabled={previewLoading}
                                >
                                    {t('common.refresh', { defaultValue: 'Refresh' })}
                                </Button>
                            </div>
                            <div className="border border-gray-200 rounded overflow-hidden">
                                {previewLoading && (
                                    <div className="flex items-center justify-center py-10">
                                        <Spinner size={24} />
                                    </div>
                                )}
                                {!previewLoading && preview && (
                                    <div className="space-y-4">
                                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                                            <span className="text-sm font-semibold text-gray-700">{preview.subject}</span>
                                        </div>
                                        <div className="px-4 py-3">
                                            <div
                                                className="border border-gray-200 rounded shadow-inner overflow-auto max-h-[420px] bg-white px-4 py-3"
                                                dangerouslySetInnerHTML={{ __html: preview.html }}
                                            />
                                        </div>
                                        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                                            <span className="text-xs font-semibold text-gray-600">
                                                {t('settings.email.templates.previewText', { defaultValue: 'Plain text version' })}
                                            </span>
                                            <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded px-3 py-2">
                                                {preview.text}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                                {!previewLoading && !preview && (
                                    <div className="px-4 py-6 text-sm text-gray-500">
                                        {t('settings.email.templates.previewEmpty', { defaultValue: 'No preview available.' })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <Card className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h5 className="text-lg font-semibold">
                            {t('settings.email.metrics.title', { defaultValue: 'Delivery metrics' })}
                        </h5>
                        <p className="text-sm text-gray-500">
                            {t('settings.email.metrics.description', {
                                defaultValue: 'Stats from recent email attempts grouped by category and template.',
                            })}
                        </p>
                    </div>
                    <Button size="sm" type="button" variant="outline" loading={metricsLoading} onClick={loadMetrics}>
                        {t('common.refresh', { defaultValue: 'Refresh' })}
                    </Button>
                </div>
                {metrics ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded border border-gray-200 px-3 py-2">
                                <span className="text-xs text-gray-500">
                                    {t('settings.email.metrics.attempts', { defaultValue: 'Attempts' })}
                                </span>
                                <div className="text-lg font-semibold text-gray-700">{metrics.totals.attempts}</div>
                            </div>
                            <div className="rounded border border-gray-200 px-3 py-2">
                                <span className="text-xs text-gray-500">
                                    {t('settings.email.metrics.sent', { defaultValue: 'Sent' })}
                                </span>
                                <div className="text-lg font-semibold text-emerald-600">{metrics.totals.sent}</div>
                            </div>
                            <div className="rounded border border-gray-200 px-3 py-2">
                                <span className="text-xs text-gray-500">
                                    {t('settings.email.metrics.failed', { defaultValue: 'Failed' })}
                                </span>
                                <div className="text-lg font-semibold text-rose-600">{metrics.totals.failed}</div>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <h6 className="text-sm font-semibold text-gray-600">
                                    {t('settings.email.metrics.byCategory', { defaultValue: 'By category' })}
                                </h6>
                                <Table compact>
                                    <THead>
                                        <Tr>
                                            <Th>{t('settings.email.metrics.category', { defaultValue: 'Category' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.attemptsShort', { defaultValue: 'Att.' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.sentShort', { defaultValue: 'Sent' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.failedShort', { defaultValue: 'Fail' })}</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {Object.entries(metrics.perCategory).map(([key, value]) => (
                                            <Tr key={key}>
                                                <Td>{categoryLabels[key as EmailCategory] ?? key}</Td>
                                                <Td className="text-right">{value.attempts}</Td>
                                                <Td className="text-right">{value.sent}</Td>
                                                <Td className="text-right">{value.failed}</Td>
                                            </Tr>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                            <div className="space-y-2">
                                <h6 className="text-sm font-semibold text-gray-600">
                                    {t('settings.email.metrics.byTemplate', { defaultValue: 'By template' })}
                                </h6>
                                <Table compact>
                                    <THead>
                                        <Tr>
                                            <Th>{t('settings.email.metrics.template', { defaultValue: 'Template' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.attemptsShort', { defaultValue: 'Att.' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.sentShort', { defaultValue: 'Sent' })}</Th>
                                            <Th className="text-right">{t('settings.email.metrics.failedShort', { defaultValue: 'Fail' })}</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {Object.entries(metrics.perTemplate).map(([key, value]) => {
                                            const [category, variant, templateId] = key.split(':')
                                            return (
                                                <Tr key={key}>
                                                    <Td>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-gray-700">
                                                                {categoryLabels[category as EmailCategory] ?? category}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {variant} · #{templateId}
                                                            </span>
                                                        </div>
                                                    </Td>
                                                    <Td className="text-right">{value.attempts}</Td>
                                                    <Td className="text-right">{value.sent}</Td>
                                                    <Td className="text-right">{value.failed}</Td>
                                                </Tr>
                                            )
                                        })}
                                    </TBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">
                        {metricsLoading
                            ? t('common.loading', { defaultValue: 'Loading…' })
                            : t('settings.email.metrics.empty', { defaultValue: 'No metrics available yet.' })}
                    </div>
                )}
            </Card>
            </div>
            {ConfirmationDialog}
        </>
    )
}

export default EmailSettings
