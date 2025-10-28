import { useEffect, useMemo } from 'react'
import Card from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import Switcher from '@/components/ui/Switcher'
import Select from '@/components/ui/Select'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useAppDispatch, useAppSelector } from '@/store'
import {
    fetchNotificationSettings,
    selectNotificationSettings,
    updateNotificationSettings,
} from '@/store/slices/notifications'
import type { NotificationSettingDto } from '@/services/NotificationService'
import { ROLE_OPTIONS } from '@/constants/roles.constant'
import { useTranslation } from 'react-i18next'

const CHANNEL_LABELS: Record<string, string> = {
    IN_APP: 'account.settings.notification.channels.inApp',
    EMAIL: 'account.settings.notification.channels.email',
    PUSH: 'account.settings.notification.channels.push',
}

const EVENT_CONFIG: Array<{
    eventType: string
    titleKey: string
    descriptionKey: string
}> = [
    {
        eventType: 'ORDER_RECEIVED',
        titleKey: 'account.settings.notification.events.orderReceived.title',
        descriptionKey: 'account.settings.notification.events.orderReceived.desc',
    },
    {
        eventType: 'PAYMENT_RECEIVED',
        titleKey: 'account.settings.notification.events.paymentReceived.title',
        descriptionKey: 'account.settings.notification.events.paymentReceived.desc',
    },
    {
        eventType: 'ORDER_STATUS_CHANGED',
        titleKey: 'account.settings.notification.events.orderStatusChanged.title',
        descriptionKey: 'account.settings.notification.events.orderStatusChanged.desc',
    },
]

type SettingKey = {
    eventType: string
    audience: string
    channel: string
}

const buildKey = ({ eventType, audience, channel }: SettingKey) =>
    `${eventType}:${audience}:${channel}`

const groupSettings = (records: NotificationSettingDto[]) => {
    const map = new Map<string, NotificationSettingDto>()
    records.forEach((record) => {
        map.set(
            buildKey({
                eventType: record.eventType,
                audience: record.audience,
                channel: record.channel,
            }),
            record,
        )
    })
    return map
}

const NotificationSetting = () => {
    const dispatch = useAppDispatch()
    const { records, loading, error } = useAppSelector(
        selectNotificationSettings,
    )
    const { t } = useTranslation()

    useEffect(() => {
        if (!records.length) {
            void dispatch(fetchNotificationSettings())
        }
    }, [dispatch, records.length])

    useEffect(() => {
        if (error) {
            toast.push(
                <Notification title={t('common.error')} type="danger" duration={5000}>
                    {error}
                </Notification>,
                { placement: 'top-center' },
            )
        }
    }, [error, t])

    const settingsMap = useMemo(() => groupSettings(records), [records])

    const handleToggle = (setting: NotificationSettingDto, enabled: boolean) => {
        void dispatch(
            updateNotificationSettings([
                {
                    eventType: setting.eventType,
                    audience: setting.audience,
                    channel: setting.channel,
                    enabled,
                    roles: setting.roles ?? [],
                    templateKey: setting.templateKey ?? undefined,
                    emailSubject: setting.emailSubject ?? undefined,
                    localeOverrides: setting.localeOverrides ?? undefined,
                },
            ]),
        )
    }

    const handleRolesChange = (setting: NotificationSettingDto, roles: string[]) => {
        void dispatch(
            updateNotificationSettings([
                {
                    eventType: setting.eventType,
                    audience: setting.audience,
                    channel: setting.channel,
                    enabled: setting.enabled,
                    roles,
                    templateKey: setting.templateKey ?? undefined,
                    emailSubject: setting.emailSubject ?? undefined,
                    localeOverrides: setting.localeOverrides ?? undefined,
                },
            ]),
        )
    }

    const renderChannelToggle = (
        setting: NotificationSettingDto | undefined,
        disabled = false,
    ) => {
        if (!setting) {
            return null
        }
        const labelKey = CHANNEL_LABELS[setting.channel] ?? setting.channel
        return (
            <div className="flex items-center justify-between py-2" key={setting.channel}>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t(labelKey)}
                </span>
                <Switcher
                    checked={setting.enabled}
                    disabled={disabled}
                    onChange={(checked) => handleToggle(setting, checked)}
                />
            </div>
        )
    }

    const renderAudienceSection = (
        eventType: string,
        audience: 'ADMIN' | 'CUSTOMER',
    ) => {
        const channels = ['IN_APP', 'EMAIL']
        return (
            <div className="mt-4" key={`${eventType}-${audience}`}>
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    {t(
                        audience === 'ADMIN'
                            ? 'account.settings.notification.audience.admin'
                            : 'account.settings.notification.audience.customer',
                    )}
                </h5>
                <div className="space-y-2">
                    {channels.map((channel) => {
                        const setting = settingsMap.get(
                            buildKey({ eventType, audience, channel }),
                        )
                        const isPush = channel === 'PUSH'
                        return renderChannelToggle(setting, isPush)
                    })}
                </div>
                {audience === 'ADMIN' && (
                    <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">
                            {t('account.settings.notification.roles.hint')}
                        </p>
                        <Select
                            isMulti
                            isClearable={false}
                            value={(settingsMap.get(
                                buildKey({
                                    eventType,
                                    audience,
                                    channel: 'IN_APP',
                                }),
                            )?.roles ?? []).map((role) => ({
                                label: ROLE_OPTIONS.find((opt) => opt.value === role)?.label ?? role,
                                value: role,
                            }))}
                            options={ROLE_OPTIONS}
                            onChange={(options) => {
                                const roles = Array.isArray(options)
                                    ? options.map((option) => option.value)
                                    : []
                                const baseSetting = settingsMap.get(
                                    buildKey({
                                        eventType,
                                        audience,
                                        channel: 'IN_APP',
                                    }),
                                )
                                if (baseSetting) {
                                    handleRolesChange(baseSetting, roles)
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        )
    }

    if (loading && !records.length) {
        return (
            <div className="flex justify-center py-10">
                <Spinner size={30} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {EVENT_CONFIG.map((event) => (
                <Card key={event.eventType} className="p-5">
                    <div className="border-b border-gray-200 dark:border-gray-600 pb-4 mb-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            {t(event.titleKey)}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {t(event.descriptionKey)}
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        {renderAudienceSection(event.eventType, 'CUSTOMER')}
                        {renderAudienceSection(event.eventType, 'ADMIN')}
                    </div>
                </Card>
            ))}
        </div>
    )
}

export default NotificationSetting
