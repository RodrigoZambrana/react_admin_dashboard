import Button from '@/components/ui/Button'
import Dropdown from '@/components/ui/Dropdown'
import InputGroup from '@/components/ui/InputGroup'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import classNames from 'classnames'
import {
    HiReply,
    HiOutlineFolderDownload,
    HiStar,
    HiOutlineStar,
    HiFlag,
    HiOutlineFlag,
    HiOutlineTrash,
    HiOutlinePaperAirplane,
    HiOutlineArrowSmLeft,
    HiOutlineTag,
    HiOutlineMail,
    HiOutlineMailOpen,
} from 'react-icons/hi'
import {
    patchMail,
    updateMail,
    updateMailId,
    updateMailList,
    updateReply,
    useAppDispatch,
    useAppSelector,
    updateInboxMessageFlags,
    moveInboxMessage,
    type Mail,
} from '../store'
import { groupList, labelList } from '../constants'
import {
    resolveLabelBadge,
    translateMailboxLabel as translateMailboxLabelHelper,
} from '../utils/labels'
import {
    upsertMailLocalState,
    type LocalMailState,
} from '../utils/localMailState'
import useResponsive from '@/utils/hooks/useResponsive'
import { useTranslation } from 'react-i18next'

type MailDetailActionBarProps = {
    mail?: Partial<Mail>
    isReply?: boolean
    onMailSend?: () => void
    onMailReply?: () => void
}

const BackButton = () => {
    const dispatch = useAppDispatch()

    const { smaller } = useResponsive()

    const onResetSelectedMail = () => {
        dispatch(updateMail({}))
        dispatch(updateMailId(''))
    }

    return smaller.xl ? (
        <Button
            icon={<HiOutlineArrowSmLeft />}
            variant="plain"
            shape="circle"
            size="sm"
            onClick={onResetSelectedMail}
        />
    ) : (
        <></>
    )
}

const MailDetailActionBar = (props: MailDetailActionBarProps) => {
    const { mail, isReply, onMailSend, onMailReply } = props

    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const mails = useAppSelector((state) => state.crmMail.data.mailList)
    const selectedCategory = useAppSelector(
        (state) => state.crmMail.data.selectedCategory,
    )
    const inboxState = useAppSelector((state) => state.crmMail.data.inbox)
    const selectedAccountId = inboxState.selectedAccountId
    const selectedMailboxId = inboxState.selectedMailboxId

    const mailId = mail?.id
    const remoteId =
        mail?.remoteId !== undefined && mail?.remoteId !== null
            ? String(mail.remoteId)
            : undefined
    const threadRemoteId =
        mail?.threadRemoteId !== undefined && mail?.threadRemoteId !== null
            ? String(mail.threadRemoteId)
            : undefined
    const starred = mail?.starred ?? false
    const flagged = mail?.flagged ?? false
    const isRead = mail?.isRead ?? false
    const currentMetadata =
        (mail?.metadata as Record<string, unknown> | null) ?? null
    const effectiveMailbox =
        (typeof mail?.folder === 'string' && mail.folder.length > 0
            ? mail.folder
            : undefined) ??
        selectedMailboxId ??
        'INBOX'

    const persistLocalState = (patch: LocalMailState) => {
        if (mailId === undefined || mailId === null) {
            return
        }
        upsertMailLocalState(
            {
                id: mailId,
                remoteId,
            },
            patch,
        )
    }

    const buildMetadataPatch = (patch: Record<string, unknown>) => {
        const cleaned: Record<string, unknown> = {}
        Object.entries(patch).forEach(([key, value]) => {
            cleaned[key] = value
        })
        cleaned.updatedAt = new Date().toISOString()
        return cleaned
    }

    const mergeLocalMetadata = (patch: Record<string, unknown>) => {
        const base = currentMetadata ? { ...currentMetadata } : {}
        Object.entries(patch).forEach(([key, value]) => {
            if (value === undefined) {
                return
            }
            base[key] = value
        })
        return Object.keys(base).length > 0 ? base : null
    }

    const showErrorNotification = (message: string) => {
        toast.push(
            <Notification
                type="danger"
                title={t('crm.mail.updateFailedTitle', {
                    defaultValue: 'Message update failed',
                })}
            >
                {message}
            </Notification>,
            { placement: 'top-center' },
        )
    }

    const persistFlags = async (
        updates: {
            seen?: boolean
            starred?: boolean
            spam?: boolean
        },
        metadataPatch?: Record<string, unknown>,
    ) => {
        if (!selectedAccountId || !remoteId || !effectiveMailbox) {
            return false
        }
        const body: {
            threadRemoteId?: string
            seen?: boolean
            starred?: boolean
            spam?: boolean
            metadata?: Record<string, unknown>
        } = {
            threadRemoteId,
        }
        if (updates.seen !== undefined) {
            body.seen = updates.seen
        }
        if (updates.starred !== undefined) {
            body.starred = updates.starred
        }
        if (updates.spam !== undefined) {
            body.spam = updates.spam
        }
        if (metadataPatch && Object.keys(metadataPatch).length > 0) {
            body.metadata = metadataPatch
        }
        try {
            await dispatch(
                updateInboxMessageFlags({
                    accountId: selectedAccountId,
                    remoteId,
                    mailbox: effectiveMailbox,
                    body,
                }),
            ).unwrap()
            return true
        } catch (error) {
            const message =
                (error as Error)?.message ||
                t('crm.mail.updateFailed', {
                    defaultValue: 'Unable to update the message. Please try again.',
                })
            showErrorNotification(message)
            return false
        }
    }

    const handleRemoteMove = async (target: string) => {
        if (!selectedAccountId || !remoteId || !effectiveMailbox) {
            return false
        }
        try {
            await dispatch(
                moveInboxMessage({
                    accountId: selectedAccountId,
                    remoteId,
                    currentMailbox: effectiveMailbox,
                    body: {
                        threadRemoteId,
                        targetMailbox: target,
                    },
                }),
            ).unwrap()
            return true
        } catch (error) {
            const message =
                (error as Error)?.message ||
                t('crm.mail.moveFailed', {
                    defaultValue: 'Unable to move the message. Please try again.',
                })
            showErrorNotification(message)
            return false
        }
    }

    const onReply = () => {
        dispatch(updateReply(true))
        onMailReply?.()
    }

    const onDiscard = () => {
        dispatch(updateReply(false))
    }

    const onSend = () => {
        onMailSend?.()
    }

    const onToggleRead = async () => {
        if (mailId === undefined || mailId === null) {
            return
        }
        const nextRead = !isRead
        let success = true
        if (remoteId && selectedAccountId) {
            success = await persistFlags({ seen: nextRead })
        }
        if (!success) {
            return
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: { isRead: nextRead },
            }),
        )
        persistLocalState({ isRead: nextRead })
    }

    const onStar = async () => {
        if (mailId === undefined || mailId === null) {
            return
        }
        const nextStarred = !starred
        let success = true
        if (remoteId && selectedAccountId) {
            success = await persistFlags({ starred: nextStarred })
        }
        if (!success) {
            return
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: { starred: nextStarred },
            }),
        )
        persistLocalState({ starred: nextStarred })
        if (
            selectedCategory.value === 'starred' &&
            selectedCategory.value !== undefined &&
            !nextStarred
        ) {
            const updatedList = mails.filter((mailItem) => mailItem.id !== mailId)
            dispatch(updateMailList(updatedList))
            dispatch(updateMail({}))
            dispatch(updateMailId(''))
        }
    }

    const onFlag = async () => {
        if (mailId === undefined || mailId === null) {
            return
        }
        const nextFlagged = !flagged
        let success = true
        if (remoteId && selectedAccountId) {
            success = await persistFlags(
                {},
                buildMetadataPatch({ flagged: nextFlagged }),
            )
        }
        if (!success) {
            return
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: {
                    flagged: nextFlagged,
                    metadata: mergeLocalMetadata({ flagged: nextFlagged }),
                },
            }),
        )
        persistLocalState({
            flagged: nextFlagged,
            metadataPatch: { flagged: nextFlagged },
        })
    }

    const onMoveTo = async (target: string) => {
        if (mailId === undefined || mailId === null) {
            return
        }
        let success = true
        if (remoteId && selectedAccountId) {
            success = await handleRemoteMove(target)
        }
        if (!success) {
            return
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: {
                    group: target,
                    folder: target,
                    metadata: mergeLocalMetadata({ folder: target }),
                },
            }),
        )
        const currentCategory = selectedCategory.value
        if (currentCategory && currentCategory !== target) {
            const updatedList = mails.filter((mailItem) => mailItem.id !== mailId)
            dispatch(updateMailList(updatedList))
            dispatch(updateMail({}))
            dispatch(updateMailId(''))
        }
    }

    const onApplyLabel = async (nextLabel?: string) => {
        if (mailId === undefined || mailId === null) {
            return
        }
        const normalizedLabel = nextLabel ?? ''
        let success = true
        if (remoteId && selectedAccountId) {
            success = await persistFlags(
                {},
                buildMetadataPatch({ label: normalizedLabel || null }),
            )
        }
        if (!success) {
            return
        }
        const metadataPatch: Record<string, string | null> = {
            label: normalizedLabel || null,
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: {
                    label: normalizedLabel,
                    metadata: mergeLocalMetadata(metadataPatch),
                },
            }),
        )
        persistLocalState({
            label: normalizedLabel || null,
            metadataPatch,
            tags: normalizedLabel ? [normalizedLabel] : [],
        })
        const isLabelCategory = Boolean(
            selectedCategory.value &&
                labelList.some(
                    (label) => label.value === selectedCategory.value,
                ),
        )
        if (
            isLabelCategory &&
            selectedCategory.value !== normalizedLabel
        ) {
            const updatedList = mails.filter((mailItem) => mailItem.id !== mailId)
            dispatch(updateMailList(updatedList))
            dispatch(updateMail({}))
            dispatch(updateMailId(''))
        }
    }

    return (
        <div
            className={classNames(
                'relative flex items-center min-h-[55px] px-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800',
            )}
        >
            {isReply ? (
                <div className="flex items-center xl:justify-end justify-between gap-2 w-full">
                    <BackButton />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            icon={<HiOutlineTrash />}
                            onClick={onDiscard}
                        >
                            {t('text.actions.discard')}
                        </Button>
                        <Button
                            variant="solid"
                            size="sm"
                            icon={<HiOutlinePaperAirplane />}
                            onClick={onSend}
                        >
                            {t('text.actions.send')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <BackButton />
                        <Button size="sm" icon={<HiReply />} onClick={onReply}>
                            <span className="hidden sm:block">
                                {t('crm.mail.actions.reply', {
                                    defaultValue: 'Reply',
                                })}
                            </span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <InputGroup size="sm">
                            <Button
                                size="sm"
                                icon={
                                    <span className="text-sky-500">
                                        {isRead ? (
                                            <HiOutlineMailOpen />
                                        ) : (
                                            <HiOutlineMail />
                                        )}
                                    </span>
                                }
                                onClick={onToggleRead}
                            >
                                <span className="hidden sm:block">
                                    {isRead
                                        ? t('crm.mail.actions.markUnread', {
                                              defaultValue: 'Mark unread',
                                          })
                                        : t('crm.mail.actions.markRead', {
                                              defaultValue: 'Mark read',
                                          })}
                                </span>
                            </Button>
                            <Button
                                size="sm"
                                icon={
                                    <span className="text-amber-500">
                                        {starred ? (
                                            <HiStar />
                                        ) : (
                                            <HiOutlineStar />
                                        )}
                                    </span>
                                }
                                onClick={onStar}
                            >
                                <span className="hidden sm:block">
                                    {starred
                                        ? t('crm.mail.actions.starred', {
                                              defaultValue: 'Starred',
                                          })
                                        : t('crm.mail.actions.star', {
                                              defaultValue: 'Star',
                                          })}
                                </span>
                            </Button>
                            <Button
                                size="sm"
                                icon={
                                    <span className="text-red-500">
                                        {flagged ? (
                                            <HiFlag />
                                        ) : (
                                            <HiOutlineFlag />
                                        )}
                                    </span>
                                }
                                onClick={onFlag}
                            >
                                <span className="hidden sm:block">
                                    {flagged
                                        ? t('crm.mail.actions.flagged', {
                                              defaultValue: 'Flagged',
                                          })
                                        : t('crm.mail.actions.flag', {
                                              defaultValue: 'Flag',
                                          })}
                                </span>
                            </Button>
                        </InputGroup>
                        <Dropdown
                            placement="bottom-end"
                            renderTitle={
                                <Button
                                    size="sm"
                                    icon={<HiOutlineFolderDownload />}
                                >
                                    <span className="hidden sm:block">
                                        {t('crm.mail.actions.moveTo', {
                                            defaultValue: 'Move to',
                                        })}
                                    </span>
                                </Button>
                            }
                        >
                            {groupList.map((group) => (
                                <Dropdown.Item
                                    key={group.value}
                                    eventKey={group.value}
                                    onSelect={() => onMoveTo(group.value)}
                                >
                                    <span className="text-xl ltr:mr-2 rtl:ml-2">
                                        {group.icon}
                                    </span>
                                    <span>
                                        {translateMailboxLabelHelper(
                                            t,
                                            group.value,
                                            group.label,
                                        )}
                                    </span>
                                </Dropdown.Item>
                            ))}
                        </Dropdown>
                        <Dropdown
                            placement="bottom-end"
                            renderTitle={
                                <Button size="sm" icon={<HiOutlineTag />}>
                                    <span className="hidden sm:block">
                                        {t('crm.mail.actions.label', {
                                            defaultValue: 'Label',
                                        })}
                                    </span>
                                </Button>
                            }
                        >
                            <Dropdown.Item
                                eventKey="__clear__"
                                onSelect={() => onApplyLabel('')}
                            >
                                <span className="ltr:mr-2 rtl:ml-2 h-2 w-2 inline-flex items-center justify-center rounded-full bg-transparent border border-current opacity-60" />
                                <span>
                                    {t('crm.mail.labels.clear', {
                                        defaultValue: 'Remove label',
                                    })}
                                </span>
                            </Dropdown.Item>
                            {labelList.map((label) => (
                                <Dropdown.Item
                                    key={label.value}
                                    eventKey={label.value}
                                    onSelect={() => onApplyLabel(label.value)}
                                >
                                    <span
                                        className={`inline-flex h-2 w-2 items-center justify-center rounded-full ltr:mr-2 rtl:ml-2 ${label.dotClass}`}
                                    />
                                    <span>
                                        {resolveLabelBadge(t, label)}
                                    </span>
                                </Dropdown.Item>
                            ))}
                        </Dropdown>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MailDetailActionBar
