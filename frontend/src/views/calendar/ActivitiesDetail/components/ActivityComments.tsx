import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
    HiOutlineChatAlt2,
    HiOutlinePaperAirplane,
    HiOutlinePencil,
    HiOutlineTrash,
} from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useAppDispatch, useAppSelector, addComment, updateComment, removeComment } from '../store'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import UserAvatar from '@/components/shared/UserAvatar'
import { resolveAvatarSrc } from '@/utils/avatar'
import useConfirmation from '@/hooks/useConfirmation'

type ActivityCommentsProps = {
    activityId: string
}

const ActivityComments = ({ activityId }: ActivityCommentsProps) => {
    const { t } = useTranslation()
    const { confirm, ConfirmationDialog } = useConfirmation()
    const dispatch = useAppDispatch()
    const comments = useAppSelector(
        (state) => state.calendarActivityDetails.data.profileData.comments,
    )
    const currentUser = useSelector((state: RootState) => state.auth.user)
    const currentUserAvatar = resolveAvatarSrc(currentUser?.avatar)
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editingMessage, setEditingMessage] = useState('')
    const [updating, setUpdating] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const isSuperAdmin = Boolean(
        currentUser?.authority?.some((role) => role === 'SUPERADMIN'),
    )

    const getCreatedAtValue = (value?: string) => {
        const parsed = dayjs(value)
        return parsed.isValid() ? parsed.valueOf() : 0
    }

    const sortedComments = useMemo(() => {
        if (!Array.isArray(comments)) {
            return []
        }
        return [...comments].sort(
            (a, b) => getCreatedAtValue(a.createdAt) - getCreatedAtValue(b.createdAt),
        )
    }, [comments])

    const normalizeValue = (value?: string | null) =>
        (value || '').trim().toLowerCase()

    const canModifyComment = (comment: (typeof sortedComments)[number]) => {
        if (isSuperAdmin) {
            return true
        }
        const commentEmail = normalizeValue(comment.author?.email)
        const currentEmail = normalizeValue(currentUser?.email)
        return Boolean(commentEmail && currentEmail && commentEmail === currentEmail)
    }

    const handleSubmit = async () => {
        const trimmed = message.trim()
        if (!trimmed) {
            return
        }
        setSubmitting(true)
        try {
            await dispatch(addComment({ id: activityId, message: trimmed })).unwrap()
            setMessage('')
        } catch {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('calendar.comments.createFailed', {
                        defaultValue: 'No se pudo agregar el comentario.',
                    })}
                </Notification>,
            )
        } finally {
            setSubmitting(false)
        }
    }

    const beginEdit = (commentId: string, currentMessage: string) => {
        setEditingCommentId(commentId)
        setEditingMessage(currentMessage)
    }

    const cancelEdit = () => {
        setEditingCommentId(null)
        setEditingMessage('')
    }

    const handleUpdateComment = async () => {
        if (!editingCommentId) {
            return
        }
        const trimmed = editingMessage.trim()
        if (!trimmed) {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('calendar.comments.messageRequired', {
                        defaultValue: 'El comentario no puede estar vacío.',
                    })}
                </Notification>,
            )
            return
        }
        setUpdating(true)
        try {
            await dispatch(
                updateComment({
                    activityId,
                    commentId: editingCommentId,
                    message: trimmed,
                }),
            ).unwrap()
            cancelEdit()
        } catch {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('calendar.comments.updateFailed', {
                        defaultValue: 'No se pudo actualizar el comentario.',
                    })}
                </Notification>,
            )
        } finally {
            setUpdating(false)
        }
    }

    const handleDeleteComment = async (commentId: string) => {
        const confirmed = await confirm({
            title: t('text.actions.delete'),
            message: t('calendar.comments.deleteConfirm', {
                defaultValue: '¿Eliminar este comentario?',
            }),
            confirmText: t('text.actions.delete'),
            cancelText: t('text.actions.cancel'),
        })
        if (!confirmed) {
            return
        }
        setDeletingId(commentId)
        try {
            await dispatch(removeComment({ activityId, commentId })).unwrap()
            if (editingCommentId === commentId) {
                cancelEdit()
            }
        } catch {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('calendar.comments.deleteFailed', {
                        defaultValue: 'No se pudo eliminar el comentario.',
                    })}
                </Notification>,
            )
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <>
            <Card>
            <div className="flex gap-4">
                <div className="mt-1 text-2xl text-gray-500 dark:text-gray-300">
                    <HiOutlineChatAlt2 />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {t('calendar.comments.title', { defaultValue: 'Comentarios' })}
                        </h4>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4">
                            {sortedComments.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    {t('calendar.comments.empty', {
                                        defaultValue: 'Aún no hay comentarios para esta actividad.',
                                    })}
                                </p>
                            )}
                            {sortedComments.map((comment) => {
                                const authorAvatar =
                                    resolveAvatarSrc(comment.author?.img) ??
                                    resolveAvatarSrc(
                                        (comment.author as { avatar?: string | null })?.avatar,
                                    )
                                return (
                                    <div key={comment.id} className="flex">
                                        <UserAvatar
                                            size={40}
                                            src={authorAvatar}
                                            shape="circle"
                                        />
                                        <div className="ml-2 rtl:mr-2 p-3 rounded-sm w-full bg-gray-50 dark:bg-gray-700/40">
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex flex-wrap items-center text-xs text-gray-500 dark:text-gray-400 gap-2">
                                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                        {comment.author?.name || comment.author?.email ||
                                                            t('calendar.comments.anonymous', {
                                                                defaultValue: 'Usuario',
                                                            })}
                                                    </span>
                                                    <span className="text-gray-400">•</span>
                                                    <span>
                                                        {dayjs(comment.createdAt).format('DD MMM YYYY HH:mm')}
                                                    </span>
                                                </div>
                                                {canModifyComment(comment) && editingCommentId !== comment.id && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="xs"
                                                            variant="plain"
                                                            icon={<HiOutlinePencil />}
                                                            onClick={() => beginEdit(comment.id, comment.message)}
                                                        >
                                                            {t('calendar.comments.edit', {
                                                                defaultValue: 'Editar',
                                                            })}
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="plain"
                                                            icon={<HiOutlineTrash />}
                                                            loading={deletingId === comment.id}
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                        >
                                                            {t('calendar.comments.delete', {
                                                                defaultValue: 'Eliminar',
                                                            })}
                                                        </Button>
                                                    </div>
                                                )}
                                        </div>
                                        {editingCommentId === comment.id ? (
                                            <div className="flex flex-col gap-3">
                                                <Input
                                                    textArea
                                                    rows={4}
                                                    className="min-h-[120px]"
                                                    value={editingMessage}
                                                    name={`comment-${comment.id}`}
                                                    onChange={(e) =>
                                                        setEditingMessage(
                                                            (e.target?.value as string) ?? '',
                                                        )
                                                    }
                                                    autoFocus
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        onClick={handleUpdateComment}
                                                        loading={updating}
                                                        disabled={!editingMessage.trim()}
                                                    >
                                                        {t('calendar.comments.save', {
                                                            defaultValue: 'Guardar',
                                                        })}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={cancelEdit}
                                                        disabled={updating}
                                                    >
                                                        {t('calendar.comments.cancel', {
                                                            defaultValue: 'Cancelar',
                                                        })}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line mb-0">
                                                {comment.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                        <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                            <UserAvatar
                                size={40}
                                src={currentUserAvatar}
                                shape="circle"
                                className="mt-1"
                            />
                            <div className="flex-1 flex flex-col gap-2">
                                <Input
                                    textArea
                                    rows={4}
                                    className="min-h-[140px]"
                                    value={message}
                                    name={`new-comment-${activityId}`}
                                    onChange={(e) => setMessage((e?.target?.value as string) ?? '')}
                                    placeholder={t('calendar.comments.placeholder', {
                                        defaultValue: 'Escribe un comentario...',
                                    })}
                                />
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        className="h-11 w-11 rounded-full p-0 flex items-center justify-center"
                                        onClick={handleSubmit}
                                        disabled={!message.trim()}
                                        loading={submitting}
                                        icon={<HiOutlinePaperAirplane className="text-lg" />}
                                    >
                                        <span className="sr-only">
                                            {t('calendar.comments.add', {
                                                defaultValue: 'Agregar comentario',
                                            })}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </Card>
            {ConfirmationDialog}
        </>
    )
}

export default ActivityComments
