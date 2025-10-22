import { useEffect, useMemo, useRef } from 'react'
import classNames from 'classnames'
import Loading from '@/components/shared/Loading'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import Card from '@/components/ui/Card'
import useQuery from '@/utils/hooks/useQuery'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    updateMailId,
    getMail,
    patchMail,
    updateMail,
    useAppDispatch,
    useAppSelector,
} from '../store'
import MailDetailActionBar from './MailDetailActionBar'
import MailDetailContent from './MailDetailContent'
import MailEditor, { MailEditorRef } from './MailEditor'
import isEmpty from 'lodash/isEmpty'
import {
    buildConversationKey,
    normalizeSubject,
    normalizeString,
} from '../utils/conversations'
import { upsertMailLocalState } from '../utils/localMailState'
import type { Mail as MailType } from '../store'

const MailDetail = () => {
    const query = useQuery()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    const dispatch = useAppDispatch()

    const id = query.get('mail')

    const scrollRef = useRef(null)

    const mailEditorRef = useRef<MailEditorRef>(null)
    const previousMailIdRef = useRef<string | number | null>(null)
    const skipQuerySyncRef = useRef(false)
    const readHistoryRef = useRef<Set<string>>(new Set())

    const mail = useAppSelector((state) => state.crmMail.data.mail)
    const mailLoading = useAppSelector(
        (state) => state.crmMail.data.mailLoading,
    )
    const mailId = useAppSelector((state) => state.crmMail.data.selectedMailId)
    const isReply = useAppSelector((state) => state.crmMail.data.reply)
    const mailList = useAppSelector((state) => state.crmMail.data.mailList)

    const fetchData = () => {
        if (id) {
            dispatch(getMail({ id }))
        }
    }

    const formSubmit = () => {
        mailEditorRef.current?.formikRef?.submitForm()
    }

    const onMailReply = () => {
        const timeout = setTimeout(
            () => mailEditorRef.current?.editorRef?.focus(),
            100,
        )
        return () => {
            clearTimeout(timeout)
        }
    }

    useEffect(() => {
        const previousMailId = previousMailIdRef.current
        const currentMailId =
            mailId !== undefined && mailId !== null && mailId !== ''
                ? mailId
                : null

        if (previousMailId && !currentMailId && id) {
            const params = new URLSearchParams(location.search)
            params.delete('mail')
            const nextSearch = params.toString()
            skipQuerySyncRef.current = true
            navigate(
                `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
                { replace: true },
            )
        }

        previousMailIdRef.current = currentMailId
    }, [mailId, id, location.pathname, location.search, navigate])

    useEffect(() => {
        if (!id) {
            if (skipQuerySyncRef.current) {
                skipQuerySyncRef.current = false
            }
            return
        }

        if (skipQuerySyncRef.current) {
            skipQuerySyncRef.current = false
            return
        }

        const mailIdString =
            mailId !== undefined && mailId !== null ? String(mailId) : ''

        if (mailIdString !== id) {
            dispatch(updateMailId(id))
        }
    }, [dispatch, id, mailId])

    useEffect(() => {
        if (!id && mailId) {
            dispatch(updateMail({}))
            dispatch(updateMailId(''))
        }
    }, [dispatch, id, mailId])

    useEffect(() => {
        if (mailId) {
            fetchData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mailId])

    useEffect(() => {
        if (!mailId) {
            return
        }
        const normalizedId = String(mailId)
        if (readHistoryRef.current.has(normalizedId)) {
            return
        }
        dispatch(
            patchMail({
                id: mailId,
                changes: { isRead: true },
            }),
        )
        readHistoryRef.current.add(normalizedId)
    }, [dispatch, mailId])

    useEffect(() => {
        if (!mail?.id || mail.isRead !== true) {
            return
        }
        upsertMailLocalState(
            {
                id: mail.id,
                remoteId: (mail as { remoteId?: string | number })?.remoteId,
            },
            { isRead: true },
        )
    }, [mail?.id, mail?.remoteId, mail?.isRead])

    const resolvedMail = useMemo<Partial<MailType>>(() => {
        if (!mail || isEmpty(mail)) {
            return mail
        }
        if (!Array.isArray(mailList) || mailList.length === 0) {
            return mail
        }
        const conversationKey = buildConversationKey(mail)
        const normalizedThreadId = normalizeString(
            (mail as { threadRemoteId?: string | null })?.threadRemoteId,
        )
        const normalizedSubject = normalizeSubject(mail.subject || mail.title)
        const hasConversationKey = Boolean(conversationKey)
        const hasThreadKey = Boolean(normalizedThreadId)
        const shouldUseSubjectFallback =
            !hasThreadKey && !hasConversationKey && Boolean(normalizedSubject)
        const related = mailList.filter((entry) => {
            if (!entry) {
                return false
            }
            if (entry.id === mail.id) {
                return true
            }
            if (hasThreadKey) {
                const entryThreadId = normalizeString(
                    (entry as { threadRemoteId?: string | null })?.threadRemoteId,
                )
                if (entryThreadId && entryThreadId === normalizedThreadId) {
                    return true
                }
            }
            if (hasConversationKey) {
                const entryKey = buildConversationKey(entry)
                if (entryKey && entryKey === conversationKey) {
                    return true
                }
            }
            if (shouldUseSubjectFallback) {
                const entrySubject = normalizeSubject(entry.subject || entry.title)
                if (entrySubject && entrySubject === normalizedSubject) {
                    return true
                }
            }
            return false
        })
        if (related.length <= 1) {
            return mail
        }
        const mergedMessages: MailType['message'] = []
        const seen = new Set<string>()
        const appendMessages = (messages?: MailType['message']) => {
            if (!Array.isArray(messages)) {
                return
            }
            messages.forEach((message, index) => {
                if (!message) {
                    return
                }
                const key =
                    message.id !== undefined && message.id !== null
                        ? `id:${message.id}`
                        : `idx:${index}:${message.date ?? ''}:${message.from ?? ''}`
                if (seen.has(key)) {
                    return
                }
                seen.add(key)
                mergedMessages.push(message)
            })
        }
        appendMessages(mail.message)
        related.forEach((entry) => {
            if (entry.id === mail.id) {
                appendMessages(entry.message)
                return
            }
            appendMessages(entry.message)
        })
        if (mergedMessages.length === (mail.message?.length ?? 0)) {
            return mail
        }
        return {
            ...mail,
            message: mergedMessages,
        }
    }, [mail, mailList])

    const hasMail = !isEmpty(resolvedMail)

    return (
        <div
            className={classNames(
                id && hasMail && !mailLoading
                    ? 'block xl:flex'
                    : 'hidden xl:flex',
                'flex-col w-full bg-gray-100 dark:bg-gray-900',
            )}
        >
            {id && hasMail ? (
                mailLoading ? (
                    <Loading loading={true} />
                ) : (
                    <>
                        <MailDetailActionBar
                            mail={resolvedMail}
                            isReply={isReply}
                            onMailSend={formSubmit}
                            onMailReply={onMailReply}
                        />
                        <MailDetailContent ref={scrollRef} mail={resolvedMail}>
                            {isReply && (
                                <div className="pb-6">
                                    <Card>
                                        <MailEditor
                                            ref={mailEditorRef}
                                            mode="reply"
                                            mail={resolvedMail}
                                        />
                                    </Card>
                                </div>
                            )}
                        </MailDetailContent>
                    </>
                )
            ) : (
                <div className="flex flex-col justify-center items-center h-full">
                    <DoubleSidedImage
                        className="max-w-[200px]"
                        src="/img/others/no-mail-selected.png"
                        darkModeSrc="/img/others/no-mail-selected-dark.png"
                    />
                    <div className="mt-4 text-2xl font-semibold">
                        {t('crm.mail.selectMailPrompt', {
                            defaultValue: 'Select a mail to read',
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default MailDetail
