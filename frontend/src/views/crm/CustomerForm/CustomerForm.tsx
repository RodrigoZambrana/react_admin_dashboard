import { forwardRef, useEffect, useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import { FormContainer } from '@/components/ui/Form'
import { Form, Formik, FormikProps, FormikErrors } from 'formik'
import { useTranslation } from 'react-i18next'
import * as Yup from 'yup'
import PersonalInfoForm from './PersonalInfoForm'
import AddressForm from './AddressForm'

type BaseCustomerInfo = {
    firstName: string
    lastName: string
    email: string
    img: string
}

type CustomerPersonalInfo = {
    location: string
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

export type CustomerAddress = {
    street: string
    number: string
    corner: string
    apartment: string
    city: string
    state: string
    countryCode: string
    comments: string
}

export const ADDRESS_REQUIRED_FIELDS: (keyof CustomerAddress)[] = [
    'street',
    'number',
    'city',
    'state',
]

export type Customer = BaseCustomerInfo & CustomerPersonalInfo & {
    address: CustomerAddress
    phoneNumbers: string[]
    phoneNumber?: string
}

export type FormModel = Customer

export type FormikRef = FormikProps<FormModel>

export type CustomerProps =
    Partial<
        BaseCustomerInfo & {
            personalInfo: CustomerPersonalInfo
            address?: Partial<CustomerAddress>
            addresses?: Array<Partial<CustomerAddress & { isPrimary?: boolean }>>
            phoneNumbers?: string[]
            phoneNumber?: string
        }
    > & { name?: string; phoneNumber?: string }

type CustomerFormProps = {
    customer: CustomerProps
    onFormSubmit: (values: FormModel) => Promise<void> | void
    activeTab?: 'personalInfo' | 'address'
    onTabChange?: (tab: 'personalInfo' | 'address') => void
    onValuesChange?: (values: FormModel) => void
    onValidationStateChange?: (state: {
        isValid: boolean
        isSubmitting: boolean
        errors: FormikErrors<FormModel>
    }) => void
}

// ─────────────────────────────────────────────────────────────
// Validación: countryCode deja de ser requerido
// ─────────────────────────────────────────────────────────────
const addressSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        street: Yup.string().required(t('text.validation.enterAddress')),
        number: Yup.string().required(t('text.validation.enterAddress')),
        city: Yup.string().required(t('text.validation.enterCity')),
        state: Yup.string().required(t('text.validation.enterState')),
        // ⬇️ Ya no requerido; acepta '' y lo transforma a null
        countryCode: Yup.string()
            .transform((v) => (v === '' ? null : v))
            .nullable()
            .notRequired(),
        corner: Yup.string().nullable(),
        apartment: Yup.string().nullable(),
        comments: Yup.string().nullable(),
    })

// ─────────────────────────────────────────────────────────────
// Validación: phoneNumbers NO bloquea el submit por strings vacíos
//  - '' -> null (transform)
//  - se permiten vacíos (notRequired)
//  - se eliminan nulls del array (compact)
//  - min(0) para no exigir uno si no se provee
// ─────────────────────────────────────────────────────────────
const useValidationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        email: Yup.string().email(t('text.validation.invalidEmail')).required(t('text.validation.emailRequired')),
        firstName: Yup.string().required(t('text.validation.userNameRequired')),
        lastName: Yup.string().required(t('text.validation.userNameRequired')),
        location: Yup.string(),
        phoneNumbers: Yup.array()
            .of(
                Yup.string()
                    .transform((v) => {
                        const trimmed = v?.trim?.() ?? ''
                        return trimmed === '' ? null : trimmed
                    })
                    .nullable()
                    .notRequired()
                    .test('valid-phone', t('text.validation.invalidPhoneNumber'), (value) => {
                        if (!value) {
                            return true
                        }
                        return /^(\+?[0-9\s-()]{7,})$/.test(String(value).trim())
                    })
            )
            .compact((v) => v == null)
            .min(0),
        facebook: Yup.string(),
        twitter: Yup.string(),
        pinterest: Yup.string(),
        linkedIn: Yup.string(),
        img: Yup.string(),
        address: addressSchema(t),
    })

const { TabNav, TabList, TabContent } = Tabs

type CustomerFormInnerProps = FormikProps<FormModel> & {
  onValuesChange?: (values: FormModel) => void
  onValidationStateChange?: (state: {
    isValid: boolean
    isSubmitting: boolean
    errors: FormikErrors<FormModel>
  }) => void
  currentTab: 'personalInfo' | 'address'
  onTabChangeLocal: (value: string) => void
  t: ReturnType<typeof useTranslation>['t']
}

const CustomerFormInner = ({
  values,
  errors,
  isValid,
  isSubmitting,
  onValuesChange,
  onValidationStateChange,
  currentTab,
  onTabChangeLocal,
  t,
}: CustomerFormInnerProps) => {
  useEffect(() => {
    onValuesChange?.(values)
  }, [onValuesChange, values])

  useEffect(() => {
    onValidationStateChange?.({
      isValid,
      isSubmitting,
      errors,
    })
  }, [errors, isSubmitting, isValid, onValidationStateChange])

  return (
    <Form>
      <FormContainer>
        <Tabs value={currentTab} onChange={onTabChangeLocal}>
          <TabList>
            <TabNav value="personalInfo">{t('text.tabs.personalInfo')}</TabNav>
            <TabNav value="address">{t('text.tabs.address')}</TabNav>
          </TabList>
          <div className="p-6">
            <TabContent value="personalInfo">
              <PersonalInfoForm />
            </TabContent>
            <TabContent value="address">
              <AddressForm />
            </TabContent>
          </div>
        </Tabs>
      </FormContainer>
    </Form>
  )
}

const CustomerForm = forwardRef<FormikRef, CustomerFormProps>((props, ref) => {
    const {
        customer,
        onFormSubmit,
        activeTab,
        onTabChange,
        onValuesChange,
        onValidationStateChange,
    } = props
    const { t } = useTranslation()

    const fullName = (customer.name || '').trim()
    const [defaultFirstName, ...restName] = fullName
        ? fullName.split(/\s+/)
        : ['']
    const defaultLastName = restName.join(' ')

    const [internalTab, setInternalTab] = useState<'personalInfo' | 'address'>(
        activeTab ?? 'personalInfo',
    )
    useEffect(() => {
        if (activeTab) {
            setInternalTab(activeTab)
        }
    }, [activeTab])

    const handleTabChange = (value: string) => {
        const tab = value as 'personalInfo' | 'address'
        if (!activeTab) {
            setInternalTab(tab)
        }
        onTabChange?.(tab)
    }

    const primaryAddress = (() => {
        const addresses = customer?.addresses
        if (Array.isArray(addresses) && addresses.length) {
            return addresses.find((addr) => addr?.isPrimary) || addresses[0]
        }
        return customer?.address
    })() || {}

    const defaultAddress: CustomerAddress = {
        street: primaryAddress.street || '',
        number: primaryAddress.number || '',
        corner: primaryAddress.corner || '',
        apartment: primaryAddress.apartment || '',
        city: primaryAddress.city || 'Montevideo',
        state:
            primaryAddress.state ||
            (primaryAddress as any)?.country ||
            'Uruguay',
        countryCode: primaryAddress.countryCode || '', // puede quedar vacío
        comments: primaryAddress.comments || '',
    }

    const customerPhoneList = (() => {
        if (Array.isArray(customer.phoneNumbers) && customer.phoneNumbers.length) {
            return customer.phoneNumbers
        }
        if (Array.isArray((customer as any)?.phones) && (customer as any).phones.length) {
            return (customer as any).phones
        }
        if (Array.isArray(customer.personalInfo?.phoneNumbers) && customer.personalInfo?.phoneNumbers.length) {
            return customer.personalInfo?.phoneNumbers
        }
        const legacy =
            customer.phoneNumber ||
            customer.personalInfo?.phoneNumber ||
            ''
        return legacy ? [legacy] : []
    })()

    const initialPhoneNumber =
        customerPhoneList[0] ||
        customer.phoneNumber ||
        customer.personalInfo?.phoneNumber ||
        ''

    return (
        <Formik<FormModel>
            enableReinitialize
            innerRef={ref}
            initialValues={{
                firstName: customer.firstName || defaultFirstName || '',
                lastName: customer.lastName || defaultLastName || '',
                email: customer.email || '',
                img: customer.img || '',
                location: customer?.personalInfo?.location || '',
                facebook: customer?.personalInfo?.facebook || '',
                twitter: customer?.personalInfo?.twitter || '',
                pinterest: customer?.personalInfo?.pinterest || '',
                linkedIn: customer?.personalInfo?.linkedIn || '',
                address: defaultAddress,
                phoneNumber: initialPhoneNumber,
                phoneNumbers:
                    customerPhoneList.length > 0
                        ? customerPhoneList
                        : [''],
            }}
            validateOnMount
            validationSchema={useValidationSchema(t)}
            onSubmit={async (values, { setSubmitting }) => {
                // Saneamos teléfonos: quitamos vacíos y dejamos al menos un string si no hay
                const sanitizedPhones = values.phoneNumbers
                    .map((phone) => phone.trim())
                    .filter((phone) => phone.length > 0)
                values.phoneNumbers = sanitizedPhones.length ? sanitizedPhones : ['']
                values.phoneNumber = values.phoneNumbers[0] || ''
                try {
                    await onFormSubmit?.(values)
                } finally {
                    setSubmitting(false)
                }
            }}
        >
            {(formikProps) => (
                <CustomerFormInner
                    {...formikProps}
                    onValuesChange={onValuesChange}
                    onValidationStateChange={onValidationStateChange}
                    currentTab={activeTab ?? internalTab}
                    onTabChangeLocal={handleTabChange}
                    t={t}
                />
            )}
        </Formik>
    )
})

CustomerForm.displayName = 'CustomerForm'

export default CustomerForm
