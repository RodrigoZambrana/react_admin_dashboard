import Dialog from '@/components/ui/Dialog'
import NewProjectForm from './NewProjectForm'
import {
    toggleNewProjectDialog,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { useTranslation } from 'react-i18next'

const NewProjectDialog = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const newProjectDialog = useAppSelector(
        (state) => state.projectList.data.newProjectDialog,
    )

    const onDialogClose = () => {
        dispatch(toggleNewProjectDialog(false))
    }

    return (
        <Dialog
            isOpen={newProjectDialog}
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
        >
            <h4>{t('text.titles.addNewProject')}</h4>
            <div className="mt-4">
                <NewProjectForm />
            </div>
        </Dialog>
    )
}

export default NewProjectDialog
