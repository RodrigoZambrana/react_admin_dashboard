import classNames from 'classnames'
import Button from '@/components/ui/Button'
import Tag from '@/components/ui/Tag'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { FormContainer } from '@/components/ui/Form'
import FormDesription from './FormDesription'
import FormRow from './FormRow'
import { Field, Form, Formik } from 'formik'
import isLastChild from '@/utils/isLastChild'
import {
    HiOutlineDesktopComputer,
    HiOutlineDeviceMobile,
    HiOutlineDeviceTablet,
} from 'react-icons/hi'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import * as Yup from 'yup'
import { apiUpdateAccountPassword } from '@/services/AccountServices'
import PasswordInput from '@/components/shared/PasswordInput'
import { PASSWORD_COMPLEXITY_REGEX } from '@/constants/security.constant'

type LoginHistory = {
    type: string
    deviceName: string
    time: number
    location: string
}

type PasswordFormModel = {
    password: string
    newPassword: string
    confirmNewPassword: string
}

const LoginHistoryIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'Desktop':
            return <HiOutlineDesktopComputer />
        case 'Mobile':
            return <HiOutlineDeviceMobile />
        case 'Tablet':
            return <HiOutlineDeviceTablet />
        default:
            return <HiOutlineDesktopComputer />
    }
}

const useValidationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        password: Yup.string().required(t('text.validation.passwordRequired')),
        newPassword: Yup.string()
            .required(t('text.validation.enterNewPassword'))
            .matches(
                PASSWORD_COMPLEXITY_REGEX,
                t('text.validation.passwordComplexity'),
            ),
        confirmNewPassword: Yup.string().oneOf(
            [Yup.ref('newPassword'), ''],
            t('text.validation.passwordNotMatch'),
        ),
    })

const Password = ({ data }: { data?: LoginHistory[] }) => {
    const { t } = useTranslation()

    const getErrorMessage = (error: unknown) => {
        const responseMessage =
            (error as {
                response?: { data?: { message?: string; errors?: Array<{ message?: string }> } }
            })?.response?.data?.message
        if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
            return t(responseMessage, {
                defaultValue: responseMessage,
            })
        }
        const responseErrors =
            (error as {
                response?: { data?: { errors?: Array<{ message?: string }> } }
            })?.response?.data?.errors
        if (Array.isArray(responseErrors) && responseErrors.length > 0) {
            const first = responseErrors[0]?.message
            if (typeof first === 'string' && first.trim().length > 0) {
                return t(first, { defaultValue: first })
            }
        }
        return t('text.errors.passwordUpdateFailed', {
            defaultValue: 'Unable to update password. Please try again.',
        })
    }

    return (
        <>
            <Formik
                initialValues={{
                    password: '',
                    newPassword: '',
                    confirmNewPassword: '',
                }}
                validationSchema={useValidationSchema(t)}
                onSubmit={async (values, { setSubmitting, resetForm }) => {
                    setSubmitting(true)
                    try {
                        await apiUpdateAccountPassword({
                            password: values.password,
                            newPassword: values.newPassword,
                        })
                        toast.push(
                            <Notification
                                title={t('text.messages.passwordUpdated')}
                                type="success"
                            />,
                            { placement: 'top-center' },
                        )
                        resetForm()
                    } catch (error) {
                        toast.push(
                            <Notification
                                title={t('text.errors.passwordUpdateFailedTitle', {
                                    defaultValue: 'Password update failed',
                                })}
                                type="danger"
                            >
                                {getErrorMessage(error)}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                    } finally {
                        setSubmitting(false)
                    }
                }}
            >
                {({ touched, errors, isSubmitting, resetForm }) => {
                    const validatorProps = { touched, errors }
                    return (
                        <Form>
                            <FormContainer>
                                <FormDesription
                                    title={t('text.titles.password')}
                                    desc={t('text.descriptions.passwordDesc')}
                                />
                                <FormRow
                                    name="password"
                                    label={t('text.labels.currentPassword')}
                                    {...validatorProps}
                                >
                                    <Field
                                        autoComplete="off"
                                        name="password"
                                        placeholder={t('text.placeholders.currentPassword')}
                                        component={PasswordInput}
                                    />
                                </FormRow>
                                <FormRow
                                    name="newPassword"
                                    label={t('text.labels.newPassword')}
                                    {...validatorProps}
                                >
                                    <Field
                                        autoComplete="off"
                                        name="newPassword"
                                        placeholder={t('text.placeholders.newPassword')}
                                        component={PasswordInput}
                                    />
                                </FormRow>
                                <FormRow
                                    name="confirmNewPassword"
                                    label={t('text.labels.confirmPassword')}
                                    {...validatorProps}
                                >
                                    <Field
                                        autoComplete="off"
                                        name="confirmNewPassword"
                                        placeholder={t('text.placeholders.confirmPassword')}
                                        component={PasswordInput}
                                    />
                                </FormRow>
                                <div className="mt-4 ltr:text-right">
                                    <Button
                                        className="ltr:mr-2 rtl:ml-2"
                                        type="button"
                                        onClick={() => resetForm()}
                                    >
                                        {t('text.actions.reset')}
                                    </Button>
                                    <Button
                                        variant="solid"
                                        loading={isSubmitting}
                                        type="submit"
                                    >
                                        {isSubmitting
                                            ? t('text.actions.updating')
                                            : t('text.actions.updatePassword')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
            <div className="mt-6">
                <FormDesription
                    title={t('text.titles.whereSignedIn')}
                    desc={t('text.descriptions.signedInDevices')}
                />
                {data && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 mt-6">
                        {data.map((log, index) => (
                            <div
                                key={log.deviceName}
                                className={classNames(
                                    'flex items-center px-4 py-6',
                                    !isLastChild(data, index) &&
                                        'border-b border-gray-200 dark:border-gray-600',
                                )}
                            >
                                <div className="flex items-center">
                                    <div className="text-3xl">
                                        <LoginHistoryIcon type={log.type} />
                                    </div>
                                    <div className="ml-3 rtl:mr-3">
                                        <div className="flex items-center">
                                            <div className="text-gray-900 dark:text-gray-100 font-semibold">
                                                {log.deviceName}
                                            </div>
                                            {index === 0 && (
                                                <Tag className="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100 rounded-md border-0 mx-2">
                                                    <span className="capitalize">
                                                        {t('text.labels.current')}
                                                    </span>
                                                </Tag>
                                            )}
                                        </div>
                                        <span>
                                            {log.location} •{' '}
                                            {dayjs
                                                .unix(log.time)
                                                .format('DD-MMM-YYYY, hh:mm A')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

export default Password
