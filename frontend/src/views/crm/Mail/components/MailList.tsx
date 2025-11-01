import { useEffect, useMemo, useRef } from 'react'
import classNames from 'classnames'
import ScrollBar from '@/components/ui/ScrollBar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Loading from '@/components/shared/Loading'
import useTwColorByName from '@/utils/hooks/useTwColorByName'
import { resolveAvatarSrc } from '@/utils/avatar'
import acronym from '@/utils/acronym'
import {
    HiOutlineFlag,
    HiStar,
    HiPaperClip,
    HiMenu,
    HiMenuAlt2,
} from 'react-icons/hi'
import {
    getMails,
    patchMail,
    updateMailId,
    toggleSidebar,
    toggleMobileSidebar,
    updateReply,
    fetchInboxMessages,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { initialState as initialMailState } from '../store/mailSlice'
import useResponsive from '@/utils/hooks/useResponsive'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { MouseEvent } from 'react'
import type { Mail } from '../store'
import { getAttachmentIcon } from '../utils/attachments'
import { buildConversationKey, normalizeString } from '../utils/conversations'
import { upsertMailLocalState } from '../utils/localMailState'

type AggregatedMail = Mail & {
    conversationMailIds: Array<string | number>
}

type ToggleButtonProps = {
    sideBarExpand: boolean
    mobileSidebarExpand: boolean
}

const AUTO_REFRESH_INTERVAL = 30_000

const htmlReg = /(<([^>]+)>)/gi

const getMailTimestamp = (mail: Mail) => {
    const sources = [
        mail.receivedAt,
        mail.sentAt,
        mail.message?.[0]?.receivedAt,
        mail.message?.[0]?.sentAt,
    ].filter(Boolean) as string[]
    for (const source of sources) {
        const parsed = Date.parse(source)
        if (!Number.isNaN(parsed)) {
            return parsed
        }
    }
    return 0
}

const formatMailDate = (mail: Mail) => {
    const sources = [
        mail.receivedAt,
        mail.sentAt,
        mail.message?.[0]?.receivedAt,
        mail.message?.[0]?.sentAt,
    ].filter(Boolean) as string[]
    for (const source of sources) {
        const parsed = Date.parse(source)
        if (!Number.isNaN(parsed)) {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(parsed)
        }
    }
    return mail.message?.[0]?.date ?? ''
}

const ToggleButton = ({
    sideBarExpand,
    mobileSidebarExpand,
}: ToggleButtonProps) => {
    const dispatch = useAppDispatch()

    const { smaller } = useResponsive()

    const onSideBarToggle = () => {
        dispatch(toggleSidebar(!sideBarExpand))
    }

    const onMobileSideBar = () => {
        dispatch(toggleMobileSidebar(!mobileSidebarExpand))
    }

    return (
        <Button
            icon={
                smaller.xl ? (
                    mobileSidebarExpand ? (
                        <HiMenu />
                    ) : (
                        <HiMenuAlt2 />
                    )
                ) : sideBarExpand ? (
                    <HiMenu />
                ) : (
                    <HiMenuAlt2 />
                )
            }
            size="sm"
            variant="plain"
            shape="circle"
            onClick={smaller.xl ? onMobileSideBar : onSideBarToggle}
        />
    )
}

const MailList = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const colorByName = useTwColorByName()
    const mailState = useAppSelector(
        (state) => state.crmMail?.data ?? initialMailState,
    )
    const mails = mailState.mailList
    const mailId = mailState.selectedMailId
    const loading = mailState.mailListLoading
    const sideBarExpand = mailState.sideBarExpand
    const mobileSidebarExpand = mailState.mobileSideBarExpand
    const selectedCategory = mailState.selectedCategory

    const inboxState = mailState.inbox
    const selectedInboxAccountId = inboxState.selectedAccountId
    const selectedInboxMailboxId = inboxState.selectedMailboxId
    const inboxMessagesKey =
        selectedInboxAccountId && selectedInboxMailboxId
            ? `${selectedInboxAccountId}:${selectedInboxMailboxId}`
            : null
    const selectedMessagesStatus = inboxMessagesKey
        ? inboxState.messagesRequestStatus[inboxMessagesKey]
        : undefined
    const selectedMessagesError = inboxMessagesKey
        ? inboxState.messagesErrorByMailbox[inboxMessagesKey]
        : null

    const pollTimerRef = useRef<number | null>(null)
    const messagesStatusRef = useRef(inboxState.messagesRequestStatus)
    const lastFetchedRef = useRef(inboxState.lastFetchedAtByMailbox)

    const direction = useAppSelector((state) => state.theme.direction)
    const messagesUnavailableText = t('crm.mail.messagesUnavailable', {
        defaultValue:
            'Unable to load inbox messages right now. Please try again later.',
    })
    const resolvedMessagesError =
        !selectedMessagesError ||
        selectedMessagesError === 'Unable to load inbox messages.'
            ? messagesUnavailableText
            : selectedMessagesError

    const navigate = useNavigate()
    const location = useLocation()

    const fetchData = (data: { category: string }) => {
        dispatch(getMails(data))
    }

    useEffect(() => {
        messagesStatusRef.current = inboxState.messagesRequestStatus
    }, [inboxState.messagesRequestStatus])

    useEffect(() => {
        lastFetchedRef.current = inboxState.lastFetchedAtByMailbox
    }, [inboxState.lastFetchedAtByMailbox])

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const category = { category: path }

        if (path === 'mail') {
            category.category = 'inbox'
        }

        fetchData(category)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname])

    useEffect(() => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId) {
            return
        }
        dispatch(
            fetchInboxMessages({
                accountId: selectedInboxAccountId,
                mailbox: selectedInboxMailboxId,
            }),
        )
    }, [dispatch, selectedInboxAccountId, selectedInboxMailboxId])

    useEffect(() => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId) {
            if (pollTimerRef.current) {
                window.clearTimeout(pollTimerRef.current)
                pollTimerRef.current = null
            }
            return
        }
        if (typeof window === 'undefined') {
            return
        }
        let active = true
        const schedule = () => {
            if (!active) {
                return
            }
            pollTimerRef.current = window.setTimeout(() => {
                if (!active) {
                    return
                }
                const key = `${selectedInboxAccountId}:${selectedInboxMailboxId}`
                const status = messagesStatusRef.current[key]
                if (status === 'loading') {
                    schedule()
                    return
                }
                const since = lastFetchedRef.current[key]
                if (!since) {
                    schedule()
                    return
                }
                dispatch(
                    fetchInboxMessages({
                        accountId: selectedInboxAccountId,
                        mailbox: selectedInboxMailboxId,
                        since,
                    }),
                )
                schedule()
            }, AUTO_REFRESH_INTERVAL)
        }
        schedule()
        return () => {
            active = false
            if (pollTimerRef.current) {
                window.clearTimeout(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }
    }, [dispatch, selectedInboxAccountId, selectedInboxMailboxId])

    const parseHtml = (content: string) => {
        if (!content) {
            return ''
        }
        const text = content.replace(htmlReg, '')
        return text.length > 60 ? text.substring(0, 57) + '...' : text
    }

    const aggregatedMails = useMemo<AggregatedMail[]>(() => {
        const conversationMap = new Map<
            string,
            {
                mail: AggregatedMail
                hasUnread: boolean
                hasStarred: boolean
                hasFlagged: boolean
            }
        >()
        const keyIndex = new Map<string, string>()

        const buildKeyCandidates = (mail: Mail): string[] => {
            const candidates: string[] = []
            if (mail.messageUid) {
                candidates.push(`uid:${String(mail.messageUid)}`)
            }
            const remoteIdRaw = (mail as { remoteId?: string | number | null })
                ?.remoteId
            if (remoteIdRaw !== undefined && remoteIdRaw !== null) {
                const remoteId = String(remoteIdRaw).trim()
                if (remoteId) {
                    candidates.push(`remote:${remoteId}`)
                }
            }
            const metadata = (mail.metadata ?? {}) as Record<string, unknown>
            const metadataMessageId = (() => {
                const direct = metadata.messageId
                if (typeof direct === 'string' && direct.trim()) {
                    return direct.trim()
                }
                const headers = metadata.headers as
                    | Record<string, unknown>
                    | undefined
                if (headers) {
                    const headerValue = headers['message-id']
                    if (typeof headerValue === 'string' && headerValue.trim()) {
                        return headerValue.trim()
                    }
                }
                return null
            })()
            if (metadataMessageId) {
                const normalized = normalizeString(
                    metadataMessageId.replace(/[<>]/g, ''),
                )
                if (normalized) {
                    candidates.push(`message-id:${normalized}`)
                }
            }
            const gmailId = (() => {
                const value = metadata.gmailId ?? metadata.gmail_id
                return typeof value === 'string' && value.trim()
                    ? value.trim()
                    : null
            })()
            if (gmailId) {
                const normalized = normalizeString(gmailId)
                if (normalized) {
                    candidates.push(`gmail:${normalized}`)
                }
            }
            const gmailThreadId = (() => {
                const value =
                    metadata.gmailThreadId ?? metadata.gmail_thread_id
                return typeof value === 'string' && value.trim()
                    ? value.trim()
                    : null
            })()
            if (gmailThreadId) {
                const normalized = normalizeString(gmailThreadId)
                if (normalized) {
                    candidates.push(`gmail-thread:${normalized}`)
                }
            }
            const threadIdRaw = (mail as { threadRemoteId?: string | null })
                ?.threadRemoteId
            if (threadIdRaw) {
                const normalizedThread = normalizeString(threadIdRaw)
                if (normalizedThread) {
                    candidates.push(`thread:${normalizedThread}`)
                }
            }
            const conversationKey = buildConversationKey(mail)
            if (conversationKey) {
                candidates.push(conversationKey)
            }
            if (mail.id !== undefined && mail.id !== null) {
                candidates.push(`id:${String(mail.id)}`)
            }
            return candidates
        }

        const resolveCanonicalKey = (mail: Mail, candidates: string[]) => {
            for (const candidate of candidates) {
                if (!candidate) {
                    continue
                }
                const canonical = keyIndex.get(candidate)
                if (canonical) {
                    candidates.forEach((key) => {
                        if (key) {
                            keyIndex.set(key, canonical)
                        }
                    })
                    return canonical
                }
            }
            const canonical =
                candidates.find((candidate) => Boolean(candidate)) ??
                `id:${String(mail.id ?? Math.random())}`
            candidates.forEach((key) => {
                if (key) {
                    keyIndex.set(key, canonical)
                }
            })
            return canonical
        }

        mails.forEach((mail) => {
            const candidates = buildKeyCandidates(mail)
            const canonicalKey = resolveCanonicalKey(mail, candidates)
            const baseMail: AggregatedMail = {
                ...mail,
                message: mail.message ? [...mail.message] : [],
                conversationMailIds: [mail.id],
            }
            const existing = conversationMap.get(canonicalKey)
            if (!existing) {
                conversationMap.set(canonicalKey, {
                    mail: baseMail,
                    hasUnread: mail.isRead === false,
                    hasStarred: Boolean(mail.starred),
                    hasFlagged: Boolean(mail.flagged),
                })
                return
            }
            const conversationIds = new Set([
                ...existing.mail.conversationMailIds,
                mail.id,
            ])
            const candidateTimestamp = getMailTimestamp(baseMail)
            const existingTimestamp = getMailTimestamp(existing.mail)
            if (candidateTimestamp > existingTimestamp) {
                existing.mail = {
                    ...baseMail,
                    conversationMailIds: Array.from(conversationIds),
                }
            } else {
                existing.mail.conversationMailIds = Array.from(conversationIds)
            }
            existing.hasUnread = existing.hasUnread || mail.isRead === false
            existing.hasStarred = existing.hasStarred || Boolean(mail.starred)
            existing.hasFlagged = existing.hasFlagged || Boolean(mail.flagged)
            candidates.forEach((key) => {
                if (key) {
                    keyIndex.set(key, canonicalKey)
                }
            })
        })

        return Array.from(conversationMap.values()).map(
            ({ mail, hasUnread, hasStarred, hasFlagged }) => ({
                ...mail,
                isRead: hasUnread ? false : true,
                starred: hasStarred,
                flagged: hasFlagged,
            }),
        )
    }, [mails])

    const sortedMails = useMemo(() => {
        const clone = [...aggregatedMails]
        clone.sort((a, b) => getMailTimestamp(b) - getMailTimestamp(a))
        return clone
    }, [aggregatedMails])

    const onMailClick = (e: MouseEvent<HTMLDivElement>, mail: AggregatedMail) => {
        e.stopPropagation()
        const unreadIds = mail.conversationMailIds.filter((sourceId) => {
            const entry = mails.find((item) => item.id === sourceId)
            return entry?.isRead === false
        })
        unreadIds.forEach((sourceId) => {
            const entry = mails.find((item) => item.id === sourceId)
            dispatch(
                patchMail({
                    id: sourceId,
                    changes: { isRead: true },
                }),
            )
            if (entry) {
                upsertMailLocalState(
                    {
                        id: entry.id,
                        remoteId: (entry as { remoteId?: string | number })
                            ?.remoteId,
                    },
                    { isRead: true },
                )
            }
        })
        dispatch(updateMailId(mail.id))
        dispatch(updateReply(false))
        navigate(`${location.pathname}?mail=${mail.id}`, { replace: true })
    }

    return (
        <div
            className={classNames(
                'min-w-[360px] ease-in-out duration-300 relative flex flex-1 flex-col min-h-0 h-full ltr:border-r rtl:border-l border-gray-200 dark:border-gray-600',
                sideBarExpand && 'xl:ltr:ml-[280px] xl:rtl:mr-[280px]',
                mailId ? 'hidden xl:flex' : 'xs:flex',
            )}
        >
            <div className="relative flex flex-none items-center justify-between min-h-[55px] border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-1">
                    <ToggleButton
                        sideBarExpand={sideBarExpand}
                        mobileSidebarExpand={mobileSidebarExpand}
                    />
                    <h6>{selectedCategory.label}</h6>
                </div>
            </div>
            <div className="relative flex-1 min-h-0">
                <ScrollBar autoHide direction={direction}>
                    <Loading
                        type={mails.length > 0 ? 'cover' : 'default'}
                        spinnerClass={mails.length > 0 ? 'hidden' : ''}
                        loading={loading}
                    >
                        {selectedMessagesStatus === 'failed' && (
                            <div className="px-6 py-4 text-sm text-red-500">
                                {resolvedMessagesError}
                            </div>
                        )}
                        {sortedMails.map((mail) => {
                            const latestMessage = mail.message?.[0]
                            const attachments =
                                mail.message?.flatMap((message) => message.attachment ?? []) ?? []
                            const previewText =
                                mail.previewText ||
                                mail.snippet ||
                                (latestMessage ? parseHtml(latestMessage.content) : '')
                            const isUnread = mail.isRead === false
                            const isSelected = mailId === mail.id
                            const displayName =
                                (mail.name && mail.name.trim()) ||
                                mail.from ||
                                mail.mail?.[0] ||
                                t('crm.mail.unknownSender', {
                                    defaultValue: 'Unknown sender',
                                })
                            const avatarSrc = resolveAvatarSrc(mail.avatar)
                            const avatarClassName = avatarSrc
                                ? undefined
                                : colorByName(displayName)
                            const avatarInitials = avatarSrc ? null : acronym(displayName)
                            const subject =
                                mail.title ||
                                mail.subject ||
                                t('crm.mail.noSubject', {
                                    defaultValue: 'No subject',
                                })
                            const previewContent =
                                previewText ||
                                t('crm.mail.noPreview', {
                                    defaultValue: 'No preview available',
                                })
                            const nameClass = classNames(
                                'truncate',
                                isUnread
                                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                                    : 'text-gray-700 dark:text-gray-200',
                            )
                            const titleClass = classNames(
                                'truncate text-sm',
                                isUnread
                                    ? 'text-gray-900 dark:text-gray-100 font-medium'
                                    : 'text-gray-600 dark:text-gray-300',
                            )
                            const previewClass = classNames(
                                'mt-1 truncate text-xs',
                                isUnread
                                    ? 'text-gray-700 dark:text-gray-200'
                                    : 'text-gray-500 dark:text-gray-400',
                            )
                            return (
                                <div
                                    key={mail.id}
                                    className={classNames(
                                        'relative flex border-b border-gray-200 dark:border-gray-600 last:border-0 hover:bg-hover',
                                        isSelected && 'bg-gray-50 dark:bg-gray-700',
                                    )}
                                    onClick={(e) => onMailClick(e, mail)}
                                >
                                    <div
                                        className={classNames(
                                            'w-full py-5 pr-4 pl-5 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700 flex transition-colors duration-150',
                                            isSelected && 'bg-gray-50 dark:bg-gray-700',
                                            isUnread && !isSelected
                                                ? 'bg-amber-50/60 dark:bg-gray-700/50'
                                                : '',
                                        )}
                                    >
                                        <div className="ltr:mr-2 rtl:ml-2">
                                            <Avatar
                                                shape="circle"
                                                size={25}
                                                src={avatarSrc}
                                                className={avatarClassName}
                                            >
                                                {avatarInitials}
                                            </Avatar>
                                        </div>
                                        <div className="w-full">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <span className={nameClass}>
                                                        {displayName}
                                                    </span>
                                                    {mail.flagged && (
                                                        <span className="ltr:ml-2 rtl:mr-2">
                                                            <HiOutlineFlag className="text-red-500" />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center text-lg">
                                                    {attachments.length > 0 && (
                                                        <HiPaperClip />
                                                    )}
                                                    {mail.starred && (
                                                        <HiStar className="text-amber-500 ltr:ml-1 rtl:mr-1" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex w-full flex-auto justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <p className={titleClass}>
                                                        {subject}
                                                    </p>
                                                    <p className={previewClass}>
                                                        {previewContent}
                                                    </p>
                                                    {attachments.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {attachments.slice(0, 3).map((attachment, index) => (
                                                                <div
                                                                    key={`${mail.id}-${attachment.file}-${index}`}
                                                                    className="flex items-center gap-1 rounded border border-gray-200 dark:border-gray-600 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300"
                                                                >
                                                                    <span className="text-base">
                                                                        {getAttachmentIcon(
                                                                            attachment.type,
                                                                        )}
                                                                    </span>
                                                                    <span className="max-w-[120px] truncate">
                                                                        {attachment.file}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {attachments.length > 3 && (
                                                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                    {t(
                                                                        'crm.mail.moreAttachments',
                                                                        {
                                                                            count:
                                                                                attachments.length -
                                                                                3,
                                                                            defaultValue:
                                                                                '+{{count}} more',
                                                                        },
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ltr:ml-2 rtl:mr-2">
                                                    <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                        {formatMailDate(mail)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </Loading>
                </ScrollBar>
            </div>
        </div>
    )

}

export default MailList
