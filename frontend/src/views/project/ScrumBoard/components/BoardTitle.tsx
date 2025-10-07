import { useState } from 'react'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Dropdown from '@/components/ui/Dropdown'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EllipsisButton from '@/components/shared/EllipsisButton'
import {
    HiOutlinePencil,
    HiOutlineTrash,
    HiXCircle,
    HiOutlineExclamation,
    HiOutlinePlusCircle,
    HiCheckCircle,
} from 'react-icons/hi'
import { Formik, Field, Form } from 'formik'
import {
    openDialog,
    updateDialogView,
    setSelectedBoard,
    useAppDispatch,
    useAppSelector,
    updateColumn,
    deleteColumn,
} from '../store'
import requiredFieldValidation from '@/utils/requiredFieldValidation'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { Column } from '../types'
import { useTranslation } from 'react-i18next'

type BoardTitleProps = {
    dragHandleProps?: DraggableProvidedDragHandleProps | null
    column: Column
}

type RenameFormProps = {
    columnId: string
    currentTitle: string
    existingTitles: string[]
    closeRenameForm: () => void
}

const RenameForm = ({
    columnId,
    currentTitle,
    existingTitles,
    closeRenameForm,
}: RenameFormProps) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const onFormSubmit = (newTitle: string) => {
        const trimmed = newTitle.trim()
        if (!trimmed || trimmed === currentTitle) {
            closeRenameForm()
            return
        }

        if (
            existingTitles
                .filter((title) => title !== currentTitle)
                .includes(trimmed)
        ) {
            closeRenameForm()
            return
        }

        dispatch(updateColumn({ columnId, title: trimmed }))
        closeRenameForm()
    }

    return (
        <Formik
            initialValues={{ title: currentTitle }}
            onSubmit={({ title }) => onFormSubmit(title)}
        >
            {({ errors, touched, submitForm }) => (
                <Form>
                    <FormContainer layout="inline" size="sm">
                        <FormItem
                            className="mb-0"
                            invalid={errors.title && touched.title}
                        >
                            <Field
                                type="text"
                                name="title"
                                placeholder={t('text.placeholders.boardTitle')}
                                component={Input}
                                validate={requiredFieldValidation}
                                suffix={
                                    <div className="flex items-center gap-2">
                                        <HiCheckCircle
                                            className="cursor-pointer text-lg text-emerald-500"
                                            onClick={submitForm}
                                        />
                                    </div>
                                }
                            />
                        </FormItem>
                    </FormContainer>
                </Form>
            )}
        </Formik>
    )
}

const BoardTitle = (props: BoardTitleProps) => {
    const { dragHandleProps, column } = props
    const { t } = useTranslation()

    const ordered = useAppSelector((state) => state.scrumBoard.data.ordered)
    const columns = useAppSelector((state) => state.scrumBoard.data.columns)

    const dispatch = useAppDispatch()

    const [renameActive, setRenameActive] = useState(false)
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false)

    const onRenameActive = () => {
        setRenameActive(true)
    }

    const onRenameDeactivate = () => {
        setRenameActive(false)
    }

    const onConfirmDeleteClose = () => {
        setConfirmDeleteDialog(false)
    }

    const onBoardDelete = () => {
        setConfirmDeleteDialog(true)
    }

    const onAddNewTicket = () => {
        dispatch(openDialog())
        dispatch(updateDialogView('NEW_TICKET'))
        dispatch(setSelectedBoard(column.id))
    }

    const onDelete = () => {
        dispatch(deleteColumn({ columnId: column.id }))
    }

    return (
        <div
            className="board-title px-4 py-3 flex justify-between items-center"
            {...dragHandleProps}
        >
            {renameActive ? (
                <>
                    <RenameForm
                        columnId={column.id}
                        currentTitle={column.title}
                        existingTitles={ordered.map(
                            (columnIdItem) => columns[columnIdItem]?.title || '',
                        )}
                        closeRenameForm={onRenameDeactivate}
                    />
                    <HiXCircle
                        className="cursor-pointer text-lg"
                        onClick={onRenameDeactivate}
                    />
                </>
            ) : (
                <>
                    <h6>{column.title}</h6>
                    <Dropdown
                        placement="bottom-end"
                        renderTitle={<EllipsisButton />}
                    >
                        <Dropdown.Item
                            eventKey="renameBoard"
                            onClick={onRenameActive}
                        >
                            <span className="text-lg">
                                <HiOutlinePencil />
                            </span>
                            <span className="ml-2 rtl:mr-2">{t('text.actions.rename')}</span>
                        </Dropdown.Item>
                        <Dropdown.Item
                            eventKey="addTicket"
                            onClick={onAddNewTicket}
                        >
                            <span className="text-lg">
                                <HiOutlinePlusCircle />
                            </span>
                            <span className="ml-2 rtl:mr-2">{t('text.actions.addTicket')}</span>
                        </Dropdown.Item>
                        <Dropdown.Item
                            eventKey="deleteBoard"
                            onClick={onBoardDelete}
                        >
                            <span className="text-lg">
                                <HiOutlineTrash />
                            </span>
                            <span className="ml-2 rtl:mr-2">{t('text.actions.deleteBoard')}</span>
                        </Dropdown.Item>
                    </Dropdown>
                </>
            )}
            <Dialog
                isOpen={confirmDeleteDialog}
                contentClassName="pb-0 px-0 "
                onClose={onConfirmDeleteClose}
                onRequestClose={onConfirmDeleteClose}
            >
                <div className="px-6 pb-6 pt-2 flex">
                    <div>
                        <Avatar
                            className="text-red-600 bg-red-100 dark:text-red-100 dark:bg-red-500/20"
                            shape="circle"
                        >
                            <span className="text-2xl">
                                <HiOutlineExclamation />
                            </span>
                        </Avatar>
                    </div>
                    <div className="ml-4 rtl:mr-4">
                        <h5 className="mb-2">{t('text.titles.deleteBoard')}</h5>
                        <p>
                            {t('text.messages.deleteBoardConfirm')}
                        </p>
                    </div>
                </div>
                <div className="text-right px-6 py-3 bg-gray-100 dark:bg-gray-700 rounded-bl-lg rounded-br-lg">
                    <Button
                        size="sm"
                        className="ltr:mr-2 rtl:ml-2"
                        onClick={onConfirmDeleteClose}
                    >
                        {t('text.actions.cancel')}
                    </Button>
                    <Button
                        size="sm"
                        variant="solid"
                        color="red-600"
                        onClick={onDelete}
                    >
                        {t('text.actions.delete')}
                    </Button>
                </div>
            </Dialog>
        </div>
    )
}

export default BoardTitle
