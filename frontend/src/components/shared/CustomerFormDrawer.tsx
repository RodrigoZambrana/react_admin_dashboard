import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import StickyFooter from '@/components/shared/StickyFooter'
import CustomerForm, {
    FormikRef as CustomerFormikRef,
    FormModel as CustomerFormModel,
    CustomerProps,
    ADDRESS_REQUIRED_FIELDS,
} from '@/views/crm/CustomerForm'
import type { FormikErrors } from 'formik'

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
    const formRef = useRef<CustomerFormikRef>(null)
    const [internalTab, setInternalTab] = useState<TabKey>('personalInfo')
    const [addressComplete, setAddressComplete] = useState(false)
    const [isSubmittingForm, setIsSubmittingForm] = useState(false)
    const [hasValidationErrors, setHasValidationErrors] = useState(true)
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

    const handleFormSubmit = useCallback(async (values: CustomerFormModel) => {
        await onSubmit(values)
        onSubmitSuccess?.(values)
        setHasValidationErrors(true)
    }, [onSubmit, onSubmitSuccess])

    const computedTitle = useMemo(() => title || '', [title])
    const cancelLabel = labels?.cancel || 'Cancel'
    const nextLabel = labels?.next || 'Next'
    const saveLabel = labels?.save || 'Save'

    const primaryActionLabel =
        actualTab === 'address' && addressComplete && !hasValidationErrors
            ? saveLabel
            : nextLabel

    return (
        <Drawer
            isOpen={isOpen}
            bodyClass="p-0"
            title={computedTitle || undefined}
            onClose={onClose}
            onRequestClose={onClose}
        >
            <CustomerForm
                ref={formRef}
                customer={(customer ?? {}) as CustomerProps}
                activeTab={actualTab}
                onTabChange={setActiveTab}
                onValuesChange={(values) => {
                    evaluateAddressComplete(values)
                    onValuesChange?.(values)
                }}
                onValidationStateChange={({ isSubmitting, errors }) => {
                    handleValidationStateChange({ errors, isSubmitting })
                }}
                onFormSubmit={handleFormSubmit}
            />
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
