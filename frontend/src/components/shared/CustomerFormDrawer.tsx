import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import StickyFooter from '@/components/shared/StickyFooter'
import Alert from '@/components/ui/Alert'
import CustomerForm, {
    FormikRef as CustomerFormikRef,
    FormModel as CustomerFormModel,
    CustomerProps,
    ADDRESS_REQUIRED_FIELDS,
} from '@/views/crm/CustomerForm'
import type { FormikErrors } from 'formik'
import useResponsive from '@/utils/hooks/useResponsive'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'

const isNonEmpty = (v: unknown) =>
    v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')

const hasAnyError = (value: unknown): boolean => {
    if (!value) return false
    if (typeof value === 'string') return true
    if (Array.isArray(value)) return value.some(hasAnyError)
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(hasAnyError)
    }
    return false
}

type TabKey = 'personalInfo' | 'address'

type CustomerFormDrawerLabels = {
    cancel?: string
    next?: string
    save?: string
}

type CustomerFormDrawerProps = {
    isOpen: boolean
    onClose: () => void
    customer?: (CustomerProps & { id?: string | number }) | null
    title?: string
    labels?: CustomerFormDrawerLabels
    onSubmit: (values: CustomerFormModel) => Promise<void> | void
    onSubmitSuccess?: (values: CustomerFormModel) => void
    activeTab?: TabKey
    onTabChange?: (tab: TabKey) => void
    onValuesChange?: (values: CustomerFormModel) => void
    onValidationStateChange?: (state: {
        isSubmitting: boolean
        errors: FormikErrors<CustomerFormModel>
    }) => void
    onAddressCompleteChange?: (complete: boolean) => void
}

const CustomerFormDrawer = ({
    isOpen,
    onClose,
    customer,
    title,
    labels,
    onSubmit,
    onSubmitSuccess,
    activeTab: controlledTab,
    onTabChange,
    onValuesChange,
    onValidationStateChange,
    onAddressCompleteChange,
}: CustomerFormDrawerProps) => {
    const { t } = useTranslation()
    const formRef = useRef<CustomerFormikRef>(null)
    const [internalTab, setInternalTab] = useState<TabKey>('personalInfo')
    const [addressComplete, setAddressComplete] = useState(false)
    const [isSubmittingForm, setIsSubmittingForm] = useState(false)
    const [hasValidationErrors, setHasValidationErrors] = useState(true)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const actualTab = controlledTab ?? internalTab

    const setActiveTab = useCallback(
        (tab: TabKey) => {
            if (!controlledTab) {
                setInternalTab(tab)
            }
            onTabChange?.(tab)
        },
        [controlledTab, onTabChange],
    )

    const resetState = useCallback(() => {
        setInternalTab('personalInfo')
        setAddressComplete(false)
        setIsSubmittingForm(false)
        setHasValidationErrors(true)
        setSubmitError(null)
        formRef.current?.resetForm?.()
    }, [])

    useEffect(() => {
        if (!isOpen) {
            resetState()
        }
    }, [isOpen, resetState])

    const evaluateAddressComplete = useCallback((formValues: CustomerFormModel) => {
        const address = formValues.address
        const hasAllFields =
            !!address && ADDRESS_REQUIRED_FIELDS.every((key) => isNonEmpty(address[key]))
        setAddressComplete(hasAllFields)
        onAddressCompleteChange?.(hasAllFields)
    }, [onAddressCompleteChange])

    const markAddressTouched = useCallback(() => {
        const fields = ['street', 'number', 'city', 'state', 'countryCode', 'corner', 'apartment']
        fields.forEach((field) =>
            formRef.current?.setFieldTouched(`address.${field}`, true, true),
        )
    }, [])

    const markPersonalTouched = useCallback(() => {
        const personalFields: Array<keyof CustomerFormModel> = ['firstName', 'lastName', 'email']
        personalFields.forEach((field) => formRef.current?.setFieldTouched(field as string, true, true))
        const phones = formRef.current?.values.phoneNumbers || []
        phones.forEach((_, index) => formRef.current?.setFieldTouched(`phoneNumbers.${index}`, true, true))
    }, [])

    const handleSubmitAction = useCallback(async () => {
        const formik = formRef.current
        if (!formik) return

        const validationErrors = await formik.validateForm()
        const combinedErrors = Object.keys(validationErrors || {}).length
            ? validationErrors
            : formik.errors

        setHasValidationErrors(hasAnyError(combinedErrors))

        const { address: addressErrors, ...personalErrors } = (combinedErrors || {}) as Record<string, unknown>

        if (hasAnyError(personalErrors)) {
            setActiveTab('personalInfo')
            markPersonalTouched()
            return
        }

        if (hasAnyError(addressErrors)) {
            setActiveTab('address')
            markAddressTouched()
            return
        }

        await formik.submitForm()
    }, [
        markAddressTouched,
        markPersonalTouched,
        setActiveTab,
    ])

    const handleValidationStateChange = useCallback(
        ({ errors, isSubmitting }: { errors: FormikErrors<CustomerFormModel>; isSubmitting: boolean }) => {
            setIsSubmittingForm(isSubmitting)

            const { address: addressErrors } =
                (errors as Record<string, unknown> | undefined) || {}
            const addressValues = formRef.current?.values.address
            const hasRequiredValues =
                !!addressValues && ADDRESS_REQUIRED_FIELDS.every((key) => isNonEmpty((addressValues as any)[key]))
            const noAddressErrors = !hasAnyError(addressErrors)
            const complete = hasRequiredValues && noAddressErrors
            setAddressComplete(complete)

            setHasValidationErrors(hasAnyError(errors))
            onValidationStateChange?.({ errors, isSubmitting })
        },
        [onValidationStateChange],
    )

    const setBackendFieldErrors = useCallback((errors: Array<{ field?: string; key?: string; message?: string }>) => {
        const formik = formRef.current
        if (!formik || !errors?.length) {
            return { personal: false, address: false }
        }

        let personal = false
        let address = false

        const resolveTargets = (field?: string): string[] => {
            switch (field) {
                case 'phoneNumber':
                case 'phone':
                    return ['phoneNumbers.0', 'phoneNumbers', 'phoneNumber']
                case 'phoneNumbers':
                    return ['phoneNumbers', 'phoneNumbers.0']
                case 'email':
                    return ['email']
                case 'address.street':
                case 'street':
                    return ['address.street']
                case 'address.number':
                case 'number':
                    return ['address.number']
                case 'address.city':
                case 'city':
                    return ['address.city']
                case 'address.state':
                case 'state':
                    return ['address.state']
                default:
                    return field ? [field] : []
            }
        }

        errors.forEach(({ field, key, message }) => {
            const translated =
                key && typeof key === 'string'
                    ? t(key, { defaultValue: message || key })
                    : message
                    ? t(message, { defaultValue: message })
                    : undefined

            resolveTargets(field).forEach((target) => {
                if (!target) {
                    return
                }
                formik.setFieldError(target, translated ?? message ?? '')
                formik.setFieldTouched(target, true, true)
                if (target.startsWith('address.')) {
                    address = true
                } else {
                    personal = true
                }
            })
        })

        return { personal, address }
    }, [t])

    const applyBackendError = useCallback((error: unknown) => {
        if (!isAxiosError(error)) {
            if (error instanceof Error && error.message) {
                setSubmitError(error.message)
            }
            return
        }

        const data = error.response?.data as
            | {
                  message?: string
                  errors?: Array<{ field?: string; key?: string; message?: string }>
              }
            | undefined

        if (!data) {
            return
        }

        const fallbackMessage =
            Array.isArray(data.errors) && data.errors.length
                ? data.errors[0]?.message
                : undefined

        const translatedMessage =
            typeof data.message === 'string'
                ? t(data.message, {
                      defaultValue: fallbackMessage || data.message,
                  })
                : fallbackMessage

        if (translatedMessage) {
            setSubmitError(translatedMessage)
        }

        if (Array.isArray(data.errors) && data.errors.length) {
            const { personal, address } = setBackendFieldErrors(data.errors)
            setHasValidationErrors(true)
            if (personal) {
                setActiveTab('personalInfo')
                markPersonalTouched()
            } else if (address) {
                setActiveTab('address')
                markAddressTouched()
            }
        }
    }, [
        markAddressTouched,
        markPersonalTouched,
        setBackendFieldErrors,
        setActiveTab,
        t,
    ])

    const handleFormSubmit = useCallback(async (values: CustomerFormModel) => {
        setSubmitError(null)
        try {
            await onSubmit(values)
            onSubmitSuccess?.(values)
            setHasValidationErrors(true)
        } catch (error) {
            applyBackendError(error)
        }
    }, [applyBackendError, onSubmit, onSubmitSuccess])

    const computedTitle = useMemo(() => title || '', [title])
    const cancelLabel = labels?.cancel || 'Cancel'
    const nextLabel = labels?.next || 'Next'
    const saveLabel = labels?.save || 'Save'

    const primaryActionLabel =
        actualTab === 'address' && addressComplete && !hasValidationErrors
            ? saveLabel
            : nextLabel

    const { smaller } = useResponsive()
    const isMobile = smaller.md
    const drawerWidth = isMobile ? '100%' : 420

    return (
        <Drawer
            isOpen={isOpen}
            width={drawerWidth}
            className="w-full sm:w-[420px]"
            bodyClass="p-0 flex flex-col h-full"
            title={computedTitle || undefined}
            onClose={onClose}
            onRequestClose={onClose}
        >
            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6">
                {submitError && (
                    <Alert showIcon type="danger" className="mb-4">
                        {submitError}
                    </Alert>
                )}
                <CustomerForm
                    ref={formRef}
                    customer={(customer ?? {}) as CustomerProps}
                    activeTab={actualTab}
                    onTabChange={setActiveTab}
                    onValuesChange={(values) => {
                        if (submitError) {
                            setSubmitError(null)
                        }
                        evaluateAddressComplete(values)
                        onValuesChange?.(values)
                    }}
                    onValidationStateChange={({ isSubmitting, errors }) => {
                        handleValidationStateChange({ errors, isSubmitting })
                    }}
                    onFormSubmit={handleFormSubmit}
                />
            </div>
            <StickyFooter
                className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3"
                stickyClass="shadow-lg"
            >
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant="solid"
                        disabled={isSubmittingForm}
                        onClick={handleSubmitAction}
                    >
                        {primaryActionLabel}
                    </Button>
                </div>
            </StickyFooter>
        </Drawer>
    )
}

export default CustomerFormDrawer
