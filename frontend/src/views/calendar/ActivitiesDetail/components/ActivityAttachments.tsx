import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from '@/components/ui/Card'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import ExpenseAttachmentsField from '@/views/expenses/components/ExpenseAttachmentsField'
import type { ExpenseAttachment } from '@/services/ExpensesService'
import { apiFetchCalendarAttachment } from '@/services/CalendarService'
import {
    apiUpdateCustomerCalendarEvent,
    type CalendarEventAttachment,
    type CalendarEventDto,
} from '@/services/CustomersService'
import { useTranslation } from 'react-i18next'

type ActivityAttachmentsProps = {
    attachments?: CalendarEventAttachment[]
    sourceEvent?: CalendarEventDto
    onRefresh?: () => Promise<void> | void
}

const mapCalendarToExpense = (attachment: CalendarEventAttachment): ExpenseAttachment => ({
    id: String(attachment.id),
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    url: attachment.url,
})

const mapExpenseToCalendar = (attachment: ExpenseAttachment): CalendarEventAttachment => {
    const numericId = Number(attachment.id)
    const isExisting =
        Number.isFinite(numericId) && !Number.isNaN(numericId) && numericId > 0
    return {
        id: String(attachment.id),
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        ...(attachment.url ? { url: attachment.url } : {}),
        // Avoid resending large base64 payloads for persisted attachments.
        ...(attachment.content && !isExisting ? { content: attachment.content } : {}),
    }
}

const ActivityAttachments = ({ attachments = [], sourceEvent, onRefresh }: ActivityAttachmentsProps) => {
    const { t } = useTranslation()
    const contentCache = useRef<Map<string, string>>(new Map())

    const convertCalendarAttachments = useCallback(
        (source: CalendarEventAttachment[]) => {
            const mapped = source.map((attachment) => {
                const converted = mapCalendarToExpense(attachment)
                if (attachment.content) {
                    contentCache.current.set(converted.id, attachment.content)
                }
                return converted
            })
            const validIds = new Set(mapped.map((attachment) => attachment.id))
            Array.from(contentCache.current.keys()).forEach((key) => {
                if (!validIds.has(key)) {
                    contentCache.current.delete(key)
                }
            })
            return mapped
        },
        [contentCache],
    )

    const sanitizeExpenseAttachments = useCallback((list: ExpenseAttachment[]) => {
        const nextCache = new Map(contentCache.current)
        const normalized = list.map((attachment) => {
            const id = String(attachment.id)
            if (attachment.content) {
                nextCache.set(id, attachment.content)
            }
            const numericId = Number(id)
            if (Number.isFinite(numericId) && numericId > 0) {
                const { content, ...rest } = attachment
                return rest
            }
            return attachment
        })
        const validIds = new Set(normalized.map((attachment) => attachment.id))
        Array.from(nextCache.keys()).forEach((key) => {
            if (!validIds.has(key)) {
                nextCache.delete(key)
            }
        })
        return { normalized, nextCache }
    }, [contentCache])

    const [items, setItems] = useState<ExpenseAttachment[]>(() =>
        convertCalendarAttachments(attachments),
    )
    const [saving, setSaving] = useState(false)

    const decodeBase64ToBlob = useCallback((base64: string, mimeType?: string) => {
        if (typeof window === 'undefined') {
            return null
        }
        const normalized = base64.includes(',') ? base64.split(',').pop() || '' : base64
        if (!normalized) {
            return null
        }
        try {
            const binaryString = window.atob(normalized)
            const len = binaryString.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i += 1) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
        } catch (error) {
            return null
        }
    }, [])

    const findItemById = useCallback(
        (id: string) => items.find((attachment) => attachment.id === id),
        [items],
    )

    useEffect(() => {
        setItems(convertCalendarAttachments(attachments))
    }, [attachments, convertCalendarAttachments])

    const toastSuccessMessage = useMemo(
        () => t('calendar.attachments.updateSuccess', { defaultValue: 'Adjuntos actualizados.' }),
        [t],
    )
    const toastErrorMessage = useMemo(
        () =>
            t('calendar.attachments.updateFailed', {
                defaultValue: 'No se pudieron actualizar los adjuntos.',
            }),
        [t],
    )

    const handleChange = async (next: ExpenseAttachment[]) => {
        const previous = items
        const previousCache = new Map(contentCache.current)
        if (!sourceEvent) {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {toastErrorMessage}
                </Notification>,
            )
            return
        }

        const { normalized, nextCache } = sanitizeExpenseAttachments(next)
        setItems(normalized)
        contentCache.current = nextCache
        setSaving(true)
        try {
            const updated = { ...sourceEvent }
            const attachmentsPayload = normalized.map(mapExpenseToCalendar)
            updated.extendedProps = {
                ...(updated.extendedProps ?? {}),
                attachments: attachmentsPayload,
            }
            await apiUpdateCustomerCalendarEvent(String(updated.id), updated)
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Éxito' })}>
                    {toastSuccessMessage}
                </Notification>,
            )
            await onRefresh?.()
        } catch (error) {
            setItems(previous)
            contentCache.current = previousCache
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {toastErrorMessage}
                </Notification>,
            )
        } finally {
            setSaving(false)
        }
    }

    const fetchAttachment = useCallback(
        async (id: string, mode: 'inline' | 'attachment') => {
            const inlineCandidate = findItemById(id)
            const cachedContent =
                inlineCandidate?.content ?? contentCache.current.get(id) ?? null
            try {
                const response = await apiFetchCalendarAttachment(id, { mode })
                const { headers } = response
                const data = response.data as unknown
                if (typeof Blob !== 'undefined' && data instanceof Blob) {
                    return data
                }
                if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
                    const mimeType =
                        (headers as Record<string, string | undefined>)?.['content-type'] ||
                        (headers as Record<string, string | undefined>)?.['Content-Type'] ||
                        inlineCandidate?.type ||
                        'application/octet-stream'
                    return new Blob([data], { type: mimeType })
                }
            } catch (error) {
                if (cachedContent) {
                    const fallback = decodeBase64ToBlob(cachedContent, inlineCandidate?.type)
                    if (fallback) {
                        return fallback
                    }
                }
            }
            return null
        },
        [contentCache, decodeBase64ToBlob, findItemById],
    )

    return (
        <Card>
            <div className="flex flex-col gap-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {t('text.titles.attachments', { defaultValue: 'Adjuntos' })}
                </h4>
                <ExpenseAttachmentsField
                    attachments={items}
                    onChange={handleChange}
                    fetchAttachment={fetchAttachment}
                    multiple
                />
                {saving && (
                    <span className="text-xs text-gray-500 dark:text-gray-300">
                        {t('calendar.attachments.saving', { defaultValue: 'Guardando cambios…' })}
                    </span>
                )}
            </div>
        </Card>
    )
}

export default ActivityAttachments
