import Segment from '@/components/ui/Segment'
import Button from '@/components/ui/Button'
import { FormContainer } from '@/components/ui/Form'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import FormDesription from './FormDesription'
import FormRow from './FormRow'
import { Field, Form, Formik } from 'formik'
import isLastChild from '@/utils/isLastChild'
import { HiMail, HiGlobeAlt, HiOutlineDeviceMobile } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import type {
    FieldProps,
    FormikTouched,
    FormikErrors,
    FieldInputProps,
    FormikProps,
} from 'formik'

type NotificationFormModel = {
    news: string[]
    accountActivity: string[]
    signIn: string[]
    reminders: string[]
    mentioned: string[]
    replies: string[]
    taskUpdate: string[]
    assigned: string[]
    newProduct: string[]
    newOrder: string[]
}

type NotificationSettingProps = {
    data?: NotificationFormModel
}

type RowsProps = {
    rows: {
        labelKey: string
        name: string
    }[]
    validators: {
        touched: FormikTouched<NotificationFormModel>
        errors: FormikErrors<NotificationFormModel>
    }
    values: NotificationFormModel
}

type SelectorProps = {
    field: FieldInputProps<NotificationFormModel>
    form: FormikProps<NotificationFormModel>
    values: NotificationFormModel
    name: string
}

const generalNotificationForm = [
    { labelKey: 'account.settings.notification.general.news', name: 'news' },
    {
        labelKey: 'account.settings.notification.general.accountActivity',
        name: 'accountActivity',
    },
    {
        labelKey: 'account.settings.notification.general.signIn',
        name: 'signIn',
    },
    { labelKey: 'account.settings.notification.general.reminders', name: 'reminders' },
]

const projectNotificationForm = [
    { labelKey: 'account.settings.notification.project.mentioned', name: 'mentioned' },
    { labelKey: 'account.settings.notification.project.replies', name: 'replies' },
    { labelKey: 'account.settings.notification.project.taskUpdate', name: 'taskUpdate' },
    { labelKey: 'account.settings.notification.project.assigned', name: 'assigned' },
]

const salesNotificationForm = [
    { labelKey: 'account.settings.notification.sales.newProduct', name: 'newProduct' },
    { labelKey: 'account.settings.notification.sales.newOrder', name: 'newOrder' },
]

const Selector = ({ field, form, values, name }: SelectorProps) => {
    const { t } = useTranslation()
    return (
        <Segment
            value={values[name as keyof NotificationFormModel]}
            selectionType="multiple"
            onChange={(selected) => form.setFieldValue(field.name, selected)}
        >
            <Segment.Item
                className="flex items-center justify-center"
                type="button"
                value="email"
            >
                <HiMail className="text-xl" />
                <span className="hidden sm:block ltr:ml-2 rtl:mr-2">{t('account.settings.notification.channels.email')}</span>
            </Segment.Item>
            <Segment.Item
                className="flex items-center justify-center"
                type="button"
                value="browser"
            >
                <HiGlobeAlt className="text-xl" />
                <span className="hidden sm:block  ltr:ml-2 rtl:mr-2">{t('account.settings.notification.channels.browser')}</span>
            </Segment.Item>
            <Segment.Item
                className="flex items-center justify-center"
                type="button"
                value="app"
            >
                <HiOutlineDeviceMobile className="text-xl" />
                <span className="hidden sm:block  ltr:ml-2 rtl:mr-2">{t('account.settings.notification.channels.app')}</span>
            </Segment.Item>
        </Segment>
    )
}

const Rows = ({ rows, validators, values }: RowsProps) => {
    const { t } = useTranslation()
    return (
        <>
            {rows.map((row, index) => (
                <FormRow
                    key={row.name}
                    name={row.name as keyof NotificationFormModel}
                    label={t(row.labelKey as string)}
                    {...validators}
                    border={!isLastChild(rows, index)}
                >
                    <Field name={row.name}>
                        {({
                            field,
                            form,
                        }: FieldProps<NotificationFormModel>) => (
                            <Selector
                                field={field}
                                form={form}
                                values={values}
                                name={row.name}
                            />
                        )}
                    </Field>
                </FormRow>
            ))}
        </>
    )
}

const NotificationSetting = ({
    data = {
        news: [],
        accountActivity: [],
        signIn: [],
        reminders: [],
        mentioned: [],
        replies: [],
        taskUpdate: [],
        assigned: [],
        newProduct: [],
        newOrder: [],
    },
}: NotificationSettingProps) => {
    const { t } = useTranslation()

    const onFormSubmit = (
        values: NotificationFormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        toast.push(
            <Notification
                title={t('account.settings.notification.updated')}
                type="success"
            />,
            {
                placement: 'top-center',
            },
        )
        setSubmitting(false)
        console.log(values)
    }

    return (
        <Formik
            enableReinitialize
            initialValues={data}
            onSubmit={(values, { setSubmitting }) => {
                setSubmitting(true)
                setTimeout(() => {
                    onFormSubmit(values, setSubmitting)
                }, 1000)
            }}
        >
            {({ values, touched, errors, isSubmitting, resetForm }) => {
                const validatorProps = { touched, errors }
                return (
                    <Form>
                        <FormContainer>
                            <FormDesription
                                title={t('account.settings.notification.general.title')}
                                desc={t('account.settings.notification.general.desc')}
                            />
                            <Rows
                                rows={generalNotificationForm}
                                validators={validatorProps}
                                values={values}
                            />
                            <FormDesription
                                className="mt-6"
                                title={t('account.settings.notification.project.title')}
                                desc={t('account.settings.notification.project.desc')}
                            />
                            <Rows
                                rows={projectNotificationForm}
                                validators={validatorProps}
                                values={values}
                            />
                            <FormDesription
                                className="mt-6"
                                title={t('account.settings.notification.sales.title')}
                                desc={t('account.settings.notification.sales.desc')}
                            />
                            <Rows
                                rows={salesNotificationForm}
                                validators={validatorProps}
                                values={values}
                            />
                            <div className="mt-4 ltr:text-right">
                                <Button
                                    className="ltr:mr-2 rtl:ml-2"
                                    type="button"
                                    onClick={() => resetForm()}
                                >{t('text.actions.reset')}</Button>
                                <Button
                                    variant="solid"
                                    loading={isSubmitting}
                                    type="submit"
                                >
                                    {isSubmitting
                                        ? t('text.actions.updating')
                                        : t('text.actions.update')}
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default NotificationSetting
