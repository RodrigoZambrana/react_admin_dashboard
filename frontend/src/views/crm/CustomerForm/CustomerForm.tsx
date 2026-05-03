import { forwardRef, useEffect, useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import { FormContainer } from '@/components/ui/Form'
import { Form, Formik, FormikProps, FormikErrors } from 'formik'
import { useTranslation } from 'react-i18next'
import * as Yup from 'yup'
import PersonalInfoForm from './PersonalInfoForm'
import AddressForm from './AddressForm'
import {
    normalizePhoneNumber,
    normalizePhoneNumberList,
    hasDialCodeOnly,
} from '@/utils/phone'
import { trackAnalyticsEvent } from '@/services/AnalyticsEventService'

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
    label: string
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
        number: Yup.string()
            .matches(/^\d+$/, {
                message: t('text.validation.onlyNumbers', {
                    defaultValue: 'Please enter numbers only.',
                }),
                excludeEmptyString: true,
            })
            .required(t('text.validation.enterAddress')),
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
        label: Yup.string().nullable(),
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
        email: Yup.string()
            .trim()
            .email(t('text.validation.invalidEmail'))
            .nullable()
            .transform((value, originalValue) => {
                const trimmed = originalValue?.trim?.() ?? ''
                return trimmed === '' ? null : value
            }),
        firstName: Yup.string().required(t('text.validation.userNameRequired')),
        lastName: Yup.string()
            .nullable()
            .transform((value, originalValue) => {
                const trimmed = originalValue?.trim?.() ?? ''
                return trimmed === '' ? null : value
            }),
        location: Yup.string(),
        phoneNumbers: Yup.array()
            .of(
                Yup.string()
                    .transform((v) => {
                        const raw = typeof v === 'string' ? v.trim() : ''
                        if (!raw || hasDialCodeOnly(raw)) {
                            return null
                        }
                        const normalized = normalizePhoneNumber(raw)
                        return normalized || null
                    })
                    .nullable()
                    .notRequired()
                    .test('valid-phone', t('text.validation.invalidPhoneNumber'), (value) => {
                        if (!value) {
                            return true
                        }
                        return /^\+\d{6,15}$/.test(value)
                    }),
            )
            .compact((v) => v == null)
            .test(
                'at-least-one-phone',
                t('text.validation.phoneNumberRequired', {
                    defaultValue: 'Phone number is required.',
                }),
                (values) => Array.isArray(values) && values.length > 0,
            ),
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
        label: primaryAddress.label || '',
    }

    const extractPhoneValues = (input: unknown): string[] => {
        if (!Array.isArray(input)) {
            return []
        }
        return input
            .map((phone) => {
                if (phone === undefined || phone === null) {
                    return ''
                }
                if (typeof phone === 'string') {
                    return phone
                }
                if (typeof phone === 'number' && Number.isFinite(phone)) {
                    return String(phone)
                }
                if (typeof phone === 'object' && 'phone' in (phone as Record<string, unknown>)) {
                    const value = (phone as Record<string, unknown>).phone
                    return typeof value === 'string' ? value : String(value ?? '')
                }
                return String(phone)
            })
            .filter((value) => value.trim().length > 0)
    }

    const customerPhoneList = (() => {
        if (Array.isArray(customer.phoneNumbers) && customer.phoneNumbers.length) {
            return extractPhoneValues(customer.phoneNumbers)
        }
        if (Array.isArray((customer as any)?.phones) && (customer as any).phones.length) {
            return extractPhoneValues((customer as any).phones)
        }
        if (Array.isArray(customer.personalInfo?.phoneNumbers) && customer.personalInfo?.phoneNumbers.length) {
            return extractPhoneValues(customer.personalInfo?.phoneNumbers)
        }
        const legacy =
            customer.phoneNumber ||
            customer.personalInfo?.phoneNumber ||
            ''
        return legacy ? [legacy] : []
    })()

    const normalizedPhoneNumbers = normalizePhoneNumberList(customerPhoneList)
    const initialPhoneNumber =
        normalizedPhoneNumbers[0] ||
        normalizePhoneNumber(customer.phoneNumber) ||
        normalizePhoneNumber(customer.personalInfo?.phoneNumber) ||
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
                    normalizedPhoneNumbers.length > 0
                        ? normalizedPhoneNumbers
                        : [''],
            }}
            validateOnMount
            validationSchema={useValidationSchema(t)}
            onSubmit={async (values, { setSubmitting }) => {
                const normalizedList = normalizePhoneNumberList(values.phoneNumbers || [])
                const primaryPhone =
                    normalizedList[0] || normalizePhoneNumber(values.phoneNumber) || ''
                values.phoneNumbers = normalizedList.length ? normalizedList : ['']
                values.phoneNumber = primaryPhone
                try {
                    void trackAnalyticsEvent({
                        event: 'form_submit',
                        category: 'conversion',
                        source: 'web',
                        measurement_status: 'partial',
                        currency: null,
                        metadata: {
                            form: 'crm_customer_form',
                            has_phone: Boolean(primaryPhone),
                            has_email: Boolean(values.email?.trim?.()),
                            email: values.email || null,
                            phone: primaryPhone || null,
                        },
                    })
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
