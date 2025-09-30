import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import BoardAddNewColumn from './BoardAddNewColumn'
import QuickFilterTab from './QuickFilterTab'
import Container from '@/components/shared/Container'
import UsersAvatarGroup from '@/components/shared/UsersAvatarGroup'
import {
    getMembers,
    openDialog,
    updateDialogView,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { HiOutlineUserAdd } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const BoardHeader = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const navigate = useNavigate()

    const boardMembers = useAppSelector(
        (state) => state.scrumBoard.data.boardMembers,
    )

    const onAddMember = () => {
        dispatch(updateDialogView('ADD_MEMBER'))
        dispatch(openDialog())
    }

    useEffect(() => {
        dispatch(getMembers())
    }, [dispatch])

    return (
        <div className="pt-8 pb-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
            <Container className="px-6">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h3>{t('text.titles.taskManagement')}</h3>
                        <p className="mt-1">{t('text.descriptions.taskManagement')}</p>
                    </div>
                    <UsersAvatarGroup users={boardMembers} />
                </div>
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                    <QuickFilterTab />
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            icon={<HiOutlineUserAdd />}
                            onClick={onAddMember}
                        />
                        {/* Removed settings shortcut button */}
                        <BoardAddNewColumn />
                    </div>
                </div>
            </Container>
        </div>
    )
}

export default BoardHeader
