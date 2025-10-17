import { useEffect, useMemo, useState } from 'react'
import Upload from '@/components/ui/Upload'
import Button from '@/components/ui/Button'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { HiOutlineDownload, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import type { ExpenseAttachment } from '@/services/ExpensesService'
import Dialog from '@/components/ui/Dialog'

type ExpenseAttachmentsFieldProps = {
    attachments: ExpenseAttachment[]
    onChange: (attachments: ExpenseAttachment[]) => void
    fetchAttachment?: (id: string, mode: 'inline' | 'attachment') => Promise<Blob | null>
    accept?: string
    multiple?: boolean
}

const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const { result } = reader
            if (typeof result === 'string') {
                const base64 = result.includes(',') ? result.split(',').pop() || '' : result
                resolve(base64)
                return
            }
            if (result instanceof ArrayBuffer) {
                const bytes = new Uint8Array(result)
                let binary = ''
                bytes.forEach((byte) => {
                    binary += String.fromCharCode(byte)
                })
                resolve(window.btoa(binary))
                return
            }
            resolve('')
        }
        reader.onerror = () => reject(reader.error || new Error('file-read-error'))
        reader.readAsDataURL(file)
    })

const decodeBase64ToBlob = (base64: string, mimeType?: string) => {
    if (typeof window === 'undefined') {
        return new Blob()
    }
    const normalized = base64.includes(',') ? base64.split(',').pop() || '' : base64
    const binaryString = window.atob(normalized)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

const isPreviewSupported = (mimeType: string) => {
    if (!mimeType) {
        return false
    }
    if (mimeType.startsWith('image/')) {
        return true
    }
    if (mimeType.startsWith('video/')) {
        return true
    }
    if (mimeType === 'application/pdf') {
        return true
    }
    return false
}

const inferMimeType = (attachment: ExpenseAttachment, fallbackType: string) => {
    if (attachment.type && attachment.type.trim().length) {
        return attachment.type
    }
    if (fallbackType && fallbackType.trim().length) {
        return fallbackType
    }
    const extension = attachment.name?.split('.').pop()?.toLowerCase()
    switch (extension) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
            return `image/${extension === 'jpg' ? 'jpeg' : extension}`
        case 'svg':
            return 'image/svg+xml'
        case 'mp4':
        case 'webm':
        case 'ogg':
            return `video/${extension}`
        case 'pdf':
            return 'application/pdf'
        default:
            return fallbackType || 'application/octet-stream'
    }
}

const bytesToLabel = (size?: number) => {
    if (!size || size <= 0) {
        return ''
    }
    if (size < 1024) {
        return `${size} B`
    }
    if (size < 1024 * 1024) {
        return `${Math.round(size / 1024)} KB`
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const ExpenseAttachmentsField = ({
    attachments,
    onChange,
    fetchAttachment,
    accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip',
    multiple = true,
}: ExpenseAttachmentsFieldProps) => {
    const { t } = useTranslation()
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [preview, setPreview] = useState<{
        url: string
        type: string
        name?: string
    } | null>(null)

    const handleFilesAdded = async (files: File[]) => {
        if (!files.length) {
            return
        }
        const timestamp = Date.now()
        const mapped = await Promise.all(
            files.map(async (file, index) => {
                try {
                    const content = await readFileAsBase64(file)
                    return {
                        id: `file-${timestamp}-${index}`,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content,
                    } satisfies ExpenseAttachment
                } catch (error) {
                    return {
                        id: `file-${timestamp}-${index}`,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                    } satisfies ExpenseAttachment
                }
            }),
        )
        const next = [...attachments, ...mapped.filter(Boolean)]
        onChange(next)
    }

    const openBlobInNewTab = (blob: Blob) => {
        if (typeof window === 'undefined') {
            return
        }
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank', 'noopener')
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl)
        }, 10_000)
    }

    const triggerDownload = (blob: Blob, fileName?: string) => {
        if (typeof window === 'undefined') {
            return
        }
        const link = document.createElement('a')
        const blobUrl = URL.createObjectURL(blob)
        link.href = blobUrl
        link.download = fileName || 'attachment'
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
    }

    const openPreview = (blob: Blob, attachment: ExpenseAttachment) => {
        const mimeType = inferMimeType(
            attachment,
            blob.type || 'application/octet-stream',
        )
        if (!isPreviewSupported(mimeType)) {
            return false
        }
        const url = URL.createObjectURL(blob)
        setPreview({
            url,
            type: mimeType,
            name: attachment.name,
        })
        return true
    }

    const closePreview = () => {
        setPreview((current) => {
            if (current?.url) {
                URL.revokeObjectURL(current.url)
            }
            return null
        })
    }

    useEffect(() => {
        return () => {
            if (preview?.url) {
                URL.revokeObjectURL(preview.url)
            }
        }
    }, [preview?.url])

    const resolveBlob = async (
        attachment: ExpenseAttachment,
        mode: 'inline' | 'attachment',
    ): Promise<Blob | null> => {
        if (attachment.content) {
            return decodeBase64ToBlob(attachment.content, attachment.type)
        }
        if (fetchAttachment && attachment.id) {
            try {
                const blob = await fetchAttachment(attachment.id, mode)
                return blob ?? null
            } catch (error) {
                return null
            }
        }
        if (attachment.url && attachment.url.startsWith('blob:')) {
            try {
                const response = await fetch(attachment.url)
                const blob = await response.blob()
                return blob
            } catch (error) {
                return null
            }
        }
        return null
    }

    const handleView = async (attachment: ExpenseAttachment) => {
        setProcessingId(attachment.id)
        const blob = await resolveBlob(attachment, 'inline')
        setProcessingId(null)
        if (blob) {
            const opened = openPreview(blob, attachment)
            if (!opened) {
                openBlobInNewTab(blob)
            }
            return
        }
        toast.push(
            <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                {t('calendar.attachments.downloadFailed', {
                    defaultValue: 'No se pudo obtener el archivo adjunto.',
                })}
            </Notification>,
        )
    }

    const handleDownload = async (attachment: ExpenseAttachment) => {
        setProcessingId(attachment.id)
        const blob = await resolveBlob(attachment, 'attachment')
        setProcessingId(null)
        if (blob) {
            triggerDownload(blob, attachment.name)
            return
        }
        toast.push(
            <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                {t('calendar.attachments.downloadFailed', {
                    defaultValue: 'No se pudo obtener el archivo adjunto.',
                })}
            </Notification>,
        )
    }

    const handleRemove = (attachment: ExpenseAttachment) => {
        let toastKey: string | undefined

        const closeToast = () => {
            if (toastKey) {
                toast.remove(toastKey)
            }
        }

        const confirmRemoval = () => {
            closeToast()
            onChange(attachments.filter((item) => item.id !== attachment.id))
        }

        const cancelRemoval = () => {
            closeToast()
        }

        const message = t('calendar.attachments.confirmDelete', {
            defaultValue: '¿Deseas eliminar el archivo {{name}}?',
            name:
                attachment.name ||
                t('calendar.attachments.unnamed', {
                    defaultValue: 'Archivo sin nombre',
                }),
        })

        const notification = (
            <Notification
                type="warning"
                title={t('common.confirmation', { defaultValue: 'Confirmación' })}
                duration={0}
                closable
            >
                <div className="space-y-3">
                    <p>{message}</p>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="plain" onClick={cancelRemoval}>
                            {t('text.actions.cancel', { defaultValue: 'Cancelar' })}
                        </Button>
                        <Button size="sm" variant="solid" color="red" onClick={confirmRemoval}>
                            {t('text.actions.delete', { defaultValue: 'Eliminar' })}
                        </Button>
                    </div>
                </div>
            </Notification>
        )

        const keyOrPromise = toast.push(notification, {
            placement: 'top-center',
            duration: 0,
        })

        if (keyOrPromise instanceof Promise) {
            keyOrPromise.then((key) => {
                toastKey = key
            })
        } else {
            toastKey = keyOrPromise
        }
    }

    const hasAttachments = attachments.length > 0

    const uploadTip = useMemo(
        () =>
            t('calendar.attachments.supported', {
                defaultValue:
                    'Formatos soportados: imágenes y documentos (pdf, doc, xls, csv, txt, zip).',
            }),
        [t],
    )

    return (
        <>
        <div className="flex flex-col gap-3">
            <Upload
                multiple={multiple}
                fileList={[]}
                accept={accept}
                onChange={handleFilesAdded}
                tip={uploadTip}
            >
                {!hasAttachments && (
                    <div className="my-6 text-center">
                        <DoubleSidedImage
                            className="mx-auto"
                            src="/img/others/upload.png"
                            darkModeSrc="/img/others/upload-dark.png"
                        />
                        <p className="font-semibold">
                            <span className="text-gray-800 dark:text-white">
                                {t('expenses.attachments.dropOr', {
                                    defaultValue: 'Arrastra tu archivo aquí, o ',
                                })}
                            </span>
                            <span className="text-blue-500">
                                {t('expenses.attachments.browse', { defaultValue: 'buscar' })}
                            </span>
                        </p>
                        <p className="mt-1 opacity-60 dark:text-white">
                            {uploadTip}
                        </p>
                    </div>
                )}
            </Upload>

            {hasAttachments && (
                <div className="space-y-2">
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-600 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {attachment.name ||
                                        t('calendar.attachments.unnamed', {
                                            defaultValue: 'Archivo sin nombre',
                                        })}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                                    {(attachment.type || 'Archivo') +
                                        (attachment.size ? ` · ${bytesToLabel(attachment.size)}` : '')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="xs"
                                    variant="plain"
                                    icon={<HiOutlineEye />}
                                    loading={processingId === attachment.id}
                                    onClick={() => handleView(attachment)}
                                    aria-label={t('text.actions.view', { defaultValue: 'Ver' })}
                                />
                                <Button
                                    size="xs"
                                    variant="plain"
                                    icon={<HiOutlineDownload />}
                                    loading={processingId === attachment.id}
                                    onClick={() => handleDownload(attachment)}
                                    aria-label={t('text.actions.download', { defaultValue: 'Descargar' })}
                                />
                                <Button
                                    size="xs"
                                    variant="plain"
                                    icon={<HiOutlineTrash />}
                                    onClick={() => handleRemove(attachment)}
                                    aria-label={t('text.actions.delete', { defaultValue: 'Eliminar' })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <Dialog
            isOpen={Boolean(preview)}
            onClose={closePreview}
            onRequestClose={closePreview}
            width={820}
            contentClassName="max-h-[90vh] w-full max-w-[90vw]"
        >
            {preview ? (
                <div className="flex flex-col gap-4">
                    <div>
                        <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {preview.name ||
                                t('calendar.attachments.unnamed', {
                                    defaultValue: 'Archivo sin nombre',
                                })}
                        </h5>
                        <p className="text-sm text-gray-500 dark:text-gray-300">
                            {preview.type}
                        </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-2 max-h-[70vh] overflow-auto">
                        {preview.type.startsWith('image/') && (
                            <img
                                src={preview.url}
                                alt={preview.name || 'attachment'}
                                className="mx-auto max-h-[65vh] rounded"
                            />
                        )}
                        {preview.type.startsWith('video/') && (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video
                                src={preview.url}
                                controls
                                className="w-full max-h-[65vh] rounded bg-black"
                            />
                        )}
                        {preview.type === 'application/pdf' && (
                            <iframe
                                src={preview.url}
                                title={preview.name || 'attachment'}
                                className="w-full h-[65vh] rounded bg-white"
                            />
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button variant="twoTone" onClick={closePreview}>
                            {t('text.actions.close', { defaultValue: 'Cerrar' })}
                        </Button>
                    </div>
                </div>
            ) : null}
        </Dialog>
        </>
    )
}

export default ExpenseAttachmentsField
