import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import PasswordInput from '@/components/shared/PasswordInput'
import ActionLink from '@/components/shared/ActionLink'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import useAuth from '@/utils/hooks/useAuth'
import type { CommonProps } from '@/@types/common'
import { useTranslation } from 'react-i18next'

interface SignUpFormProps extends CommonProps {
    disableSubmit?: boolean
    signInUrl?: string
}

type SignUpFormSchema = {
    userName: string
    password: string
    email: string
}

const validationSchema = Yup.object().shape({
    userName: Yup.string().required('text.validation.userNameRequired'),
    email: Yup.string()
        .email('text.validation.invalidEmail')
        .required('text.validation.emailRequired'),
    password: Yup.string().required('text.validation.passwordRequired'),
    confirmPassword: Yup.string().oneOf(
        [Yup.ref('password')],
        'text.validation.passwordNotMatch',
    ),
})

const SignUpForm = (props: SignUpFormProps) => {
    const { disableSubmit = false, className, signInUrl = '/sign-in' } = props

    const { signUp } = useAuth()

    const [message, setMessage] = useTimeOutMessage()

    const { t } = useTranslation()

    const onSignUp = async (
        values: SignUpFormSchema,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        const { userName, password, email } = values
        setSubmitting(true)
        const result = await signUp({ userName, password, email })

        if (result?.status === 'failed') {
            setMessage(result.message)
        }

        setSubmitting(false)
    }

    return (
        <div className={className}>
            {message && (
                <Alert showIcon className="mb-4" type="danger">
                    {message}
                </Alert>
            )}
            <Formik
                initialValues={{
                    userName: 'admin1',
                    password: '123Qwe1',
                    confirmPassword: '123Qwe1',
                    email: 'test@testmail.com',
                }}
                validationSchema={validationSchema}
                onSubmit={(values, { setSubmitting }) => {
                    if (!disableSubmit) {
                        onSignUp(values, setSubmitting)
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
                                invalid={errors.userName && touched.userName}
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
                                label={t('text.labels.email')}
                                invalid={errors.email && touched.email}
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
                                invalid={errors.password && touched.password}
                                errorMessage={t(errors.password as string)}
                            >
                                <Field
                                    autoComplete="off"
                                    name="password"
                                    placeholder={t('text.labels.password')}
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
                                {isSubmitting
                                    ? t('auth.signUp.submitting')
                                    : t('auth.signUp.submit')}
                            </Button>
                            <div className="mt-4 text-center">
                                <span>{t('auth.signUp.hasAccount')} </span>
                                <ActionLink to={signInUrl}>
                                    {t('auth.common.signIn')}
                                </ActionLink>
                            </div>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </div>
    )
}

export default SignUpForm
