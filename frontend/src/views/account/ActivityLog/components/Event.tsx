import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import type { CommonProps } from '@/@types/common'
import {
    DEVICE_SIGN_IN,
    LOGIN,
    PASSWORD_CHANGE,
    PROFILE_UPDATE,
    SECURITY_ALERT,
} from '../constants'

type EventProps = {
    data: {
        type: string
        dateTime: number
        userName: string
        description?: string
        metadata?: Record<string, string | undefined | null>
    }
    compact?: boolean
}

const UnixDateTime = ({ value }: { value: number }) => {
    return <>{dayjs.unix(value).format('HH:mm')}</>
}

const HighlightedText = ({ children, className }: CommonProps) => {
    return (
        <span className={`font-semibold text-gray-900 dark:text-gray-100 ${className || ''}`}>
            {children}
        </span>
    )
}

const normalizeMetadata = (
    metadata: Record<string, string | undefined | null> | undefined,
) => {
    if (!metadata) {
        return [] as Array<{ key: string; value: string }>
    }
    return Object.entries(metadata)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => ({ key, value: String(value) }))
}

const Event = ({ data }: EventProps) => {
    const { t } = useTranslation()

    const metadataEntries = normalizeMetadata(data.metadata)

    const metadataLabels: Record<string, string> = {
        device: t('account.activity.metadata.device', { defaultValue: 'Device' }),
        location: t('account.activity.metadata.location', {
            defaultValue: 'Location',
        }),
        ipAddress: t('account.activity.metadata.ipAddress', {
            defaultValue: 'IP address',
        }),
        method: t('account.activity.metadata.method', { defaultValue: 'Method' }),
        fields: t('account.activity.metadata.fields', { defaultValue: 'Fields' }),
        reason: t('account.activity.metadata.reason', { defaultValue: 'Reason' }),
        browser: t('account.activity.metadata.browser', { defaultValue: 'Browser' }),
        platform: t('account.activity.metadata.platform', {
            defaultValue: 'Platform',
        }),
    }

    let title: JSX.Element | string = ''
    let description = data.description || ''

    switch (data.type) {
        case LOGIN:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">
                        {t('account.activity.events.login', {
                            defaultValue: 'logged in successfully.',
                        })}
                    </span>
                </>
            )
            if (!description) {
                description = t('account.activity.events.loginDescription', {
                    defaultValue: 'Successful authentication recorded.',
                })
            }
            break
        case DEVICE_SIGN_IN:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">
                        {t('account.activity.events.device', {
                            defaultValue: 'signed in on a new device.',
                        })}
                    </span>
                </>
            )
            if (!description) {
                description = t('account.activity.events.deviceDescription', {
                    defaultValue:
                        'A new session was created from an unrecognized browser.',
                })
            }
            break
        case PASSWORD_CHANGE:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">
                        {t('account.activity.events.passwordChange', {
                            defaultValue: 'updated the account password.',
                        })}
                    </span>
                </>
            )
            if (!description) {
                description = t('account.activity.events.passwordDescription', {
                    defaultValue: 'Password change confirmed.',
                })
            }
            break
        case PROFILE_UPDATE:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">
                        {t('account.activity.events.profileUpdate', {
                            defaultValue: 'updated the account profile.',
                        })}
                    </span>
                </>
            )
            if (!description) {
                description = t('account.activity.events.profileDescription', {
                    defaultValue: 'Profile information was modified.',
                })
            }
            break
        case SECURITY_ALERT:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">
                        {t('account.activity.events.securityAlert', {
                            defaultValue: 'triggered a security alert.',
                        })}
                    </span>
                </>
            )
            if (!description) {
                description = t('account.activity.events.securityDescription', {
                    defaultValue: 'Unusual activity detected by the security system.',
                })
            }
            break
        default:
            title = (
                <>
                    <HighlightedText>{data.userName}</HighlightedText>
                    <span className="mx-1">{t('account.activity.events.generic', {
                        defaultValue: 'recorded an account activity.',
                    })}</span>
                </>
            )
            break
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-1 text-sm">
                    {title}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    <UnixDateTime value={data.dateTime} />
                </span>
            </div>
            {description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
            )}
            {metadataEntries.length > 0 && (
                <dl className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {metadataEntries.map((item) => (
                        <div key={item.key} className="flex gap-2">
                            <dt className="font-semibold">
                                {metadataLabels[item.key] || item.key}
                            </dt>
                            <dd className="flex-1">{item.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    )
}

export default Event
