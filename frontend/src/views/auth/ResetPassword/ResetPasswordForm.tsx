import { useMemo, useState } from 'react'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import PasswordInput from '@/components/shared/PasswordInput'
import ActionLink from '@/components/shared/ActionLink'
import { apiResetPassword } from '@/services/AuthService'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import { useNavigate } from 'react-router-dom'
import useQuery from '@/utils/hooks/useQuery'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import type { CommonProps } from '@/@types/common'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { PASSWORD_COMPLEXITY_REGEX } from '@/constants/security.constant'
import { appPath } from '@/constants/route.constant'

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
        signInUrl = appPath('sign-in'),
        showBackLink = true,
    } = props

    const { t } = useTranslation()

    const [resetComplete, setResetComplete] = useState(false)

    const [message, setMessage] = useTimeOutMessage()

    const navigate = useNavigate()
    const query = useQuery()
    const token = query.get('token')?.trim() || ''
    const isTokenReset = token.length > 0

    const heading = useMemo(() => {
        if (resetComplete) {
            return {
                title: t('auth.resetPassword.success.title'),
                subtitle: t('auth.resetPassword.success.subtitle'),
            }
        }
        if (isTokenReset) {
            return {
                title: t('auth.resetPassword.setNewPassword.title'),
                subtitle: t('auth.resetPassword.setNewPassword.subtitle'),
            }
        }
        return {
            title: t('auth.resetPassword.changePassword.title', {
                defaultValue: 'Cambiá tu contraseña',
            }),
            subtitle: t('auth.resetPassword.changePassword.subtitle', {
                defaultValue:
                    'Definí una nueva contraseña para reemplazar la credencial inicial de acceso.',
            }),
        }
    }, [isTokenReset, resetComplete, t])

    const onSubmit = async (
        values: ResetPasswordFormSchema,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        const { password } = values
        setSubmitting(true)
        try {
            const resp = await apiResetPassword(
                token ? { password, token } : { password },
            )
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
        navigate(appPath('sign-in'))
    }

    return (
        <div className={className}>
            <div className="mb-6">
                {resetComplete ? (
                    <>
                        <h3 className="mb-1">{heading.title}</h3>
                        <p>{heading.subtitle}</p>
                    </>
                ) : (
                    <>
                        <h3 className="mb-1">{heading.title}</h3>
                        <p>{heading.subtitle}</p>
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
                    password: '',
                    confirmPassword: '',
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
