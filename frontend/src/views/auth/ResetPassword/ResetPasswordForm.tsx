import { useState } from 'react'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import PasswordInput from '@/components/shared/PasswordInput'
import ActionLink from '@/components/shared/ActionLink'
import { apiResetPassword } from '@/services/AuthService'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import { useNavigate } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import type { CommonProps } from '@/@types/common'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { PASSWORD_COMPLEXITY_REGEX } from '@/constants/security.constant'

interface ResetPasswordFormProps extends CommonProps {
    disableSubmit?: boolean
    signInUrl?: string
    showBackLink?: boolean
}

type ResetPasswordFormSchema = {
    password: string
    confirmPassword: string
}

const validationSchema = Yup.object().shape({
    password: Yup.string()
        .required('text.validation.passwordRequired')
        .matches(PASSWORD_COMPLEXITY_REGEX, 'text.validation.passwordComplexity'),
    confirmPassword: Yup.string().oneOf(
        [Yup.ref('password')],
        'text.validation.passwordNotMatch',
    ),
})

const ResetPasswordForm = (props: ResetPasswordFormProps) => {
    const {
        disableSubmit = false,
        className,
        signInUrl = '/sign-in',
        showBackLink = true,
    } = props

    const { t } = useTranslation()

    const [resetComplete, setResetComplete] = useState(false)

    const [message, setMessage] = useTimeOutMessage()

    const navigate = useNavigate()

    const onSubmit = async (
        values: ResetPasswordFormSchema,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        const { password } = values
        setSubmitting(true)
        try {
            const resp = await apiResetPassword({ password })
            if (resp.data) {
                setSubmitting(false)
                setResetComplete(true)
            }
        } catch (errors) {
            setMessage(
                (errors as AxiosError<{ message: string }>)?.response?.data
                    ?.message || (errors as Error).toString(),
            )
            setSubmitting(false)
        }
    }

    const onContinue = () => {
        navigate('/sign-in')
    }

    return (
        <div className={className}>
            <div className="mb-6">
                {resetComplete ? (
                    <>
                        <h3 className="mb-1">{t('auth.resetPassword.success.title')}</h3>
                        <p>{t('auth.resetPassword.success.subtitle')}</p>
                    </>
                ) : (
                    <>
                        <h3 className="mb-1">{t('auth.resetPassword.setNewPassword.title')}</h3>
                        <p>{t('auth.resetPassword.setNewPassword.subtitle')}</p>
                    </>
                )}
            </div>
            {message && (
                <Alert showIcon className="mb-4" type="danger">
                    {message}
                </Alert>
            )}
            <Formik
                initialValues={{
                    password: 'Strong@123',
                    confirmPassword: 'Strong@123',
                }}
                validationSchema={validationSchema}
                onSubmit={(values, { setSubmitting }) => {
                    if (!disableSubmit) {
                        onSubmit(values, setSubmitting)
                    } else {
                        setSubmitting(false)
                    }
                }}
            >
                {({ touched, errors, isSubmitting }) => (
                    <Form>
                        <FormContainer>
                            {!resetComplete ? (
                                <>
                                    <FormItem
                                        label={t('text.labels.password')}
                                        invalid={
                                            errors.password && touched.password
                                        }
                                        errorMessage={t(errors.password as string)}
                                    >
                                        <Field
                                            autoComplete="off"
                                            name="password"
                                            placeholder={t('text.placeholders.newPassword')}
                                            component={PasswordInput}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('text.placeholders.confirmPassword')}
                                        invalid={
                                            errors.confirmPassword &&
                                            touched.confirmPassword
                                        }
                                        errorMessage={t(
                                            errors.confirmPassword as string,
                                        )}
                                    >
                                        <Field
                                            autoComplete="off"
                                            name="confirmPassword"
                                            placeholder={t(
                                                'text.placeholders.confirmPassword',
                                            )}
                                            component={PasswordInput}
                                        />
                                    </FormItem>
                                    <Button
                                        block
                                        loading={isSubmitting}
                                        variant="solid"
                                        type="submit"
                                    >
                                        {t('text.actions.submit')}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    block
                                    variant="solid"
                                    type="button"
                                    onClick={onContinue}
                                >
                                    {t('auth.resetPassword.continue')}
                                </Button>
                            )}

                            {showBackLink && (
                                <div className="mt-4 text-center">
                                    <span>{t('auth.common.backToSignIn')}</span>
                                    <ActionLink to={signInUrl}>
                                        {t('auth.common.signIn')}
                                    </ActionLink>
                                </div>
                            )}
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </div>
    )
}

export default ResetPasswordForm
