import { FormItem, FormContainer } from '@/components/ui'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Formik, Field, Form } from 'formik'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Avatar from '@/components/ui/Avatar'
import Dropdown from '@/components/ui/Dropdown'
import Tooltip from '@/components/ui/Tooltip'
import UsersAvatarGroup from '@/components/shared/UsersAvatarGroup'
import {
    closeDialog,
    setSelectedBoard,
    createTicket,
    useAppDispatch,
    useAppSelector,
} from '../store'
import requiredFieldValidation from '@/utils/requiredFieldValidation'
import dayjs from 'dayjs'
import { HiOutlinePlus } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'

const AddNewColumnContent = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const board = useAppSelector((state) => state.scrumBoard.data.board)
    const boardMembers = useAppSelector(
        (state) => state.scrumBoard.data.boardMembers,
    )

    const priorityOptions = [
        { value: 'High priority', label: t('text.priority.high') },
        { value: 'Medium priority', label: t('text.priority.medium') },
        { value: 'Low priority', label: t('text.priority.low') },
    ]

    const AddMoreMember = () => {
        return (
            <Tooltip title={t('text.actions.addMore')}>
                <Avatar className="cursor-pointer" shape="circle" size={30}>
                    <HiOutlinePlus />
                </Avatar>
            </Tooltip>
        )
    }

    const onFormSubmit = (values: {
        title: string
        priority: string
        members: string[]
        description: string
        dueDate: Date | null
    }) => {
        if (!board) {
            return
        }

        const fallbackTitle = t('text.labels.untitledCard', {
            defaultValue: 'Untitled Card',
        })
        dispatch(
            createTicket({
                columnId: board,
                name: values.title ? values.title : fallbackTitle,
                description: values.description,
                priority: values.priority,
                labels: values.priority ? [values.priority] : [],
                dueDate: values.dueDate
                    ? dayjs(values.dueDate).toISOString()
                    : null,
                memberIds: values.members,
            }),
        )
        dispatch(closeDialog())
        dispatch(setSelectedBoard(''))
    }

    return (
        <div>
            <h5>{t('text.titles.addNewTicket')}</h5>
            <div className="mt-8">
                <Formik
                    initialValues={{
                        title: '',
                        priority: 'Medium priority',
                        members: [] as string[],
                        description: '',
                        dueDate: new Date(),
                    }}
                    onSubmit={(vals) => onFormSubmit(vals)}
                >
                    {({ values, setFieldValue, errors, touched }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t('text.labels.ticketTitle', { defaultValue: 'Ticket title' })}
                                    invalid={errors.title && touched.title}
                                    errorMessage={errors.title}
                                >
                                    <Field
                                        type="text"
                                        name="title"
                                        placeholder={t('text.placeholders.ticketTitle', { defaultValue: 'Please enter ticket title' })}
                                        component={Input}
                                        validate={(value: string) =>
                                            requiredFieldValidation(
                                                value,
                                                t('text.validation.ticketTitleRequired', { defaultValue: 'Ticket title is required!' }),
                                            )
                                        }
                                    />
                                </FormItem>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormItem label={t('text.columns.priority')}>
                                        <Select
                                            options={priorityOptions}
                                            value={priorityOptions.find(
                                                (o) => o.value === values.priority,
                                            )}
                                            onChange={(opt) =>
                                                setFieldValue(
                                                    'priority',
                                                    (opt as any).value,
                                                )
                                            }
                                        />
                                    </FormItem>

                                    <div className="mt-1">
                                        <div className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
                                            {t('text.labels.assignees')}
                                        </div>
                                        <UsersAvatarGroup
                                            avatarProps={{
                                                className:
                                                    'mr-1 rtl:ml-1 cursor-pointer',
                                            }}
                                            avatarGroupProps={{ maxCount: 4 }}
                                            chained={false}
                                            users={boardMembers.filter((m) =>
                                                values.members.includes(m.id),
                                            )}
                                        />
                                        {boardMembers.length !==
                                            values.members.length && (
                                            <Dropdown renderTitle={<AddMoreMember />}>
                                                {boardMembers.map((member) =>
                                                    !values.members.includes(
                                                        member.id,
                                                    ) ? (
                                                        <Dropdown.Item
                                                            key={member.id}
                                                            eventKey={member.id}
                                                            onSelect={(id) =>
                                                                setFieldValue(
                                                                    'members',
                                                                    [
                                                                        ...values.members,
                                                                        id as string,
                                                                    ],
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center">
                                                                    <Avatar
                                                                        shape="circle"
                                                                        size={22}
                                                                        src={member.img}
                                                                    />
                                                                    <span className="ml-2 rtl:mr-2">
                                                                        {member.name}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </Dropdown.Item>
                                                    ) : null,
                                                )}
                                            </Dropdown>
                                        )}
                                    </div>
                                </div>

                                <FormItem label={t('text.titles.description')}>
                                    <Field
                                        as={Input}
                                        textArea
                                        rows={4}
                                        name="description"
                                        placeholder={t('text.labels.description')}
                                    />
                                </FormItem>

                                <FormItem label={t('text.labels.date')}>
                                    <DatePicker
                                        value={values.dueDate ?? undefined}
                                        onChange={(val) => setFieldValue('dueDate', val)}
                                    />
                                </FormItem>

                                <div className="text-right mt-4">
                                    <Button
                                        className="mr-2 rtl:ml-2"
                                        type="button"
                                        onClick={() => {
                                            dispatch(closeDialog())
                                            dispatch(setSelectedBoard(''))
                                        }}
                                    >
                                        {t('text.actions.cancel')}
                                    </Button>
                                    <Button variant="solid" type="submit">
                                        {t('text.actions.add')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    )
}

export default AddNewColumnContent
