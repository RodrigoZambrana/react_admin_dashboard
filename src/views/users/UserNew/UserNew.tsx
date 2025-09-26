import { Field, Form, Formik } from 'formik'
import { useState } from 'react'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { apiCreateUser } from '@/services/UsersService'
import { useNavigate } from 'react-router-dom'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'

const schema = Yup.object().shape({
    name: Yup.string().required('text.validation.userNameRequired'),
    email: Yup.string().email('text.validation.invalidEmail').required('text.validation.emailRequired'),
    img: Yup.string().url().nullable(),
})

const UserNew = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [submitting, setSubmitting] = useState(false)

    const onSubmit = async (values: { name: string; email: string; img?: string }) => {
        setSubmitting(true)
        await apiCreateUser(values)
        setSubmitting(false)
        toast.push(<Notification title={t('text.messages.userCreated')} type="success" />, {
            placement: 'top-center',
        })
        navigate('/app/users/list')
    }

    return (
        <Container>
            <Card>
                <h3 className="mb-4">{t('nav.appsUsers.userNew')}</h3>
                <Formik
                    initialValues={{ name: '', email: '', img: '' }}
                    validationSchema={schema}
                    onSubmit={onSubmit}
                >
                    {({ errors, touched }) => (
                        <Form>
                            <FormContainer>
                                <FormItem label={t('text.labels.name')} invalid={!!errors.name && !!touched.name} errorMessage={t(errors.name as string)}>
                                    <Field name="name" component={Input} placeholder={t('text.labels.name')} />
                                </FormItem>
                                <FormItem label={t('text.labels.email')} invalid={!!errors.email && !!touched.email} errorMessage={t(errors.email as string)}>
                                    <Field name="email" component={Input} placeholder={t('text.labels.email')} />
                                </FormItem>
                                <FormItem label="Avatar URL" invalid={!!errors.img && !!touched.img} errorMessage={errors.img as string}>
                                    <Field name="img" component={Input} placeholder="https://..." />
                                </FormItem>
                                <Button variant="solid" type="submit" loading={submitting}>
                                    {t('text.actions.submit')}
                                </Button>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </Card>
        </Container>
    )
}

export default UserNew
