import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Input from '@/components/ui/Input'
import Switcher from '@/components/ui/Switcher'
import { FormContainer, FormItem } from '@/components/ui/Form'
import {
    apiCreateInboxAccount,
    apiGetInboxAccounts,
    apiSyncInboxAccount,
    apiUpdateInboxAccount,
    type InboxAccountDto,
} from '@/services/InboxService'
import {
    apiGetInboxEmailConfig,
    type InboxEmailConfigResponse,
} from '@/services/EmailConfigService'
import { HiOutlineExternalLink, HiOutlinePencilAlt, HiOutlineRefresh } from 'react-icons/hi'

type AccountFormState = {
    id: string | null
    address: string
    displayName: string
    active: boolean
}

const emptyForm: AccountFormState = {
    id: null,
    address: '',
    displayName: '',
    active: true,
}

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

const normalizeChannel = (value: string) => value.trim().toUpperCase()

const sortAccounts = (accounts: InboxAccountDto[]) =>
    [...accounts].sort((left, right) => {
        if (left.active !== right.active) {
            return left.active ? -1 : 1
        }
        const leftLabel = (left.displayName || left.address || left.id).toLowerCase()
        const rightLabel = (right.displayName || right.address || right.id).toLowerCase()
        return leftLabel.localeCompare(rightLabel)
    })

const ChannelsEmailSettings = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [savingAccount, setSavingAccount] = useState(false)
    const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
    const [accounts, setAccounts] = useState<InboxAccountDto[]>([])
    const [inboxConfig, setInboxConfig] = useState<InboxEmailConfigResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState<AccountFormState>(emptyForm)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [accountsResponse, inboxResponse] = await Promise.all([
                apiGetInboxAccounts({
                    channel: 'EMAIL',
                    includeInactive: true,
                    includeUnconfigured: true,
                }),
                apiGetInboxEmailConfig(),
            ])

            setAccounts(
                Array.isArray(accountsResponse.data)
                    ? accountsResponse.data.filter(
                          (account) => normalizeChannel(account.channel) === 'EMAIL',
                      )
                    : [],
            )
            setInboxConfig(inboxResponse.data)
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

    const editingAccount = useMemo(
        () => accounts.find((account) => account.id === form.id) ?? null,
        [accounts, form.id],
    )

    const fillFormFromAccount = useCallback((account: InboxAccountDto) => {
        setForm({
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
                <Notification type="success" title="Inbox account synced">
                    The account was refreshed and its mailboxes are ready for messages.
                </Notification>,
                { placement: 'top-end' },
            )
            await load()
        } catch (requestError) {
            toast.push(
                <Notification type="danger" title="Unable to sync inbox account">
                    {(requestError as Error).message}
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSyncingAccountId(null)
        }
    }, [load])

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
                        title={account.active ? 'Account deactivated' : 'Account activated'}
                    >
                        The inbox account status was updated.
                    </Notification>,
                    { placement: 'top-end' },
                )
                await load()
                if (form.id === account.id) {
                    resetForm()
                }
            } catch (requestError) {
                toast.push(
                    <Notification type="danger" title="Unable to update account">
                        {(requestError as Error).message}
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setSavingAccount(false)
            }
        },
        [form.id, load, resetForm],
    )

    const handleSave = useCallback(async () => {
        setSavingAccount(true)
        try {
            const payload = {
                address: form.address.trim(),
                displayName: form.displayName.trim() || null,
                active: form.active,
            }

            if (form.id) {
                await apiUpdateInboxAccount(form.id, payload)
                toast.push(
                    <Notification type="success" title="Inbox account updated">
                        The account is now ready for message routing.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } else {
                await apiCreateInboxAccount(payload)
                toast.push(
                    <Notification type="success" title="Inbox account created">
                        The new email account was added to the channel registry.
                    </Notification>,
                    { placement: 'top-end' },
                )
            }
            await load()
            resetForm()
        } catch (requestError) {
            toast.push(
                <Notification type="danger" title="Unable to save inbox account">
                    {(requestError as Error).message}
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSavingAccount(false)
        }
    }, [form, load, resetForm])

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
                                Channels
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                Email channel
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                This channel controls the operational email accounts that
                                later appear inside CRM messages. Use it to add, edit,
                                activate or deactivate one or many mailboxes before
                                syncing them with the inbox runtime.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-indigo-50 text-indigo-700">
                                {accounts.length} accounts
                            </Badge>
                            <Badge className="bg-emerald-50 text-emerald-700">
                                {activeAccounts.length} active
                            </Badge>
                            <Button
                                type="button"
                                variant="plain"
                                icon={<HiOutlineRefresh />}
                                onClick={() => void load()}
                                disabled={loading}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-3">
                    <Card className="xl:col-span-1">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Transport snapshot
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Current inbox transport settings projected from the
                                    channel control plane.
                                </p>
                            </div>
                            <Badge
                                className={
                                    inboxConfig?.source === 'database'
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'bg-gray-100 text-gray-600'
                                }
                            >
                                {inboxConfig?.source ?? 'environment'}
                            </Badge>
                        </div>

                        <dl className="mt-5 space-y-4 text-sm">
                            <div>
                                <dt className="text-gray-500">Updated at</dt>
                                <dd className="font-medium text-gray-900">
                                    {formatDateTime(inboxConfig?.updatedAt ?? null)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">IMAP</dt>
                                <dd className="font-medium text-gray-900">
                                    {inboxConfig?.imapHost || 'Not configured'}:{' '}
                                    {inboxConfig?.imapPort ?? 'n/a'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">SMTP</dt>
                                <dd className="font-medium text-gray-900">
                                    {inboxConfig?.smtpHost || 'Not configured'}:{' '}
                                    {inboxConfig?.smtpPort ?? 'n/a'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Sender</dt>
                                <dd className="font-medium text-gray-900">
                                    {inboxConfig?.fromAddress || 'Not configured'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Username</dt>
                                <dd className="font-medium text-gray-900">
                                    {inboxConfig?.username || 'Not configured'}
                                </dd>
                            </div>
                        </dl>
                    </Card>

                    <Card className="xl:col-span-1">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Account editor
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Create or update the accounts that will be reflected
                                    in CRM messages.
                                </p>
                            </div>
                            <Badge className={form.id ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>
                                {form.id ? 'Editing' : 'New'}
                            </Badge>
                        </div>

                        <FormContainer className="mt-5 space-y-4">
                            <FormItem label="Email address" asterisk>
                                <Input
                                    type="email"
                                    value={form.address}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            address: event.target.value,
                                        }))
                                    }
                                    placeholder="support@example.com"
                                />
                            </FormItem>
                            <FormItem label="Display name">
                                <Input
                                    value={form.displayName}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            displayName: event.target.value,
                                        }))
                                    }
                                    placeholder="Support inbox"
                                />
                            </FormItem>
                            <FormItem label="Active">
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

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="solid"
                                    loading={savingAccount}
                                    disabled={!form.address.trim()}
                                    onClick={() => void handleSave()}
                                >
                                    {form.id ? 'Update account' : 'Create account'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="plain"
                                    disabled={savingAccount && !form.id}
                                    onClick={resetForm}
                                >
                                    Reset
                                </Button>
                            </div>
                        </FormContainer>

                        {editingAccount ? (
                            <Alert className="mt-4 border-indigo-200 bg-indigo-50 text-indigo-800">
                                Editing {editingAccount.displayName || editingAccount.address || editingAccount.id}
                            </Alert>
                        ) : null}
                    </Card>

                    <Card className="xl:col-span-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Registered email accounts
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    These accounts surface later in CRM messages and
                                    thread routing.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="plain"
                                onClick={() => resetForm()}
                            >
                                New account
                            </Button>
                        </div>

                        <div className="mt-5 overflow-hidden rounded border border-gray-200">
                            {sortedAccounts.length === 0 ? (
                                <div className="p-6 text-sm text-gray-500">
                                    No EMAIL inbox accounts are available yet.
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                Account
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">
                                                Updated
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {sortedAccounts.map((account) => (
                                            <tr key={account.id}>
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-gray-900">
                                                        {account.displayName || account.address || account.id}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {account.address || 'No address set'}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <Badge
                                                            className={
                                                                account.active
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }
                                                        >
                                                            {account.active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                        <Badge className="bg-sky-50 text-sky-700">
                                                            {account.channel}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-gray-600">
                                                    {account.active
                                                        ? 'Visible in messages'
                                                        : 'Hidden from normal routing'}
                                                </td>
                                                <td className="px-4 py-4 text-gray-600">
                                                    {formatDateTime(account.updatedAt ?? null)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="plain"
                                                            icon={<HiOutlinePencilAlt />}
                                                            onClick={() => fillFormFromAccount(account)}
                                                        >
                                                            Edit
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
                                                            Messages
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="twoTone"
                                                            loading={syncingAccountId === account.id}
                                                            disabled={Boolean(syncingAccountId)}
                                                            onClick={() => void handleSyncAccount(account.id)}
                                                        >
                                                            Sync
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={account.active ? 'plain' : 'solid'}
                                                            disabled={savingAccount}
                                                            onClick={() => void handleToggleActive(account)}
                                                        >
                                                            {account.active ? 'Deactivate' : 'Activate'}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
