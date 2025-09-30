import { forwardRef } from 'react'
import classNames from 'classnames'
import Card from '@/components/ui/Card'
import Tag from '@/components/ui/Tag'
import UsersAvatarGroup from '@/components/shared/UsersAvatarGroup'
import IconText from '@/components/shared/IconText'
import { HiOutlineChatAlt2, HiOutlinePaperClip, HiFlag } from 'react-icons/hi'
import {
    openDialog,
    updateDialogView,
    setSelectedTicketId,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { taskLabelColors } from '../utils'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import type { Ticket } from '../types'
import type { CardProps } from '@/components/ui/Card'

interface BoardCardProps extends CardProps {
    data: Ticket
}

const BoardCard = forwardRef<HTMLDivElement, BoardCardProps>((props, ref) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const selectedTab = useAppSelector(
        (state) => state.scrumBoard.data.selectedTab,
    )

    const { data, ...rest } = props

    const { id, name, comments, attachments, members, dueDate, labels } = data

    const onCardClick = () => {
        dispatch(openDialog())
        dispatch(updateDialogView('TICKET'))
        dispatch(setSelectedTicketId(id))
    }

    const priorityMatch = (labels: string[] | undefined, tab: string) => {
        if (!labels || tab === 'all') return true
        const has = (v: string) => labels.includes(v)
        switch (tab) {
            case 'high':
                return has('High priority') || has('Live issue') || has('Bug')
            case 'medium':
                return has('Medium priority') || has('Task')
            case 'low':
                return has('Low priority')
            default:
                // fallback to original behavior for any other tag
                return labels.includes(tab)
        }
    }

    const hidden = selectedTab !== 'all' && !priorityMatch(labels, selectedTab)

    return (
        <Card
            ref={ref}
            clickable
            className={classNames(
                'hover:shadow-lg rounded-lg dark:bg-gray-700 bg-gray-50',
                hidden ? 'opacity-0 overflow-hidden h-0' : 'mb-4',
            )}
            bodyClass="p-4"
            onClick={() => onCardClick()}
            {...rest}
        >
            {labels && labels.length > 0 && (
                <>
                    {labels.map((label, index) => {
                        const display =
                            label === 'High priority'
                                ? t('text.priority.high')
                                : label === 'Medium priority'
                                ? t('text.priority.medium')
                                : label === 'Low priority'
                                ? t('text.priority.low')
                                : label
                        return (
                        <Tag
                            key={label + index}
                            prefix
                            className="mr-2 rtl:ml-2 mb-2"
                            prefixClass={`${taskLabelColors[label]}`}
                        >
                            {display}
                        </Tag>
                        )
                    })}
                </>
            )}
            <h6 className="mb-2">{name}</h6>
            {dueDate && (
                <IconText
                    className="mb-2 text-sm font-semibold"
                    icon={<HiFlag className="text-lg" />}
                >
                    {dayjs(dueDate).format('MMMM DD')}
                </IconText>
            )}
            <div className="flex items-center justify-between mt-3">
                <UsersAvatarGroup avatarProps={{ size: 25 }} users={members} />
                <div className="flex items-center gap-2">
                    {comments && comments.length > 0 && (
                        <IconText
                            className="font-semibold"
                            icon={<HiOutlineChatAlt2 className="text-base" />}
                        >
                            {comments.length}
                        </IconText>
                    )}
                    {attachments && attachments.length > 0 && (
                        <IconText
                            icon={<HiOutlinePaperClip />}
                            className="text-base"
                        >
                            {attachments.length}
                        </IconText>
                    )}
                </div>
            </div>
        </Card>
    )
})

BoardCard.displayName = 'BoardCard'

export default BoardCard
