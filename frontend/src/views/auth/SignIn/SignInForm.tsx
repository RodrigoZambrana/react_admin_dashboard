import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Alert from '@/components/ui/Alert'
import PasswordInput from '@/components/shared/PasswordInput'
import ActionLink from '@/components/shared/ActionLink'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import useAuth from '@/utils/hooks/useAuth'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import type { CommonProps } from '@/@types/common'
import appConfig from '@/configs/app.config'
import { useTranslation } from 'react-i18next'
import { executeRecaptchaAction, preloadRecaptcha } from '@/utils/security/recaptcha'
import { useEffect } from 'react'

interface SignInFormProps extends CommonProps {
    disableSubmit?: boolean
    forgotPasswordUrl?: string
    signUpUrl?: string
}

type SignInFormSchema = {
    email: string
    password: string
    rememberMe: boolean
}

const validationSchema = Yup.object().shape({
    email: Yup.string()
        .email('text.validation.invalidEmail')
        .required('text.validation.emailRequired'),
    password: Yup.string().required('text.validation.passwordRequired'),
    rememberMe: Yup.bool(),
})

const SignInForm = (props: SignInFormProps) => {
    const {
        disableSubmit = false,
        className,
        forgotPasswordUrl = '/forgot-password',
        signUpUrl = '/sign-up',
    } = props

    // Flags keep navigation logic available without rendering the UI copy yet
    const showForgotPasswordLink = false
    const showSignUpPrompt = false

    const [message, setMessage] = useTimeOutMessage()

    const recaptchaSiteKey = appConfig.recaptchaSiteKey || ''

    const isRecaptchaEnabled = Boolean(recaptchaSiteKey)

    const { signIn } = useAuth()

    const { t } = useTranslation()

    useEffect(() => {
        if (!isRecaptchaEnabled) {
            return
        }

        let isCancelled = false

        preloadRecaptcha(recaptchaSiteKey).catch(() => {
            if (!isCancelled) {
                setMessage('Unable to initialize reCAPTCHA. Please refresh the page.')
            }
        })

        return () => {
            isCancelled = true
        }
    }, [isRecaptchaEnabled, recaptchaSiteKey, setMessage])

    const onSignIn = async (
        values: SignInFormSchema,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        const { email, password } = values
        setSubmitting(true)

        let generatedToken: string | undefined

        if (isRecaptchaEnabled) {
            try {
                generatedToken = await executeRecaptchaAction(
                    recaptchaSiteKey,
                    'LOGIN',
                )
                setMessage('')
            } catch (error) {
                setMessage('Unable to complete reCAPTCHA. Please try again.')
                setSubmitting(false)
                return
            }
        }

        const result = await signIn({
            email,
            password,
            ...(generatedToken ? { recaptchaToken: generatedToken } : {}),
        })

        if (result?.status === 'failed') {
            setMessage(result.message)
        }

        setSubmitting(false)
    }

    return (
        <div className={className}>
            {message && (
                <Alert showIcon className="mb-4" type="danger">
                    <>{message}</>
                </Alert>
            )}
            <Formik
                initialValues={{
                    email: 'admin@example.com',
                    password: 'Admin@123!',
                    rememberMe: true,
                }}
                validationSchema={validationSchema}
                onSubmit={(values, { setSubmitting }) => {
                    if (!disableSubmit) {
                        onSignIn(values, setSubmitting)
                    } else {
                        setSubmitting(false)
                    }
                }}
            >
                {({ touched, errors, isSubmitting }) => (
                    <Form>
                        <FormContainer>
                            <FormItem
                                label={t('text.labels.email')}
                                invalid={
                                    (errors.email && touched.email) as boolean
                                }
                                errorMessage={t(errors.email as string)}
                            >
                                <Field
                                    type="email"
                                    autoComplete="off"
                                    name="email"
                                    placeholder={t('text.labels.email')}
                                    component={Input}
                                />
                            </FormItem>
                            <FormItem
                                label={t('text.labels.password')}
                                invalid={
                                    (errors.password &&
                                        touched.password) as boolean
                                }
                                errorMessage={t(errors.password as string)}
                            >
                                <Field
                                    autoComplete="off"
                                    name="password"
                                    placeholder={t('text.labels.password')}
                                    component={PasswordInput}
                                />
                            </FormItem>
                            {isRecaptchaEnabled ? (
                                <Alert type="info" showIcon className="mb-6">
                                    <div className="text-left">
                                        {t('auth.signIn.recaptchaMessage', {
                                            defaultValue:
                                                'reCAPTCHA Enterprise protects this action.',
                                        })}
                                    </div>
                                </Alert>
                            ) : null}
                            <div className="flex justify-between mb-6">
                                <Field
                                    className="mb-0"
                                    name="rememberMe"
                                    component={Checkbox}
                                >
                                    {t('auth.signIn.rememberMe')}
                                </Field>
                                {showForgotPasswordLink && (
                                    <ActionLink to={forgotPasswordUrl}>
                                        {t('auth.signIn.forgotPassword')}
                                    </ActionLink>
                                )}
                            </div>
                            <Button
                                block
                                loading={isSubmitting}
                                variant="solid"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? t('auth.signIn.submitting')
                                    : t('auth.signIn.submit')}
                            </Button>
                            {showSignUpPrompt && (
                                <div className="mt-4 text-center">
                                    <span>{t('auth.signIn.noAccount')} </span>
                                    <ActionLink to={signUpUrl}>
                                        {t('auth.common.signUp')}
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

export default SignInForm
