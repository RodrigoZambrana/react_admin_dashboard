import { useMemo } from 'react'
import { appPath } from '@/constants/route.constant'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Tag from '@/components/ui/Tag'
import { useNavigate } from 'react-router-dom'
import UsersAvatarGroup from '@/components/shared/UsersAvatarGroup'
import ActionLink from '@/components/shared/ActionLink'
import { useTranslation } from 'react-i18next'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
} from '@tanstack/react-table'

type Task = {
    taskId: string
    taskSubject: string
    priority: number
    assignees: {
        id: string
        name: string
        email: string
        img: string
    }[]
}

type MyTasksProps = {
    data?: Task[]
}

const { Tr, Th, Td, THead, TBody } = Table

const PriorityTag = ({ priority }: { priority: number }) => {
    const { t } = useTranslation()
    switch (priority) {
        case 0:
            return (
                <Tag className="text-red-600 bg-red-100 dark:text-red-100 dark:bg-red-500/20 rounded-sm border-0">
                    {t('text.priority.high')}
                </Tag>
            )
        case 1:
            return (
                <Tag className="text-amber-600 bg-amber-100 dark:text-amber-100 dark:bg-amber-500/20 rounded-sm border-0">
                    {t('text.priority.medium')}
                </Tag>
            )
        case 2:
            return (
                <Tag className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100 rounded-sm border-0">
                    {t('text.priority.low')}
                </Tag>
            )
        default:
            return null
    }
}

const MyTasks = ({ data = [] }: MyTasksProps) => {
    const navigate = useNavigate()
    const { t } = useTranslation()

    const columns: ColumnDef<Task>[] = useMemo(
        () => [
            {
                header: t('text.columns.taskId'),
                accessorKey: 'taskId',
                cell: (props) => {
                    const { taskId } = props.row.original
                    return (
                        <ActionLink
                            themeColor={false}
                            className="font-semibold"
                            to={appPath('/project/scrum-board')}
                        >
                            {taskId}
                        </ActionLink>
                    )
                },
            },
            {
                header: t('text.columns.subject'),
                accessorKey: 'taskSubject',
            },
            {
                header: t('text.columns.priority'),
                accessorKey: 'priority',
                cell: (props) => {
                    const { priority } = props.row.original
                    return <PriorityTag priority={priority} />
                },
            },
            {
                header: t('text.columns.assignees'),
                accessorKey: 'Assignees',
                cell: (props) => {
                    const { assignees } = props.row.original
                    return <UsersAvatarGroup users={assignees} />
                },
            },
        ],
        [t],
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    const onViewAllTask = () => {
        navigate(appPath('/project/issue'))
    }

    return (
        <Card>
            <div className="flex items-center justify-between mb-6">
                <h4>{t('text.titles.myTasks')}</h4>
                <Button size="sm" onClick={onViewAllTask}>
                    {t('text.actions.viewAll')}
                </Button>
            </div>
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <Th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
                                    </Th>
                                )
                            })}
                        </Tr>
                    ))}
                </THead>
                <TBody>
                    {table.getRowModel().rows.map((row) => {
                        return (
                            <Tr key={row.id}>
                                {row.getVisibleCells().map((cell) => {
                                    return (
                                        <Td key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </Td>
                                    )
                                })}
                            </Tr>
                        )
                    })}
                </TBody>
            </Table>
        </Card>
    )
}

export default MyTasks
