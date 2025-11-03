import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Switcher from '@/components/ui/Switcher'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import {
    apiGetEmailConfig,
    apiUpdateEmailConfig,
    apiSendTestEmailConfig,
    EmailConfigPayload,
} from '@/services/EmailConfigService'
import { HiOutlineMail } from 'react-icons/hi'

const PROVIDER_OPTIONS = [
    { value: 'SMTP', label: 'SMTP' },
    { value: 'SENDGRID', label: 'SendGrid' },
    { value: 'DEV', label: 'Developer (local file)' },
]

type ProviderOptionValue = (typeof PROVIDER_OPTIONS)[number]['value']

type Draft = {
    provider: ProviderOptionValue
    fromAddress: string
    fromName: string
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    allowInvalidCerts: boolean
    smtpUser: string
    smtpPassword: string
    dirty: boolean
}

const DEFAULT_DRAFT: Draft = {
    provider: 'DEV',
    fromAddress: '',
    fromName: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    allowInvalidCerts: false,
    smtpUser: '',
    smtpPassword: '',
    dirty: false,
}

const EmailConfigurationForm = () => {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sendingTest, setSendingTest] = useState(false)
    const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
    const [testRecipient, setTestRecipient] = useState('')

    const smtpVisible = useMemo(() => draft.provider === 'SMTP', [draft.provider])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const response = await apiGetEmailConfig<EmailConfigPayload>()
            const data = response.data
            if (data) {
                setDraft({
                    provider: data.provider,
                    fromAddress: data.fromAddress,
                    fromName: data.fromName,
                    smtpHost: data.smtp?.host ?? '',
                    smtpPort: data.smtp?.port ?? 587,
                    smtpSecure: data.smtp?.secure ?? false,
                    allowInvalidCerts: data.smtp?.allowInvalidCerts ?? false,
                    smtpUser: data.smtp?.user ?? '',
                    smtpPassword: '',
                    dirty: false,
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

    const handleChange = <K extends keyof Draft>(key: K, value: Draft[K]) => {
        setDraft((prev) => ({
            ...prev,
            [key]: value,
            dirty: true,
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiUpdateEmailConfig({
                provider: draft.provider,
                fromAddress: draft.fromAddress,
                fromName: draft.fromName,
                smtp:
                    draft.provider === 'SMTP'
                        ? {
                              host: draft.smtpHost,
                              port: draft.smtpPort,
                              secure: draft.smtpSecure,
                              allowInvalidCerts: draft.allowInvalidCerts,
                              user: draft.smtpUser || undefined,
                              password: draft.smtpPassword || undefined,
                          }
                        : null,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.email.config.saveSuccess', { defaultValue: 'Configuration saved successfully.' })}
                </Notification>,
            )
            setDraft((prev) => ({ ...prev, dirty: false, smtpPassword: '' }))
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
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.provider', { defaultValue: 'Provider' })}
                    </span>
                    <Select
                        options={PROVIDER_OPTIONS}
                        value={PROVIDER_OPTIONS.find((option) => option.value === draft.provider) ?? PROVIDER_OPTIONS[0]}
                        onChange={(option) => handleChange('provider', (option?.value as ProviderOptionValue) || 'DEV')}
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromAddress', { defaultValue: 'From address' })}
                    </span>
                    <Input value={draft.fromAddress} onChange={(event) => handleChange('fromAddress', event.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-600">
                        {t('settings.email.config.fromName', { defaultValue: 'From name' })}
                    </span>
                    <Input value={draft.fromName} onChange={(event) => handleChange('fromName', event.target.value)} />
                </div>
            </div>

            {smtpVisible && (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpHost', { defaultValue: 'SMTP host' })}
                            </span>
                            <Input value={draft.smtpHost} onChange={(event) => handleChange('smtpHost', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpPort', { defaultValue: 'SMTP port' })}
                            </span>
                            <Input
                                type="number"
                                value={draft.smtpPort}
                                onChange={(event) => handleChange('smtpPort', Number(event.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpUser', { defaultValue: 'SMTP user' })}
                            </span>
                            <Input value={draft.smtpUser} onChange={(event) => handleChange('smtpUser', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-semibold text-gray-600">
                                {t('settings.email.config.smtpPassword', { defaultValue: 'SMTP password' })}
                            </span>
                            <Input
                                type="password"
                                value={draft.smtpPassword}
                                onChange={(event) => handleChange('smtpPassword', event.target.value)}
                                placeholder={
                                    draft.smtpPassword
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
                            <Switcher checked={draft.smtpSecure} onChange={(value) => handleChange('smtpSecure', value)} />
                        </div>
                        <div className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                            <span className="text-sm text-gray-600">
                                {t('settings.email.config.allowInvalidCerts', { defaultValue: 'Allow invalid certificates' })}
                            </span>
                            <Switcher
                                checked={draft.allowInvalidCerts}
                                onChange={(value) => handleChange('allowInvalidCerts', value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="solid" disabled={saving || !draft.dirty} loading={saving} onClick={handleSave}>
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
    )
}

export default EmailConfigurationForm
