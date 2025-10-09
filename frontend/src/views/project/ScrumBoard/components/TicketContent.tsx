import { useEffect, useState, useRef } from 'react'
import { updateColumns, useAppDispatch, useAppSelector } from '../store'
import Spinner from '@/components/ui/Spinner'
import Avatar from '@/components/ui/Avatar'
import Tooltip from '@/components/ui/Tooltip'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Dropdown from '@/components/ui/Dropdown'
import Tag from '@/components/ui/Tag'
import Badge from '@/components/ui/Badge'
import UsersAvatarGroup from '@/components/shared/UsersAvatarGroup'
import dayjs from 'dayjs'
import cloneDeep from 'lodash/cloneDeep'
import {
    HiOutlinePlus,
    HiOutlineCheckCircle,
    HiOutlineClipboardList,
    HiOutlinePaperClip,
    HiOutlineDownload,
    HiOutlineTrash,
    HiOutlineChatAlt,
    HiX,
} from 'react-icons/hi'
import isEmpty from 'lodash/isEmpty'
import { createUID, taskLabelColors, labelList } from '../utils'
import { useTranslation } from 'react-i18next'
import { Ticket, Comment, Member } from '../types'
import type { ElementType, PropsWithChildren, ReactNode } from 'react'

interface TransformedComment extends Omit<Comment, 'date'> {
    date: Date
}

type TicketSectionProps = PropsWithChildren<{
    title?: string
    icon?: ReactNode
    titleSize?: ElementType
    ticketClose?: () => void
}>

const createCommentObject = (message: string): TransformedComment => {
    return {
        id: createUID(10),
        name: 'Carolyn Perkins',
        src: '/img/avatars/thumb-1.jpg',
        message: message,
        date: new Date(),
    }
}

const TicketSection = ({
    title,
    icon,
    children,
    titleSize: Title = 'h6',
    ticketClose,
}: TicketSectionProps) => {
    return (
        <div className="flex mb-10">
            <div className="text-2xl">{icon}</div>
            <div className="ml-2 rtl:mr-2 w-full">
                <div className="flex justify-between">
                    <Title>{title}</Title>
                    {ticketClose && (
                        <Button
                            size="sm"
                            shape="circle"
                            variant="plain"
                            icon={<HiX className="text-lg" />}
                            onClick={() => ticketClose()}
                        />
                    )}
                </div>
                {children}
            </div>
        </div>
    )
}

const AddMoreMember = () => {
    const { t } = useTranslation()
    return (
        <Tooltip title={t('text.actions.addMore')}>
            <Avatar className="cursor-pointer" shape="circle" size={30}>
                <HiOutlinePlus />
            </Avatar>
        </Tooltip>
    )
}

const TicketContent = ({ onTicketClose }: { onTicketClose: () => void }) => {
    const ticketId = useAppSelector((state) => state.scrumBoard.data.ticketId)
    const columns = useAppSelector((state) => state.scrumBoard.data.columns)
    const boardMembers = useAppSelector(
        (state) => state.scrumBoard.data.boardMembers,
    )

    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const [ticketData, setTicketData] = useState<
        Partial<Omit<Ticket, 'comments'> & { comments: TransformedComment[] }>
    >({})
    const [loading, setLoading] = useState(false)

    const commentInput = useRef<HTMLInputElement>(null)

    const getTicketDetail = async () => {
        setLoading(true)
        let ticketDetail = {}
        Object.values(columns).forEach((column) => {
            const result = column.tickets.find((ticket) => ticket.id === ticketId)
            if (result) {
                ticketDetail = result
            }
        })
        setTicketData(ticketDetail)
        setLoading(false)
    }

    useEffect(() => {
        if (isEmpty(ticketData)) {
            getTicketDetail()
        } else {
            onUpdateColumn()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketData, ticketData])

    const submitComment = () => {
        if (commentInput.current) {
            const message = commentInput.current.value
            const comment = createCommentObject(message)
            const comments = cloneDeep(ticketData.comments)
            comments?.push(comment)
            setTicketData((prevState) => ({
                ...prevState,
                ...{ comments: comments },
            }))
            commentInput.current.value = ''
        }
    }

    const handleTicketClose = () => {
        onTicketClose?.()
    }

    const onUpdateColumn = () => {
        const data = cloneDeep(columns)
        Object.keys(data).forEach((key) => {
            const column = data[key]
            column.tickets = column.tickets.map((ticket) =>
                ticket.id === ticketId ? (ticketData as Ticket) : ticket,
            )
        })
        dispatch(updateColumns(data))
    }

    const onAddMemberClick = (id: string) => {
        const newMember = boardMembers.find((member) => member.id === id)
        const members = cloneDeep(ticketData.members)
        members?.push(newMember as Member)
        setTicketData((prevState) => ({
            ...prevState,
            ...{ members: members },
        }))
    }

    return (
        <>
            {loading ? (
                <div className="flex justify-center items-center min-h-[300px]">
                    <Spinner size={40} />
                </div>
            ) : (
                <>
                    <div className="max-h-[700px] overflow-y-auto">
                        <TicketSection
                            title={ticketData.name}
                            icon={<HiOutlineCheckCircle />}
                            titleSize="h5"
                            ticketClose={handleTicketClose}
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="mt-4">
                                    <div className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
                                        Assigned to:
                                    </div>
                                    <UsersAvatarGroup
                                        avatarProps={{
                                            className:
                                                'mr-1 rtl:ml-1 cursor-pointer',
                                        }}
                                        avatarGroupProps={{ maxCount: 4 }}
                                        chained={false}
                                        users={ticketData.members}
                                    />
                                    {boardMembers.length !==
                                        ticketData.members?.length && (
                                        <Dropdown
                                            renderTitle={<AddMoreMember />}
                                        >
                                            {boardMembers.map(
                                                (member) =>
                                                    !ticketData.members?.some(
                                                        (m) =>
                                                            m.id === member.id,
                                                    ) && (
                                                        <Dropdown.Item
                                                            key={member.name}
                                                            eventKey={member.id}
                                                            onSelect={
                                                                onAddMemberClick
                                                            }
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center">
                                                                    <Avatar
                                                                        shape="circle"
                                                                        size={
                                                                            22
                                                                        }
                                                                        src={
                                                                            member.img
                                                                        }
                                                                    />
                                                                    <span className="ml-2 rtl:mr-2">
                                                                        {
                                                                            member.name
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </Dropdown.Item>
                                                    ),
                                            )}
                                        </Dropdown>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <div className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
                                        {t('text.columns.priority')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const current = (ticketData.labels || []).find((l) =>
                                                ['High priority', 'Medium priority', 'Low priority'].includes(l),
                                            )
                                            if (!current) return null
                                            const display =
                                                current === 'High priority'
                                                    ? t('text.priority.high')
                                                    : current === 'Medium priority'
                                                    ? t('text.priority.medium')
                                                    : t('text.priority.low')
                                            return (
                                                <Tag
                                                    prefix
                                                    className="mr-2 rtl:ml-2 mb-2"
                                                    prefixClass={`${taskLabelColors[current]}`}
                                                >
                                                    {display}
                                                </Tag>
                                            )
                                        })()}
                                        <Dropdown
                                            renderTitle={
                                                <Tag className="border-dashed cursor-pointer mr-2 rtl:ml-2">
                                                    {t('text.columns.priority')}
                                                </Tag>
                                            }
                                            placement="bottom-end"
                                        >
                                            {labelList.map((key) => {
                                                const label =
                                                    key === 'high'
                                                        ? 'High priority'
                                                        : key === 'medium'
                                                        ? 'Medium priority'
                                                        : 'Low priority'
                                                return (
                                                    <Dropdown.Item
                                                        key={key}
                                                        eventKey={label}
                                                        onSelect={() =>
                                                            setTicketData((prev) => ({
                                                                ...prev,
                                                                labels: [label],
                                                            }))
                                                        }
                                                    >
                                                        <div className="flex items-center">
                                                            <Badge innerClass={`${taskLabelColors[label]}`} />
                                                            <span className="ml-2 rtl:mr-2">
                                                                {t(`text.priority.${key}`)}
                                                            </span>
                                                        </div>
                                                    </Dropdown.Item>
                                                )
                                            })}
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </TicketSection>
                        {ticketData.description && (
                            <TicketSection
                                title={t('text.titles.description')}
                                icon={<HiOutlineClipboardList />}
                            >
                                <div className="mt-2">
                                    <p className="mt-2">
                                        {ticketData.description}
                                    </p>
                                </div>
                            </TicketSection>
                        )}

                        {ticketData.attachments &&
                            ticketData?.attachments?.length > 0 && (
                                <TicketSection
                                    title={t('text.titles.attachments')}
                                    icon={<HiOutlinePaperClip />}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                        {ticketData.attachments.map((file) => (
                                            <Card
                                                key={file.id}
                                                bodyClass="px-2 pt-2 pb-1"
                                            >
                                                <img
                                                    className="max-w-full rounded-sm"
                                                    alt={file.name}
                                                    src={file.src}
                                                />
                                                <div className="mt-1 flex justify-between items-center">
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {file.name}
                                                        </div>
                                                        <span className="text-xs">
                                                            {file.size}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Tooltip title={t('text.actions.download')}>
                                                            <Button
                                                                className="mr-1 rtl:ml-1"
                                                                variant="plain"
                                                                size="xs"
                                                                icon={
                                                                    <HiOutlineDownload />
                                                                }
                                                            />
                                                        </Tooltip>
                                                        <Tooltip title={t('text.actions.delete')}>
                                                            <Button
                                                                variant="plain"
                                                                size="xs"
                                                                icon={
                                                                    <HiOutlineTrash />
                                                                }
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </TicketSection>
                            )}

                        <TicketSection
                            title={t('text.titles.comments')}
                            icon={<HiOutlineChatAlt />}
                        >
                            <div className="mt-2 w-full">
                                {ticketData.comments &&
                                    ticketData?.comments?.length > 0 && (
                                        <>
                                            {ticketData.comments.map(
                                                (comment) => (
                                                    <div
                                                        key={comment.id}
                                                        className="mb-3 flex"
                                                    >
                                                        <div className="mt-2">
                                                            <Avatar
                                                                shape="circle"
                                                                src={
                                                                    comment.src
                                                                }
                                                            />
                                                        </div>
                                                        <div className="ml-2 rtl:mr-2 p-3 rounded-sm w-100">
                                                            <div className="flex items-center mb-2">
                                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                                    {
                                                                        comment.name
                                                                    }
                                                                </span>
                                                                <span className="mx-1">
                                                                    {' '}
                                                                    |{' '}
                                                                </span>
                                                                <span>
                                                                    {dayjs(
                                                                        comment.date,
                                                                    ).format(
                                                                        'DD MMMM YYYY',
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <p className="mb-0">
                                                                {
                                                                    comment.message
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </>
                                    )}
                                <div className="mb-3 flex">
                                    <Avatar
                                        shape="circle"
                                        src="/img/avatars/thumb-1.jpg"
                                    />
                                    <div className="ml-2 rtl:mr-2 px-3 rounded-sm w-full">
                                        <Input
                                            ref={commentInput}
                                            placeholder={t('text.placeholders.writeComment')}
                                            suffix={
                                                <div
                                                    className="cursor-pointer font-weight-semibold text-primary"
                                                    onClick={() =>
                                                        submitComment()
                                                    }
                                                >
                                                    {t('text.actions.send')}
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </TicketSection>
                    </div>
                    <div className="text-right mt-4">
                        <Button
                            className="mr-2 rtl:ml-2"
                            size="sm"
                            variant="plain"
                            onClick={() => handleTicketClose()}
                        >
                            {t('text.actions.cancel')}
                        </Button>
                        <Button
                            variant="solid"
                            size="sm"
                            onClick={() => handleTicketClose()}
                        >
                            {t('text.actions.change')}
                        </Button>
                    </div>
                </>
            )}
        </>
    )
}

export default TicketContent
