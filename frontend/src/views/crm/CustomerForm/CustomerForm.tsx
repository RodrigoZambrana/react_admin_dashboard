import { forwardRef } from 'react'
import Tabs from '@/components/ui/Tabs'
import { FormContainer } from '@/components/ui/Form'
import { Form, Formik, FormikProps } from 'formik'
import { useTranslation } from 'react-i18next'
import * as Yup from 'yup'
import PersonalInfoForm from './PersonalInfoForm'
import SocialLinkForm from './SocialLinkForm'

type BaseCustomerInfo = {
    firstName: string
    lastName: string
    email: string
    img: string
}

type CustomerPersonalInfo = {
    location: string
    phoneNumber: string
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

export type Customer = BaseCustomerInfo & CustomerPersonalInfo

export type FormModel = Customer

export type FormikRef = FormikProps<FormModel>

export type CustomerProps =
    Partial<
        BaseCustomerInfo & {
            personalInfo: CustomerPersonalInfo
        }
    > & { name?: string; phoneNumber?: string }

type CustomerFormProps = {
    customer: CustomerProps
    onFormSubmit: (values: FormModel) => void
}

const useValidationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        email: Yup.string().email(t('text.validation.invalidEmail')).required(t('text.validation.emailRequired')),
        firstName: Yup.string().required(t('text.validation.userNameRequired')),
        lastName: Yup.string().required(t('text.validation.userNameRequired')),
        location: Yup.string(),
        phoneNumber: Yup.string().matches(
            /^((\+[1-9]{1,4}[ -]?)|(\([0-9]{2,3}\)[ -]?)|([0-9]{2,4})[ -]?)*?[0-9]{3,4}[ -]?[0-9]{3,4}$/,
            t('text.validation.invalidPhoneNumber'),
        ),
        facebook: Yup.string(),
        twitter: Yup.string(),
        pinterest: Yup.string(),
        linkedIn: Yup.string(),
        img: Yup.string(),
    })

const { TabNav, TabList, TabContent } = Tabs

const CustomerForm = forwardRef<FormikRef, CustomerFormProps>((props, ref) => {
    const { customer, onFormSubmit } = props
    const { t } = useTranslation()

    const fullName = (customer.name || '').trim()
    const [defaultFirstName, ...restName] = fullName
        ? fullName.split(/\s+/)
        : ['']
    const defaultLastName = restName.join(' ')

    return (
        <Formik<FormModel>
            innerRef={ref}
            initialValues={{
                firstName: customer.firstName || defaultFirstName || '',
                lastName: customer.lastName || defaultLastName || '',
                email: customer.email || '',
                img: customer.img || '',
                location: customer?.personalInfo?.location || '',
                phoneNumber:
                    customer.phoneNumber ||
                    customer?.personalInfo?.phoneNumber ||
                    '',
                facebook: customer?.personalInfo?.facebook || '',
                twitter: customer?.personalInfo?.twitter || '',
                pinterest: customer?.personalInfo?.pinterest || '',
                linkedIn: customer?.personalInfo?.linkedIn || '',
            }}
            validationSchema={useValidationSchema(t)}
            onSubmit={(values, { setSubmitting }) => {
                onFormSubmit?.(values)
                setSubmitting(false)
            }}
        >
            {({ touched, errors }) => (
                <Form>
                    <FormContainer>
                        <Tabs defaultValue="personalInfo">
                            <TabList>
                                <TabNav value="personalInfo">
                                    {t('text.tabs.personalInfo')}
                                </TabNav>
                                <TabNav value="social">{t('text.tabs.social')}</TabNav>
                            </TabList>
                            <div className="p-6">
                                <TabContent value="personalInfo">
                                    <PersonalInfoForm
                                        touched={touched as any}
                                        errors={errors as any}
                                    />
                                </TabContent>
                                <TabContent value="social">
                                    <SocialLinkForm
                                        touched={touched}
                                        errors={errors}
                                    />
                                </TabContent>
                            </div>
                        </Tabs>
                    </FormContainer>
                </Form>
            )}
        </Formik>
    )
})

CustomerForm.displayName = 'CustomerForm'

export default CustomerForm
