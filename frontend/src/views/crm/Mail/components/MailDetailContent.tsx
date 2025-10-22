import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import IconText from '@/components/shared/IconText'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import ScrollBar from '@/components/ui/ScrollBar'
import Tag from '@/components/ui/Tag'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import Tooltip from '@/components/ui/Tooltip'
import useTwColorByName from '@/utils/hooks/useTwColorByName'
import { resolveAvatarSrc } from '@/utils/avatar'
import acronym from '@/utils/acronym'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import ReactHtmlParser from 'html-react-parser'
import {
    HiOutlineClock,
    HiOutlineDownload,
    HiOutlineExternalLink,
    HiOutlineEye,
} from 'react-icons/hi'
import { labelList } from '../constants'
import { resolveLabelBadge } from '../utils/labels'
import { getAttachmentIcon, normalizeAttachmentType } from '../utils/attachments'
import { apiFetchCustomerMailAttachment } from '@/services/CustomersService'
import type { Mail, MailAttachment } from '../store'
import type { PropsWithChildren } from 'react'
import type { ScrollbarRef } from '@/components/ui/ScrollBar'

type MailDetailContentProps = PropsWithChildren<{
    mail?: Partial<Mail>
}>

type MailMessage = Mail['message'][number]

const MAIL_SAFE_URI_PATTERN =
    /^(?:(?:https?|mailto|tel|cid|data:image\/(?:gif|png|jpe?g|webp|svg\+xml));|#)/i

const sanitizeMailContent = (content?: string) => {
    if (!content) {
        return ''
    }
    let sanitizedContent = content

    try {
        if (typeof window === 'undefined' || typeof DOMPurify?.sanitize !== 'function') {
            return content.replace(
                /<\/?(?:html|head|body|meta|base|link)[^>]*>/gi,
                '',
            )
        }
        sanitizedContent = DOMPurify.sanitize(content, {
            USE_PROFILES: { html: true },
            RETURN_TRUSTED_TYPE: false,
            ALLOWED_URI_REGEXP: MAIL_SAFE_URI_PATTERN,
            FORBID_TAGS: [
                'head',
                'html',
                'body',
                'meta',
                'base',
                'link',
                'style',
                'script',
                'iframe',
                'frame',
                'frameset',
                'object',
                'embed',
            ],
            ADD_ATTR: ['style'],
        })
    } catch (error) {
        if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.warn('Unable to sanitize mail content safely.', error)
        }
        sanitizedContent = content
    }
    return sanitizedContent.replace(
        /<\/?(?:html|head|body|meta|base|link)[^>]*>/gi,
        '',
    )
}

const stripQuotedContent = (content?: string) => {
    if (!content) {
        return ''
    }
    let result = content
    result = result.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    const markerPatterns = [
        /(El\s+(?:lun|mar|mi(?:e|\u00e9)|jue|vie|s(?:a|\u00e1)b|sab|dom)[^<]{0,200}?escribi(?:o|\u00f3):)/i,
        /(En\s+fecha[^<]{0,200}?escribi(?:o|\u00f3):)/i,
        /(On\s+.+?wrote:)/i,
        /(-----Mensaje original-----)/i,
        /(-----Original Message-----)/i,
    ]
    for (const marker of markerPatterns) {
        const index = result.search(marker)
        if (index >= 0) {
            result = result.slice(0, index)
        }
    }
    // Remove trailing quoted lines starting with > once more
    result = result.replace(/(?:^|\n)\s*&gt;.*$/gim, '')
    return result.trim()
}

const parseTimestamp = (value?: string | null) => {
    if (!value) {
        return null
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
}

const getMessageTimestamp = (message: MailMessage) => {
    return (
        parseTimestamp(message.receivedAt) ??
        parseTimestamp(message.sentAt) ??
        null
    )
}

const formatMessageDate = (message: MailMessage) => {
    const timestamp = getMessageTimestamp(message)
    if (timestamp) {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(timestamp)
    }
    return message.date ?? ''
}

const normalizeAddressList = (input?: string[]) => {
    if (!Array.isArray(input)) {
        return []
    }
    return input
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => Boolean(value))
}

const IMAGE_TYPES = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'webp',
    'svg',
    'tif',
    'tiff',
])

const DOCUMENT_TYPES = new Set([
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'csv',
    'ppt',
    'pptx',
    'odt',
    'ods',
    'rtf',
    'txt',
])

const MIME_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    rtf: 'application/rtf',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
}

type AttachmentPreviewState = {
    src: string
    mimeType: string
    kind: 'image' | 'pdf'
    title: string
    revokeOnClose?: boolean
}

const normalizeExtension = (input?: string) => normalizeAttachmentType(input)

const resolveMimeType = (attachment: MailAttachment) => {
    const normalized = normalizeExtension(attachment.type)
    if (attachment.contentType && attachment.contentType.trim()) {
        return attachment.contentType
    }
    if (normalized && MIME_BY_EXTENSION[normalized]) {
        return MIME_BY_EXTENSION[normalized]
    }
    return 'application/octet-stream'
}

const ensureDataUrl = (payload: { base64?: string; mimeType: string }) => {
    const content = payload.base64?.trim()
    if (!content) {
        return undefined
    }
    if (content.startsWith('data:')) {
        return content
    }
    return `data:${payload.mimeType};base64,${content}`
}

const buildAttachmentEndpoints = (
    mail: Partial<Mail>,
    message: MailMessage,
    attachment: MailAttachment,
) => {
    const mimeType = resolveMimeType(attachment)
    const base64 =
        attachment.contentBase64 ??
        attachment.content ??
        undefined

    const normalizedMailId =
        mail.id !== undefined && mail.id !== null ? String(mail.id) : undefined
    const normalizedMessageId =
        message.id !== undefined && message.id !== null
            ? String(message.id)
            : undefined

    const hasAttachmentId = Boolean(attachment.id)

    const baseEndpoint =
        normalizedMailId && hasAttachmentId
            ? `/customers/mail/${normalizedMailId}/attachments/${attachment.id}`
            : undefined

    const inlineUrl =
        attachment.inlineUrl ||
        (baseEndpoint ? `${baseEndpoint}?mode=inline` : undefined)

    const downloadUrl =
        attachment.downloadUrl ||
        (baseEndpoint ? `${baseEndpoint}?mode=attachment` : undefined) ||
        attachment.url

    const directUrl =
        attachment.url ||
        inlineUrl ||
        downloadUrl ||
        (normalizedMailId && normalizedMessageId && hasAttachmentId
            ? `/customers/mail/${normalizedMailId}/messages/${normalizedMessageId}/attachments/${attachment.id}`
            : undefined)

    return {
        mimeType,
        base64,
        inlineUrl,
        downloadUrl,
        directUrl,
    }
}

const triggerDownload = (options: {
    url?: string
    filename: string
    mimeType: string
    base64?: string
}) => {
    const { url, filename, mimeType, base64 } = options

    if (typeof window === 'undefined') {
        return false
    }

    if (base64) {
        const dataUrl = ensureDataUrl({ base64, mimeType })
        if (dataUrl) {
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = filename
            link.rel = 'noopener noreferrer'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            return true
        }
    }

    if (!url) {
        return false
    }

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
}

const createObjectUrlFromBase64 = (base64: string, mimeType: string) => {
    const payload = base64.startsWith('data:')
        ? base64.substring(base64.indexOf(',') + 1)
        : base64
    if (typeof window === 'undefined' || typeof atob !== 'function') {
        return `data:${mimeType};base64,${payload}`
    }
    try {
        const binary = atob(payload)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index)
        }
        const blob = new Blob([bytes], { type: mimeType })
        return URL.createObjectURL(blob)
    } catch (error) {
        if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.warn('Unable to decode attachment content.', error)
        }
        return `data:${mimeType};base64,${payload}`
    }
}

const resolveDirection = (mail: Partial<Mail>, message: MailMessage) => {
    if (message.direction) {
        return message.direction
    }
    if (mail.group === 'sentItem' || mail.group === 'draft') {
        return 'outbound'
    }
    return 'inbound'
}

const MailDetailContent = forwardRef<ScrollbarRef, MailDetailContentProps>(
    (props, ref) => {
        const { mail = {}, children } = props
        const { t } = useTranslation()
        const colorByName = useTwColorByName()

        const [preview, setPreview] = useState<AttachmentPreviewState | null>(null)

        const cleanupPreview = useCallback((state: AttachmentPreviewState | null) => {
            if (state?.revokeOnClose && typeof window !== 'undefined' && state.src.startsWith('blob:')) {
                URL.revokeObjectURL(state.src)
            }
        }, [])

        const handlePreviewClose = useCallback(() => {
            cleanupPreview(preview)
            setPreview(null)
        }, [cleanupPreview, preview])

        const handleDialogCloseButton = useCallback(() => {
            handlePreviewClose()
        }, [handlePreviewClose])

        const handleDialogRequestClose = useCallback(() => {
            handlePreviewClose()
        }, [handlePreviewClose])

        useEffect(() => {
            return () => {
                cleanupPreview(preview)
            }
        }, [cleanupPreview, preview])

        const fetchAttachmentBlob = useCallback(
            async (
                message: MailMessage,
                attachment: MailAttachment,
                mode: 'inline' | 'attachment',
            ) => {
                const normalizedMailId =
                    mail.id !== undefined && mail.id !== null ? String(mail.id) : undefined
                const normalizedAttachmentId =
                    attachment.id !== undefined && attachment.id !== null
                        ? String(attachment.id)
                        : undefined

                if (!normalizedMailId || !normalizedAttachmentId) {
                    return null
                }

                const normalizedMessageId =
                    message.id !== undefined && message.id !== null
                        ? String(message.id)
                        : undefined

                const attempts = normalizedMessageId
                    ? [normalizedMessageId, undefined]
                    : [undefined]

                for (const attempt of attempts) {
                    try {
                        const response = await apiFetchCustomerMailAttachment({
                            mailId: normalizedMailId,
                            attachmentId: normalizedAttachmentId,
                            mode,
                            messageId: attempt,
                        })
                        const payload = response?.data
                        if (!payload) {
                            continue
                        }
                        if (payload instanceof Blob) {
                            return payload
                        }
                        return new Blob([payload], { type: resolveMimeType(attachment) })
                    } catch (error) {
                        if (import.meta.env?.DEV) {
                            // eslint-disable-next-line no-console
                            console.warn('Unable to fetch mail attachment blob.', error)
                        }
                    }
                }

                return null
            },
            [mail],
        )

        const handleAttachmentDownload = useCallback(
            async (message: MailMessage, attachment: MailAttachment) => {
                const endpoints = buildAttachmentEndpoints(mail, message, attachment)
                const filename = attachment.file || 'attachment'
                const success = triggerDownload({
                    url: endpoints.downloadUrl || endpoints.directUrl,
                    filename,
                    mimeType: endpoints.mimeType,
                    base64: endpoints.base64,
                })
                if (success) {
                    return
                }

                const blob = await fetchAttachmentBlob(message, attachment, 'attachment')
                if (blob && typeof window !== 'undefined') {
                    const objectUrl = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = objectUrl
                    link.download = filename
                    link.rel = 'noopener noreferrer'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
                    return
                }

                if (endpoints.directUrl && typeof window !== 'undefined') {
                    window.open(endpoints.directUrl, '_blank', 'noopener,noreferrer')
                }
            },
            [fetchAttachmentBlob, mail],
        )

        const openInNewTab = useCallback((url?: string) => {
            if (typeof window === 'undefined' || !url) {
                return false
            }
            window.open(url, '_blank', 'noopener,noreferrer')
            return true
        }, [])

        const handleAttachmentView = useCallback(
            async (message: MailMessage, attachment: MailAttachment) => {
                const endpoints = buildAttachmentEndpoints(mail, message, attachment)
                const extension = normalizeExtension(attachment.type)
                const filename = attachment.file || 'attachment'
                const dataUrl = ensureDataUrl({
                    base64: endpoints.base64,
                    mimeType: endpoints.mimeType,
                })

                if (IMAGE_TYPES.has(extension)) {
                    let src = dataUrl || endpoints.inlineUrl || endpoints.directUrl
                    let createdObjectUrl = false
                    if (!src) {
                        const blob = await fetchAttachmentBlob(message, attachment, 'inline')
                        if (blob) {
                            src = URL.createObjectURL(blob)
                            createdObjectUrl = true
                        }
                    }

                    if (src) {
                        setPreview({
                            src,
                            mimeType: endpoints.mimeType,
                            kind: 'image',
                            title: filename,
                            revokeOnClose: createdObjectUrl || src.startsWith('blob:'),
                        })
                        return
                    }

                    await handleAttachmentDownload(message, attachment)
                    return
                }

                if (extension === 'pdf') {
                    let src = dataUrl || endpoints.inlineUrl || endpoints.directUrl
                    let createdObjectUrl = false
                    if (!src) {
                        const blob = await fetchAttachmentBlob(message, attachment, 'inline')
                        if (blob) {
                            src = URL.createObjectURL(blob)
                            createdObjectUrl = true
                        }
                    }

                    if (src) {
                        setPreview({
                            src,
                            mimeType: endpoints.mimeType,
                            kind: 'pdf',
                            title: filename,
                            revokeOnClose: createdObjectUrl || src.startsWith('blob:'),
                        })
                        return
                    }

                    await handleAttachmentDownload(message, attachment)
                    return
                }

                if (DOCUMENT_TYPES.has(extension)) {
                    const objectUrlFromData = dataUrl
                        ? createObjectUrlFromBase64(dataUrl, endpoints.mimeType)
                        : undefined
                    if (objectUrlFromData) {
                        const opened = openInNewTab(objectUrlFromData)
                        if (opened) {
                            if (objectUrlFromData.startsWith('blob:') && typeof window !== 'undefined') {
                                window.setTimeout(() => URL.revokeObjectURL(objectUrlFromData), 60_000)
                            }
                            return
                        }
                        if (objectUrlFromData.startsWith('blob:')) {
                            URL.revokeObjectURL(objectUrlFromData)
                        }
                    }

                    if (openInNewTab(endpoints.directUrl || endpoints.inlineUrl)) {
                        return
                    }

                    const blob = await fetchAttachmentBlob(message, attachment, 'inline')
                    if (blob) {
                        const objectUrl = URL.createObjectURL(blob)
                        const opened = openInNewTab(objectUrl)
                        if (opened) {
                            if (objectUrl.startsWith('blob:') && typeof window !== 'undefined') {
                                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
                            }
                            return
                        }
                        if (objectUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(objectUrl)
                        }
                    }

                    await handleAttachmentDownload(message, attachment)
                    return
                }

                await handleAttachmentDownload(message, attachment)
            },
            [fetchAttachmentBlob, handleAttachmentDownload, mail, openInNewTab],
        )

        const label = useMemo(
            () => labelList.find((labelItem) => labelItem.value === mail.label),
            [mail.label],
        )
        const resolvedLabelName = useMemo(
            () => (label ? resolveLabelBadge(t, label) : undefined),
            [label, t],
        )
        const sortedMessages = useMemo(() => {
            if (!mail.message) {
                return []
            }
            const cloned = [...mail.message]
            cloned.sort((a, b) => {
                const timeA = getMessageTimestamp(a)
                const timeB = getMessageTimestamp(b)
                if (timeA && timeB) {
                    return timeA - timeB
                }
                if (timeA && !timeB) {
                    return -1
                }
                if (!timeA && timeB) {
                    return 1
                }
                return 0
            })
            return cloned
        }, [mail.message])

        return (
            <>
                <div className="bg-white dark:bg-gray-800 px-4 py-8 shadow-xs border-b border-gray-200 dark:border-gray-600 md:flex items-center justify-between">
                    <h5>{mail.title}</h5>
                    {mail.label && (
                        <Tag prefix prefixClass={label?.dotClass}>
                            {resolvedLabelName ?? label?.label}
                        </Tag>
                    )}
                </div>
                {preview && (
                    <Dialog
                        isOpen={Boolean(preview)}
                        onClose={handleDialogCloseButton}
                        onRequestClose={handleDialogRequestClose}
                        width={preview.kind === 'pdf' ? 960 : 720}
                        height={preview.kind === 'pdf' ? '75vh' : undefined}
                    >
                        <div className="px-8 pt-8 pb-6">
                            <h6 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {preview.title}
                            </h6>
                            {preview.kind === 'image' ? (
                                <img
                                    src={preview.src}
                                    alt={preview.title}
                                    className="max-h-[70vh] w-full rounded object-contain"
                                />
                            ) : (
                                <iframe
                                    src={preview.src}
                                    title={preview.title}
                                    className="h-[70vh] w-full rounded border border-gray-200 dark:border-gray-600"
                                />
                            )}
                        </div>
                    </Dialog>
                )}
                <ScrollBar ref={ref} autoHide>
                    <div className="m-6 h-full">
                        {children}
                        {sortedMessages.map((message) => {
                            const displayName =
                                (message.name && message.name.trim()) ||
                                message.from ||
                                t('crm.mail.unknownSender', {
                                    defaultValue: 'Unknown sender',
                                })
                            const avatarSrc = resolveAvatarSrc(message.avatar)
                            const avatarClassName = avatarSrc
                                ? undefined
                                : colorByName(displayName)
                            const avatarInitials = avatarSrc
                                ? null
                                : acronym(displayName)
                            const direction = resolveDirection(mail, message)
                            const directionLabel =
                                direction === 'outbound'
                                    ? t('crm.mail.direction.outbound', {
                                          defaultValue: 'Sent',
                                      })
                                    : t('crm.mail.direction.inbound', {
                                          defaultValue: 'Received',
                                      })
                            const directionBadgeClass =
                                direction === 'outbound'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                            const fromAddress =
                                message.from ||
                                mail.from ||
                                t('crm.mail.unknownSender', {
                                    defaultValue: 'Unknown sender',
                                })
                            const toList = (() => {
                                const direct = normalizeAddressList(message.to)
                                if (direct.length) {
                                    return direct
                                }
                                const legacy = normalizeAddressList(message.mail)
                                if (legacy.length) {
                                    return legacy
                                }
                                return normalizeAddressList(mail.mail)
                            })()
                            const ccList = normalizeAddressList(message.cc)
                            const bccList = normalizeAddressList(message.bcc)
                            const messageDate = formatMessageDate(message)
                            const sanitizedRaw = sanitizeMailContent(message.content)
                            const strippedBody = stripQuotedContent(sanitizedRaw)
                            const sanitizedMessageBody =
                                strippedBody.length > 0 ? strippedBody : sanitizedRaw
                            return (
                                <div key={message.id} className="pb-6">
                                    <Card>
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-start gap-3">
                                                <Avatar
                                                    shape="circle"
                                                    src={avatarSrc}
                                                    className={avatarClassName}
                                                >
                                                    {avatarInitials}
                                                </Avatar>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div className="font-semibold truncate text-gray-900 dark:text-gray-100">
                                                            {displayName}
                                                        </div>
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${directionBadgeClass}`}
                                                        >
                                                            {directionLabel}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                                        {t('crm.mail.headers.from', {
                                                            defaultValue: 'From',
                                                        })}
                                                        :{' '}
                                                        <span className="text-gray-900 dark:text-gray-100">
                                                            {fromAddress}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                                        {t('crm.mail.headers.to', {
                                                            defaultValue: 'To',
                                                        })}
                                                        :{' '}
                                                        <span className="text-gray-900 dark:text-gray-100">
                                                            {toList.length
                                                                ? toList.join(', ')
                                                                : t('crm.mail.noRecipients', {
                                                                      defaultValue:
                                                                          'No recipients',
                                                                  })}
                                                        </span>
                                                    </div>
                                                    {ccList.length > 0 && (
                                                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                                            {t('crm.mail.headers.cc', {
                                                                defaultValue: 'Cc',
                                                            })}
                                                            :{' '}
                                                            <span className="text-gray-900 dark:text-gray-100">
                                                                {ccList.join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {bccList.length > 0 && (
                                                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                                            {t('crm.mail.headers.bcc', {
                                                                defaultValue: 'Bcc',
                                                            })}
                                                            :{' '}
                                                            <span className="text-gray-900 dark:text-gray-100">
                                                                {bccList.join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <IconText
                                                icon={
                                                    <HiOutlineClock className="text-lg" />
                                                }
                                            >
                                                <span className="font-semibold">
                                                    {messageDate}
                                                </span>
                                            </IconText>
                                        </div>
                                        <div className="mt-6 break-words">
                                            {ReactHtmlParser(sanitizedMessageBody)}
                                        </div>
                                        {message.attachment?.length > 0 && (
                                            <div className="mt-6 flex flex-col gap-3 md:flex-row md:flex-wrap">
                                                {message.attachment.map((item, index) => {
                                                    const extension = normalizeExtension(item.type)
                                                    const canPreview =
                                                        IMAGE_TYPES.has(extension) ||
                                                        extension === 'pdf'
                                                    const canOpenInBrowser =
                                                        DOCUMENT_TYPES.has(extension) &&
                                                        extension !== 'pdf'
                                                    const key = item.id || `${item.file}-${index}`
                                                    const viewLabel = (() => {
                                                        if (IMAGE_TYPES.has(extension)) {
                                                            return t('crm.mail.actions.preview', {
                                                                defaultValue: 'Preview',
                                                            })
                                                        }
                                                        if (extension === 'pdf') {
                                                            return t('crm.mail.actions.view', {
                                                                defaultValue: 'View',
                                                            })
                                                        }
                                                        return t('crm.mail.actions.open', {
                                                            defaultValue: 'Open',
                                                        })
                                                    })()
                                                    const viewIcon = (() => {
                                                        if (IMAGE_TYPES.has(extension) || extension === 'pdf') {
                                                            return <HiOutlineEye />
                                                        }
                                                        return <HiOutlineExternalLink />
                                                    })()

                                                    return (
                                                        <div
                                                            key={key}
                                                            className="flex min-w-full flex-col gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600 md:min-w-[240px]"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-2xl">
                                                                    {getAttachmentIcon(item.type)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                                                        {item.file}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-300">
                                                                        {item.size}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(canPreview || canOpenInBrowser) && (
                                                                    <Tooltip title={viewLabel}>
                                                                        <Button
                                                                            size="xs"
                                                                            variant="solid"
                                                                            icon={viewIcon}
                                                                            onClick={() =>
                                                                                handleAttachmentView(message, item)
                                                                            }
                                                                        >
                                                                            {viewLabel}
                                                                        </Button>
                                                                    </Tooltip>
                                                                )}
                                                                <Tooltip
                                                                    title={t('crm.mail.actions.download', {
                                                                        defaultValue: 'Download',
                                                                    })}
                                                                >
                                                                    <Button
                                                                        size="xs"
                                                                        variant={canPreview || canOpenInBrowser ? 'plain' : 'solid'}
                                                                        icon={<HiOutlineDownload />}
                                                                        onClick={() =>
                                                                            handleAttachmentDownload(message, item)
                                                                        }
                                                                    >
                                                                        {t('crm.mail.actions.download', {
                                                                            defaultValue: 'Download',
                                                                        })}
                                                                    </Button>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </Card>
                                </div>
                            )
                        })}
                    </div>
                </ScrollBar>
            </>
        )
    },
)

MailDetailContent.displayName = 'MailDetailContent'

export default MailDetailContent
