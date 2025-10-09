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
import { useCallback, useRef, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import appConfig from '@/configs/app.config'
import { useTranslation } from 'react-i18next'

interface SignInFormProps extends CommonProps {
    disableSubmit?: boolean
    forgotPasswordUrl?: string
    signUpUrl?: string
}

type SignInFormSchema = {
    userName: string
    password: string
    rememberMe: boolean
}

const validationSchema = Yup.object().shape({
    userName: Yup.string().required('text.validation.userNameRequired'),
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
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)

    const recaptchaRef = useRef<ReCAPTCHA | null>(null)

    const recaptchaSiteKey = appConfig.recaptchaSiteKey || ''

    const isRecaptchaEnabled = Boolean(recaptchaSiteKey)

    const { signIn } = useAuth()

    const { t } = useTranslation()

    const handleCaptchaChange = useCallback((token: string | null) => {
        setCaptchaToken(token)
        if (token) {
            setMessage('')
        }
    }, [setMessage])

    const handleCaptchaExpired = useCallback(() => {
        setCaptchaToken(null)
    }, [])

    const onSignIn = async (
        values: SignInFormSchema,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        const { userName, password } = values
        setSubmitting(true)

        if (isRecaptchaEnabled && !captchaToken) {
            setMessage('Por favor completa el reCAPTCHA antes de continuar.')
            setSubmitting(false)
            return
        }

        const result = await signIn({
            userName,
            password,
            ...(captchaToken ? { recaptchaToken: captchaToken } : {}),
        })

        if (result?.status === 'failed') {
            setMessage(result.message)
        }

        if (isRecaptchaEnabled) {
            recaptchaRef.current?.reset()
            setCaptchaToken(null)
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
                    userName: 'admin',
                    password: 'admin123',
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
                                label={t('text.labels.userName')}
                                invalid={
                                    (errors.userName &&
                                        touched.userName) as boolean
                                }
                                errorMessage={t(errors.userName as string)}
                            >
                                <Field
                                    type="text"
                                    autoComplete="off"
                                    name="userName"
                                    placeholder={t('text.labels.userName')}
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
                                <div className="mb-6">
                                    <ReCAPTCHA
                                        ref={recaptchaRef}
                                        sitekey={recaptchaSiteKey}
                                        onChange={handleCaptchaChange}
                                        onExpired={handleCaptchaExpired}
                                    />
                                </div>
                            ) : (
                                <Alert type="warning" showIcon className="mb-6">
                                    <div className="text-left">
                                        Configura la variable de entorno{' '}
                                        <code>VITE_RECAPTCHA_SITE_KEY</code>{' '}
                                        con la clave de sitio de Google reCAPTCHA para
                                        habilitar la validación.
                                    </div>
                                </Alert>
                            )}
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
                                disabled={
                                    isSubmitting ||
                                    (isRecaptchaEnabled && !captchaToken)
                                }
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
