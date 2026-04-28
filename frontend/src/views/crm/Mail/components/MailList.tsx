import { useEffect, useMemo, useRef, useState } from 'react'
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
    fetchInboxMailboxes,
    fetchInboxThreads,
    setSelectedInboxContext,
    setSelectedInboxMailbox,
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
import {
    hasRealMailboxSelection,
    isInboxCategorySelection,
} from '../utils/category'
import { upsertMailLocalState } from '../utils/localMailState'
import { apiSyncInboxAccount } from '@/services/InboxService'

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
        mail.activityAt,
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
    const inboxAccounts = inboxState.accounts
    const inboxAccountsError = inboxState.accountsError
    const selectedInboxAccountId = inboxState.selectedAccountId
    const selectedInboxAccount = useMemo(
        () =>
            selectedInboxAccountId
                ? inboxAccounts.find(
                      (account) => account.id === selectedInboxAccountId,
                  ) ?? null
                : null,
        [inboxAccounts, selectedInboxAccountId],
    )
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
    const selectedNextCursor = inboxMessagesKey
        ? inboxState.nextCursorByMailbox[inboxMessagesKey]
        : null
    const selectedMailbox = selectedInboxAccountId
        ? (
              inboxState.mailboxesByAccount[selectedInboxAccountId] ?? []
          ).find((entry) => entry.id === selectedInboxMailboxId)
        : undefined
    const remoteMailboxCount =
        selectedMailbox?.metadata &&
        typeof selectedMailbox.metadata === 'object' &&
        selectedMailbox.metadata !== null &&
        'status' in selectedMailbox.metadata &&
        typeof (selectedMailbox.metadata as { status?: { messages?: unknown } })
            .status?.messages === 'number'
            ? ((selectedMailbox.metadata as { status?: { messages?: number } })
                  .status?.messages ?? null)
            : null
    const mailboxSyncMeta =
        selectedMailbox?.metadata &&
        typeof selectedMailbox.metadata === 'object' &&
        selectedMailbox.metadata !== null &&
        'sync' in selectedMailbox.metadata
            ? ((selectedMailbox.metadata as {
                  sync?: {
                      complete?: boolean | null
                      localMessageCount?: number | null
                  }
              }).sync ?? null)
            : null
    const localMailboxCount =
        typeof mailboxSyncMeta?.localMessageCount === 'number'
            ? mailboxSyncMeta.localMessageCount
            : null
    const [historySyncLoading, setHistorySyncLoading] = useState(false)
    const [manualSyncLoading, setManualSyncLoading] = useState(false)
    const [historySyncError, setHistorySyncError] = useState<string | null>(null)

    const pollTimerRef = useRef<number | null>(null)
    const messagesStatusRef = useRef(inboxState.messagesRequestStatus)

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
    const syncStatusLabel = useMemo(() => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId) {
            return null
        }
        if (manualSyncLoading) {
            return t('crm.mail.syncingMailbox', {
                defaultValue: 'Synchronizing mailbox...',
            })
        }
        if (historySyncLoading) {
            return t('crm.mail.syncingMailboxHistory', {
                defaultValue: 'Synchronizing full history...',
            })
        }
        if (selectedMessagesStatus === 'loading' && mails.length === 0) {
            return t('crm.mail.syncingMailbox', {
                defaultValue: 'Synchronizing mailbox...',
            })
        }
        if (mailboxSyncMeta?.complete === true) {
            return t('crm.mail.mailboxSyncComplete', {
                defaultValue: 'Complete sync',
            })
        }
        if (selectedNextCursor) {
            return t('crm.mail.mailboxSyncPartial', {
                defaultValue: 'Partial sync',
            })
        }
        if (
            typeof remoteMailboxCount === 'number' &&
            remoteMailboxCount > 0 &&
            typeof localMailboxCount === 'number' &&
            localMailboxCount < remoteMailboxCount
        ) {
            return t('crm.mail.mailboxSyncPartial', {
                defaultValue: 'Partial sync',
            })
        }
        if (mails.length > 0) {
            return t('crm.mail.mailboxSyncComplete', {
                defaultValue: 'Complete sync',
            })
        }
        return null
    }, [
        localMailboxCount,
        mailboxSyncMeta?.complete,
        mails.length,
        remoteMailboxCount,
        selectedInboxAccountId,
        selectedInboxMailboxId,
        selectedMessagesStatus,
        selectedNextCursor,
        t,
        historySyncLoading,
        manualSyncLoading,
    ])
    const syncStatusDetail = useMemo(() => {
        const historyParts: string[] = []
        if (
            typeof remoteMailboxCount === 'number' &&
            remoteMailboxCount > 0
        ) {
            historyParts.push(
                t('crm.mail.syncedMessagesCount', {
                    defaultValue: 'Mensajes sincronizados {{local}}/{{remote}}',
                    local: localMailboxCount ?? mails.length,
                    remote: remoteMailboxCount,
                }),
            )
        } else if ((localMailboxCount ?? mails.length) > 0) {
            historyParts.push(
                t('crm.mail.syncedMessagesSingleCount', {
                    defaultValue: 'Mensajes sincronizados {{count}}',
                    count: localMailboxCount ?? mails.length,
                }),
            )
        }
        if (
            mailboxSyncMeta &&
            typeof mailboxSyncMeta.lastHistorySyncAt === 'string' &&
            mailboxSyncMeta.lastHistorySyncAt
        ) {
            historyParts.push(
                t('crm.mail.lastHistorySyncAt', {
                    defaultValue: `Hist. ${new Date(
                        mailboxSyncMeta.lastHistorySyncAt,
                    ).toLocaleString('es-UY')}`,
                }),
            )
        }
        return historyParts.length ? historyParts.join(' · ') : null
    }, [
        localMailboxCount,
        mailboxSyncMeta,
        mails.length,
        remoteMailboxCount,
        t,
    ])

    const canCompleteHistory = useMemo(() => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId) {
            return false
        }
        if (historySyncLoading) {
            return false
        }
        if (selectedNextCursor) {
            return true
        }
        if (
            typeof remoteMailboxCount === 'number' &&
            remoteMailboxCount > 0 &&
            typeof localMailboxCount === 'number'
        ) {
            return localMailboxCount < remoteMailboxCount
        }
        return mailboxSyncMeta?.complete !== true
    }, [
        historySyncLoading,
        localMailboxCount,
        mailboxSyncMeta?.complete,
        remoteMailboxCount,
        selectedInboxAccountId,
        selectedInboxMailboxId,
        selectedNextCursor,
    ])

    const navigate = useNavigate()
    const location = useLocation()
    const queryAccountId = useMemo(() => {
        const params = new URLSearchParams(location.search)
        return params.get('account')?.trim() ?? ''
    }, [location.search])
    const queryMailboxId = useMemo(() => {
        const params = new URLSearchParams(location.search)
        return params.get('mailbox')?.trim() ?? ''
    }, [location.search])
    const hasRealMailboxContext = hasRealMailboxSelection({
        accountId: selectedInboxAccountId || queryAccountId,
        mailboxId: selectedInboxMailboxId || queryMailboxId,
    })
    const isInboxCategory =
        isInboxCategorySelection(selectedCategory) || hasRealMailboxContext

    useEffect(() => {
        if (!queryAccountId) {
            return
        }
        if (
            inboxAccounts.length > 0 &&
            !inboxAccounts.some((account) => account.id === queryAccountId)
        ) {
            return
        }
        if (selectedInboxAccountId !== queryAccountId) {
            dispatch(
                setSelectedInboxContext({
                    accountId: queryAccountId,
                    mailboxId: queryMailboxId || undefined,
                }),
            )
            return
        }
        if (queryMailboxId && selectedInboxMailboxId !== queryMailboxId) {
            dispatch(setSelectedInboxMailbox(queryMailboxId))
        }
    }, [
        dispatch,
        inboxAccounts,
        queryAccountId,
        queryMailboxId,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    useEffect(() => {
        if (
            !queryMailboxId ||
            !queryAccountId ||
            selectedInboxAccountId !== queryAccountId ||
            selectedInboxMailboxId === queryMailboxId
        ) {
            return
        }
        dispatch(setSelectedInboxMailbox(queryMailboxId))
    }, [
        dispatch,
        queryAccountId,
        queryMailboxId,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    const fetchData = (data: { category: string }) => {
        dispatch(getMails(data))
    }

    useEffect(() => {
        messagesStatusRef.current = inboxState.messagesRequestStatus
    }, [inboxState.messagesRequestStatus])

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        if (path === 'inbox' || path === 'mail' || hasRealMailboxContext) {
            return
        }

        const category = { category: path }
        fetchData(category)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasRealMailboxContext, location.pathname])

    useEffect(() => {
        if (
            !selectedInboxAccountId ||
            !selectedInboxAccount ||
            !selectedInboxMailboxId
        ) {
            return
        }
        dispatch(
            fetchInboxThreads({
                accountId: selectedInboxAccountId,
                mailbox: selectedInboxMailboxId,
            }),
        )
    }, [
        dispatch,
        selectedInboxAccount,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    useEffect(() => {
        if (
            !selectedInboxAccountId ||
            !selectedInboxAccount ||
            !selectedInboxMailboxId
        ) {
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
                dispatch(
                    fetchInboxThreads({
                        accountId: selectedInboxAccountId,
                        mailbox: selectedInboxMailboxId,
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
    }, [
        dispatch,
        selectedInboxAccount,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    const parseHtml = (content: string) => {
        if (!content) {
            return ''
        }
        const text = content.replace(htmlReg, '')
        return text.length > 60 ? text.substring(0, 57) + '...' : text
    }

    const handleLoadMore = () => {
        if (
            !selectedInboxAccountId ||
            !selectedInboxMailboxId ||
            !selectedNextCursor ||
            selectedMessagesStatus === 'loading'
        ) {
            return
        }
        dispatch(
            fetchInboxThreads({
                accountId: selectedInboxAccountId,
                mailbox: selectedInboxMailboxId,
                cursor: selectedNextCursor,
            }),
        )
    }

    const handleCompleteHistory = async () => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId || historySyncLoading) {
            return
        }
        setHistorySyncLoading(true)
        setHistorySyncError(null)
        try {
            await apiSyncInboxAccount({
                accountId: selectedInboxAccountId,
                body: {
                    mailboxes: [selectedInboxMailboxId],
                    fullHistory: true,
                    maxPages: 50,
                },
            })
            await dispatch(
                fetchInboxMailboxes({ accountId: selectedInboxAccountId }),
            ).unwrap()
            await dispatch(
                fetchInboxThreads({
                    accountId: selectedInboxAccountId,
                    mailbox: selectedInboxMailboxId,
                }),
            ).unwrap()
        } catch (syncError) {
            console.error(syncError)
            setHistorySyncError(
                t('crm.mail.historySyncFailed', {
                    defaultValue:
                        'Unable to complete mailbox history sync right now.',
                }),
            )
        } finally {
            setHistorySyncLoading(false)
        }
    }

    const handleSyncNow = async () => {
        if (
            !selectedInboxAccountId ||
            !selectedInboxMailboxId ||
            manualSyncLoading ||
            historySyncLoading
        ) {
            return
        }
        setManualSyncLoading(true)
        setHistorySyncError(null)
        try {
            await apiSyncInboxAccount({
                accountId: selectedInboxAccountId,
                body: {
                    mailboxes: [selectedInboxMailboxId],
                    limit: 100,
                },
            })
            await dispatch(
                fetchInboxMailboxes({ accountId: selectedInboxAccountId }),
            ).unwrap()
            await dispatch(
                fetchInboxThreads({
                    accountId: selectedInboxAccountId,
                    mailbox: selectedInboxMailboxId,
                }),
            ).unwrap()
        } catch (syncError) {
            console.error(syncError)
            setHistorySyncError(
                t('crm.mail.mailboxSyncFailed', {
                    defaultValue:
                        'Unable to synchronize the mailbox right now.',
                }),
            )
        } finally {
            setManualSyncLoading(false)
        }
    }

    const aggregatedMails = useMemo<AggregatedMail[]>(() => {
        if (isInboxCategory) {
            return mails.map((mail) => ({
                ...mail,
                conversationMailIds: [mail.id],
            }))
        }

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
    }, [isInboxCategory, mails])

    const sortedMails = useMemo(() => {
        const clone = [...aggregatedMails]
        clone.sort((a, b) => getMailTimestamp(b) - getMailTimestamp(a))
        return clone
    }, [aggregatedMails])

    const visibleThreadsLabel = useMemo(() => {
        if (!selectedInboxAccountId || !selectedInboxMailboxId) {
            return null
        }
        return t('crm.mail.visibleThreadsCount', {
            defaultValue: 'Hilos visibles {{count}}',
            count: sortedMails.length,
        })
    }, [selectedInboxAccountId, selectedInboxMailboxId, sortedMails.length, t])

    const onMailClick = (e: MouseEvent<HTMLDivElement>, mail: AggregatedMail) => {
        e.stopPropagation()
        const conversationId =
            (mail as { conversationId?: string | null }).conversationId ??
            ((mail.metadata as Record<string, unknown> | null)?.conversationId as
                | string
                | null
                | undefined) ??
            null

        if (conversationId) {
            navigate(`/app/crm/conversations/${conversationId}`)
            return
        }

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
        const params = new URLSearchParams(location.search)
        params.set('mail', String(mail.id))
        navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    }

    return (
        <div
            data-testid="admin-inbox-list"
            className={classNames(
                'min-w-[360px] ease-in-out duration-300 relative flex flex-1 flex-col min-h-0 h-full ltr:border-r rtl:border-l border-gray-200 dark:border-gray-600',
                sideBarExpand && 'xl:ltr:ml-[280px] xl:rtl:mr-[280px]',
                mailId ? 'hidden xl:flex' : 'xs:flex',
            )}
        >
            <div
                className="relative flex flex-none items-center justify-between min-h-[55px] border-gray-200 dark:border-gray-600"
                data-testid="admin-inbox-list-header"
            >
                <div className="flex items-center gap-1">
                    <ToggleButton
                        sideBarExpand={sideBarExpand}
                        mobileSidebarExpand={mobileSidebarExpand}
                    />
                    <h6>{selectedCategory.label}</h6>
                </div>
                <div className="flex items-center gap-2 px-3">
                    {syncStatusLabel ? (
                        <div
                            className="text-right"
                            data-testid="admin-inbox-sync-status"
                        >
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                {syncStatusLabel}
                            </div>
                            {syncStatusDetail ? (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {syncStatusDetail}
                                </div>
                            ) : null}
                            {visibleThreadsLabel ? (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {visibleThreadsLabel}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {selectedInboxAccountId && selectedInboxMailboxId ? (
                        <Button
                            size="sm"
                            variant="default"
                            loading={manualSyncLoading}
                            disabled={manualSyncLoading || historySyncLoading}
                            onClick={() => void handleSyncNow()}
                            data-testid="admin-inbox-sync-now"
                        >
                            {t('crm.mail.syncNow', {
                                defaultValue: 'Sync now',
                            })}
                        </Button>
                    ) : null}
                    {canCompleteHistory ? (
                        <Button
                            size="sm"
                            variant="twoTone"
                            loading={historySyncLoading}
                            disabled={historySyncLoading || manualSyncLoading}
                            onClick={() => void handleCompleteHistory()}
                            data-testid="admin-inbox-complete-history"
                        >
                            {t('crm.mail.completeHistorySync', {
                                defaultValue: 'Complete history',
                            })}
                        </Button>
                    ) : null}
                </div>
            </div>
            <div className="relative flex-1 min-h-0" data-testid="admin-inbox-list-content">
                <ScrollBar autoHide direction={direction}>
                    <Loading
                        type={mails.length > 0 ? 'cover' : 'default'}
                        spinnerClass={mails.length > 0 ? 'hidden' : ''}
                        loading={loading}
                    >
                        {inboxAccountsError ? (
                            <div className="px-6 py-4 text-sm text-red-500" data-testid="admin-inbox-messages-error">
                                {inboxAccountsError}
                            </div>
                        ) : null}
                        {selectedMessagesStatus === 'failed' && (
                            <div className="px-6 py-4 text-sm text-red-500" data-testid="admin-inbox-messages-error">
                                {resolvedMessagesError}
                            </div>
                        )}
                        {historySyncError ? (
                            <div className="px-6 py-4 text-sm text-red-500" data-testid="admin-inbox-history-sync-error">
                                {historySyncError}
                            </div>
                        ) : null}
                        {!selectedInboxAccountId || !selectedInboxMailboxId ? (
                            <div
                                className="px-6 py-4 text-sm text-gray-500"
                                data-testid="admin-inbox-select-account"
                            >
                                {t('crm.mail.loadingMailboxContext', {
                                    defaultValue: 'Resolviendo cuenta y buzón...',
                                })}
                            </div>
                        ) : null}
                        {sortedMails.length === 0 &&
                        !loading &&
                        selectedMessagesStatus !== 'failed' &&
                        selectedInboxAccountId &&
                        selectedInboxMailboxId ? (
                            <div className="px-6 py-4 text-sm text-gray-500" data-testid="admin-inbox-empty">
                                {t('crm.mail.noMails', { defaultValue: 'No messages yet.' })}
                            </div>
                        ) : null}
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
                            const messageCount =
                                typeof mail.metadata?.messageCount === 'number'
                                    ? mail.metadata.messageCount
                                    : Array.isArray(mail.message)
                                      ? mail.message.length
                                      : 1
                            return (
                                <div
                                    key={mail.id}
                                    data-testid={`admin-inbox-mail-${String(mail.id)}`}
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
                                                    {messageCount > 1 && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                            {messageCount}
                                                        </span>
                                                    )}
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
                        {selectedNextCursor ? (
                            <div className="px-5 py-4" data-testid="admin-inbox-load-more-wrap">
                                <Button
                                    block
                                    variant="solid"
                                    size="sm"
                                    loading={selectedMessagesStatus === 'loading'}
                                    disabled={selectedMessagesStatus === 'loading'}
                                    onClick={handleLoadMore}
                                    data-testid="admin-inbox-load-more"
                                >
                                    {t('crm.mail.loadOlderMessages', {
                                        defaultValue: 'Load older messages',
                                    })}
                                </Button>
                            </div>
                        ) : null}
                    </Loading>
                </ScrollBar>
            </div>
        </div>
    )

}

export default MailList
