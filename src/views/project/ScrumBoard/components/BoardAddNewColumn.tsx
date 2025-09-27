import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { openDialog, updateDialogView } from '../store'
import { HiOutlinePlusCircle } from 'react-icons/hi'

const BoardAddNewColumn = () => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const onAddNewColumn = () => {
        dispatch(updateDialogView('NEW_COLUMN'))
        dispatch(openDialog())
    }

    return (
        <Button
            size="sm"
            icon={<HiOutlinePlusCircle />}
            onClick={onAddNewColumn}
        >
            <span>{t('text.actions.add')}</span>
        </Button>
    )
}

export default BoardAddNewColumn
