import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import classNames from 'classnames'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import Avatar from '@/components/ui/Avatar'
import Dropdown from '@/components/ui/Dropdown'
import ScrollBar from '@/components/ui/ScrollBar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip'
import { HiOutlineBell, HiOutlineMailOpen, HiOutlineTrash } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import appConfig from '@/configs/app.config'
import {
    clearNotifications,
    fetchNotifications,
    fetchUnreadCount,
    markNotificationsRead,
    deleteNotifications,
    notificationReceived,
    selectNotifications,
    selectNotificationsMeta,
    setStreaming,
} from '@/store/slices/notifications'
import { useAppDispatch, useAppSelector } from '@/store'
import type { NotificationItem } from '@/services/NotificationService'

const notificationHeight = 'h-72'

dayjs.extend(relativeTime)

const NotificationToggle = ({
    className,
    dot,
}: {
    className?: string
    dot: boolean
}) => {
    return (
        <div className={classNames('text-2xl', className)}>
            {dot ? (
                <Badge badgeStyle={{ top: '3px', right: '6px' }} innerClass="bg-red-500">
                    <HiOutlineBell />
                </Badge>
            ) : (
                <HiOutlineBell />
            )}
        </div>
    )
}

type NotificationEntry = NotificationItem & {
    displayDate: string
    isUnread: boolean
}

const buildEntry = (item: NotificationItem): NotificationEntry => {
    const createdAt = dayjs(item.createdAt)
    return {
        ...item,
        displayDate: createdAt.format('DD MMM YYYY HH:mm'),
        isUnread: !item.readAt,
    }
}

const formatMetadataSummary = (item: NotificationItem): string | null => {
    if (!item.metadata) {
        return null
    }
    if (item.metadata.orderUuid) {
        return `#${item.metadata.orderUuid}`
    }
    if (item.metadata.orderNumber) {
        return `#${item.metadata.orderNumber}`
    }
    if (item.metadata.orderId) {
        return `#${item.metadata.orderId}`
    }
    if (item.metadata.paymentId) {
        return `Payment ${item.metadata.paymentId}`
    }
    return null
}

const hasEntityId = (value: unknown): value is string | number => {
    if (value === null || value === undefined) {
        return false
    }
    if (typeof value === 'string') {
        return value.trim().length > 0
    }
    return typeof value === 'number'
}

const resolveNotificationPath = (item: NotificationItem): string => {
    const metadata = item.metadata ?? {}
    const redirect = typeof metadata.redirectPath === 'string' ? metadata.redirectPath.trim() : ''
    if (redirect) {
        return redirect
    }
    const rawType =
        (typeof metadata.type === 'string' && metadata.type) ||
        (typeof item.eventType === 'string' ? item.eventType.toLowerCase() : '')
    const type = rawType ? rawType.toLowerCase() : ''
    const orderSegment =
        metadata.orderUuid ??
        metadata.orderNumber ??
        metadata.orderId ??
        item.orderId ??
        null
    const entityId =
        metadata.entityId ??
        orderSegment ??
        metadata.paymentId ??
        item.paymentId ??
        null

    if (type === 'order') {
        if (hasEntityId(entityId)) {
            return `/app/sales/order-details/${entityId}`
        }
        return '/app/sales/order-list'
    }
    if (type === 'quote') {
        if (hasEntityId(entityId)) {
            return `/app/sales/budget-details/${entityId}`
        }
        return '/app/sales/budget-list'
    }
    if (type === 'payment') {
        if (hasEntityId(entityId)) {
            return `/app/accounting/payments?paymentId=${entityId}`
        }
        return '/app/accounting/payments'
    }
    if (type === 'customer') {
        if (hasEntityId(entityId)) {
            return `/app/crm/customer-details?id=${entityId}`
        }
        return '/app/crm/customers'
    }
    return `/app/notifications/${item.id}`
}

const _Notification = ({ className }: { className?: string }) => {
    const dispatch = useAppDispatch()
    const notifications = useAppSelector(selectNotifications)
    const { unreadCount, loading } = useAppSelector(selectNotificationsMeta)
    const signedIn = useAppSelector((state) => state.auth.session.signedIn)
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const eventSourceRef = useRef<EventSource | null>(null)
    const hasLoadedRef = useRef(false)

    const entries = useMemo(() => notifications.map(buildEntry), [notifications])

    useEffect(() => {
        if (!signedIn) {
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
            dispatch(setStreaming(false))
            return
        }

        if (eventSourceRef.current) {
            return
        }
        const url = `${appConfig.apiPrefix}/notifications/events`
        const source = new EventSource(url, { withCredentials: true })
        eventSourceRef.current = source
        dispatch(setStreaming(true))

        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as NotificationItem
                dispatch(notificationReceived(data))
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to parse notification event', error)
            }
        }

        source.onerror = () => {
            dispatch(setStreaming(false))
            source.close()
            eventSourceRef.current = null
        }

        return () => {
            source.close()
            eventSourceRef.current = null
            dispatch(setStreaming(false))
        }
    }, [dispatch, signedIn])

    useEffect(() => {
        if (!signedIn) {
            hasLoadedRef.current = false
            dispatch(clearNotifications())
            return
        }
        void dispatch(fetchUnreadCount())
    }, [dispatch, signedIn])

    const onNotificationOpen = useCallback(() => {
        if (!signedIn) {
            return
        }
        void dispatch(
            fetchNotifications({
                page: 1,
                pageSize: 20,
            }),
        )
        hasLoadedRef.current = true
    }, [dispatch, signedIn])

    const onMarkAllAsRead = useCallback(() => {
        if (!signedIn || unreadCount === 0) {
            return
        }
        void dispatch(markNotificationsRead({ markAll: true }))
    }, [dispatch, unreadCount, signedIn])

    const onDeleteAll = useCallback(() => {
        if (!signedIn || entries.length === 0) {
            return
        }
        void dispatch(deleteNotifications({ deleteAll: true }))
    }, [dispatch, entries.length, signedIn])

    const handleDeleteNotification = useCallback(
        async (event: MouseEvent<HTMLButtonElement>, entry: NotificationEntry) => {
            event.preventDefault()
            event.stopPropagation()
            if (!signedIn) {
                return
            }
            try {
                await dispatch(deleteNotifications({ ids: [entry.id] })).unwrap()
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to delete notification', error)
            }
        },
        [dispatch, signedIn],
    )

    const handleNotificationClick = useCallback(
        async (entry: NotificationEntry) => {
            if (!signedIn) {
                return
            }
            try {
                await dispatch(markNotificationsRead({ ids: [entry.id] })).unwrap()
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to mark notification as read', error)
            }
            try {
                const path = resolveNotificationPath(entry)
                navigate(path)
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to redirect from notification:', err)
            }
        },
        [dispatch, navigate, signedIn],
    )

    const noResult = entries.length === 0 && !loading

    return (
        <Dropdown
            renderTitle={
                <NotificationToggle dot={unreadCount > 0} className={className} />
            }
            menuClass="p-0 min-w-[280px] md:min-w-[340px]"
            placement="bottom-end"
            onOpen={onNotificationOpen}
        >
            <Dropdown.Item variant="header">
                <div className="border-b border-gray-200 dark:border-gray-600 px-4 py-2 flex items-center justify-between">
                    <h6>{t('notification.title')}</h6>
                    <Tooltip title={t('notification.markAllRead')}>
                        <Button
                            variant="plain"
                            shape="circle"
                            size="sm"
                            disabled={unreadCount === 0}
                            icon={<HiOutlineMailOpen className="text-xl" />}
                            onClick={onMarkAllAsRead}
                        />
                    </Tooltip>
                    <Tooltip title={t('notification.deleteAll')}>
                        <Button
                            variant="plain"
                            shape="circle"
                            size="sm"
                            disabled={entries.length === 0}
                            icon={<HiOutlineTrash className="text-xl" />}
                            onClick={onDeleteAll}
                        />
                    </Tooltip>
                </div>
            </Dropdown.Item>
            <div className={classNames('overflow-y-auto', notificationHeight)}>
                <ScrollBar>
                    {entries.length > 0 &&
                        entries.map((item) => {
                            const summary = formatMetadataSummary(item)
                            return (
                                <div
                                    key={item.id}
                                    className={classNames(
                                        'relative flex px-4 py-4 cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-black/20',
                                        'border-b border-gray-200 dark:border-gray-600 last:border-b-0',
                                        item.isUnread
                                            ? 'bg-blue-50/80 dark:bg-blue-500/20'
                                            : 'bg-white dark:bg-transparent opacity-75',
                                    )}
                                    onClick={() => void handleNotificationClick(item)}
                                >
                                    <Avatar
                                        shape="circle"
                                        className={classNames(
                                            'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100',
                                        )}
                                    >
                                        {item.eventType?.[0] ?? 'N'}
                                    </Avatar>
                                    <div className="ltr:ml-3 rtl:mr-3 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold heading-text truncate">
                                                {item.title ?? t('notification.untitled')}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                    {dayjs(item.createdAt)
                                                        .locale(i18n.language)
                                                        .fromNow()}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                    aria-label={t('notification.deleteOne')}
                                                    onClick={(event) =>
                                                        void handleDeleteNotification(event, item)
                                                    }
                                                >
                                                    <HiOutlineTrash className="text-base" />
                                                </button>
                                            </div>
                                        </div>
                                        {summary && (
                                            <div className="text-xs text-gray-500">{summary}</div>
                                        )}
                                        {item.body && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                {item.body}
                                            </p>
                                        )}
                                    </div>
                                    <Badge
                                        className="absolute top-4 ltr:right-4 rtl:left-4 mt-1.5"
                                        innerClass={classNames(
                                            item.isUnread
                                                ? 'bg-red-500'
                                                : 'bg-gray-300 dark:bg-gray-600',
                                        )}
                                    />
                                </div>
                            )
                        })}
                    {noResult && (
                        <div
                            className={classNames(
                                'flex items-center justify-center',
                                notificationHeight,
                            )}
                        >
                            <div className="text-center px-6">
                                <img
                                    className="mx-auto mb-2 max-w-[150px]"
                                    src="/img/others/no-notification.png"
                                    alt="no-notification"
                                />
                                <h6 className="font-semibold">
                                    {t('notification.empty.title')}
                                </h6>
                                <p className="mt-1 text-sm text-gray-500">
                                    {t('notification.empty.desc')}
                                </p>
                            </div>
                        </div>
                    )}
                </ScrollBar>
            </div>
            <Dropdown.Item variant="header">
                <div className="flex justify-center border-t border-gray-200 dark:border-gray-600 px-4 py-2 text-sm text-gray-500">
                    {loading
                        ? t('notification.loading')
                        : hasLoadedRef.current
                          ? t('notification.lastUpdated', {
                                date: dayjs().locale(i18n.language).format('DD MMM YYYY HH:mm'),
                            })
                          : t('notification.viewRecent')}
                </div>
            </Dropdown.Item>
        </Dropdown>
    )
}

const Notification = withHeaderItem(_Notification)

export default Notification
