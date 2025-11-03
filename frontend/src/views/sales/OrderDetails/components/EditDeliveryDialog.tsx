import { useMemo } from 'react'
import dayjs from 'dayjs'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import DatePicker from '@/components/ui/DatePicker'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useTranslation } from 'react-i18next'
import { apiUpdateSalesOrderDelivery, UpdateOrderDeliveryPayload } from '@/services/SalesService'

type DeliveryFormValues = {
    shippingVendor: string
    deliveryFees: string
    estimatedDate: Date | null
    estimatedMinDays: string
    estimatedMaxDays: string
}

type EditDeliveryDialogProps = {
    open: boolean
    onClose: () => void
    onSaved: () => void
    orderId?: number
    initialVendor?: string
    initialDeliveryFees?: number
    initialEstimatedMin?: number | null
    initialEstimatedMax?: number | null
    initialEstimatedDate?: string | null
    orderPlacedAt?: string | null
}

const toNormalizedNumber = (value?: number | null) => {
    if (value === null || value === undefined) {
        return ''
    }
    return `${value}`
}

const EditDeliveryDialog = ({
    open,
    onClose,
    onSaved,
    orderId,
    initialVendor = '',
    initialDeliveryFees = 0,
    initialEstimatedMin = null,
    initialEstimatedMax = null,
    initialEstimatedDate = null,
    orderPlacedAt = null,
}: EditDeliveryDialogProps) => {
    const { t } = useTranslation()

    const initialDate = useMemo(() => {
        if (initialEstimatedDate) {
            const parsed = dayjs(initialEstimatedDate)
            return parsed.isValid() ? parsed.toDate() : null
        }
        if (
            initialEstimatedMax !== null &&
            orderPlacedAt &&
            dayjs(orderPlacedAt).isValid()
        ) {
            const baseline = dayjs(orderPlacedAt).startOf('day')
            return baseline.add(initialEstimatedMax, 'day').toDate()
        }
        return null
    }, [initialEstimatedDate, initialEstimatedMax, orderPlacedAt])

    const initialValues: DeliveryFormValues = useMemo(
        () => ({
            shippingVendor: initialVendor ?? '',
            deliveryFees:
                initialDeliveryFees !== undefined && initialDeliveryFees !== null
                    ? Number(initialDeliveryFees).toFixed(2)
                    : '',
            estimatedDate: initialDate,
            estimatedMinDays: toNormalizedNumber(initialEstimatedMin),
            estimatedMaxDays: toNormalizedNumber(initialEstimatedMax),
        }),
        [initialVendor, initialDeliveryFees, initialEstimatedMin, initialEstimatedMax, initialDate],
    )

    const initialContext = useMemo(() => {
        const normalizedVendor = initialVendor ?? ''
        const normalizedFees = Number(Number(initialDeliveryFees ?? 0).toFixed(2))
        const normalizedMin = initialEstimatedMin ?? null
        const normalizedMax = initialEstimatedMax ?? null
        const normalizedDate = initialEstimatedDate
            ? (() => {
                  const parsed = dayjs(initialEstimatedDate)
                  return parsed.isValid() ? parsed.toISOString() : null
              })()
            : null
        return {
            vendor: normalizedVendor,
            deliveryFees: normalizedFees,
            estimatedMin: normalizedMin,
            estimatedMax: normalizedMax,
            estimatedDateIso: normalizedDate,
        }
    }, [
        initialVendor,
        initialDeliveryFees,
        initialEstimatedMin,
        initialEstimatedMax,
        initialEstimatedDate,
    ])

    const handleSubmit = async (
        values: DeliveryFormValues,
        helpers: {
            setSubmitting: (flag: boolean) => void
            setStatus: (status?: { error?: string }) => void
        },
    ) => {
        if (!orderId) {
            onClose()
            return
        }
        helpers.setStatus()
        const payload: UpdateOrderDeliveryPayload = {}
        let hasChanges = false

        const trimmedVendor = values.shippingVendor.trim()
        if (trimmedVendor !== initialContext.vendor) {
            payload.shippingVendor = trimmedVendor.length ? trimmedVendor : null
            hasChanges = true
        }

        const feesInput = values.deliveryFees.trim()
        if (feesInput.length > 0) {
            const parsedFees = Number(feesInput)
            if (Number.isNaN(parsedFees) || parsedFees < 0) {
                helpers.setStatus({
                    error: t('sales.orderDetails.delivery.validation.deliveryFeesPositive', {
                        defaultValue: 'Delivery fee must be a positive number.',
                    }),
                })
                helpers.setSubmitting(false)
                return
            }
            const normalized = Number(parsedFees.toFixed(2))
            if (normalized !== initialContext.deliveryFees) {
                payload.deliveryFees = normalized
                hasChanges = true
            }
        }

        const parseOptionalInt = (input: string, field: 'estimatedMinDays' | 'estimatedMaxDays') => {
            const trimmed = input.trim()
            if (!trimmed.length) {
                return null
            }
            const parsed = Number.parseInt(trimmed, 10)
            if (Number.isNaN(parsed) || parsed < 0) {
                helpers.setStatus({
                    error: t('sales.orderDetails.delivery.validation.daysPositive', {
                        defaultValue: 'Days must be a non-negative integer.',
                    }),
                })
                helpers.setSubmitting(false)
                throw new Error('validation')
            }
            return parsed
        }

        let minDaysInput: number | null = null
        let maxDaysInput: number | null = null
        try {
            minDaysInput = parseOptionalInt(values.estimatedMinDays, 'estimatedMinDays')
            maxDaysInput = parseOptionalInt(values.estimatedMaxDays, 'estimatedMaxDays')
        } catch {
            return
        }

        const baseline = orderPlacedAt ? dayjs(orderPlacedAt).startOf('day') : null
        let computedDiff: number | null = null
        if (values.estimatedDate && baseline) {
            const target = dayjs(values.estimatedDate)
            if (target.isValid()) {
                computedDiff = Math.max(0, target.startOf('day').diff(baseline, 'day'))
            }
        }

        let nextMin = minDaysInput
        let nextMax = maxDaysInput

        if (nextMin === null) {
            nextMin = computedDiff
        }
        if (nextMax === null) {
            nextMax = computedDiff
        }

        const normalizedMin =
            nextMin !== null && Number.isFinite(nextMin) ? Math.max(0, nextMin) : null
        const normalizedMax =
            nextMax !== null && Number.isFinite(nextMax) ? Math.max(0, nextMax) : null

        if (normalizedMin !== initialContext.estimatedMin) {
            payload.estimatedMinDays = normalizedMin
            hasChanges = true
        }
        if (normalizedMax !== initialContext.estimatedMax) {
            payload.estimatedMaxDays = normalizedMax
            hasChanges = true
        }

        if (values.estimatedDate) {
            const iso = dayjs(values.estimatedDate).toISOString()
            if (iso !== initialContext.estimatedDateIso) {
                payload.estimatedDate = iso
                hasChanges = true
            }
        } else if (initialContext.estimatedDateIso) {
            // Allow clearing the date when it was previously set
            payload.estimatedDate = undefined
            hasChanges = true
        }

        if (!hasChanges) {
            helpers.setSubmitting(false)
            onClose()
            return
        }

        try {
            await apiUpdateSalesOrderDelivery(orderId, payload)
            toast.push(
                <Notification
                    title={t('sales.orderDetails.delivery.feedback.updatedTitle', {
                        defaultValue: 'Delivery details updated',
                    })}
                    type="success"
                >
                    {t('sales.orderDetails.delivery.feedback.updatedDesc', {
                        defaultValue: 'The delivery information was saved successfully.',
                    })}
                </Notification>,
            )
            onSaved()
        } catch (error) {
            toast.push(
                <Notification
                    title={t('sales.orderDetails.delivery.feedback.updateFailedTitle', {
                        defaultValue: 'Could not update delivery details',
                    })}
                    type="danger"
                >
                    {t('sales.orderDetails.delivery.feedback.updateFailedDesc', {
                        defaultValue: 'Please try again in a moment.',
                    })}
                </Notification>,
            )
        } finally {
            helpers.setSubmitting(false)
        }
    }

    return (
        <Dialog isOpen={open} onClose={onClose} onRequestClose={onClose} width={480}>
            <h4 className="mb-4">
                {t('sales.orderDetails.delivery.editTitle', {
                    defaultValue: 'Edit delivery information',
                })}
            </h4>
            <Formik<DeliveryFormValues>
                initialValues={initialValues}
                enableReinitialize
                onSubmit={(values, helpers) => {
                    void handleSubmit(values, helpers)
                }}
            >
                {({ values, setFieldValue, isSubmitting, status, dirty }) => (
                    <Form>
                        <FormContainer>
                            {status?.error && (
                                <div className="mb-3 text-sm text-red-500">{status.error}</div>
                            )}
                            <FormItem
                                label={t('sales.orderDetails.delivery.fields.shippingVendor', {
                                    defaultValue: 'Carrier',
                                })}
                            >
                                <Field name="shippingVendor">
                                    {({ field }) => (
                                        <Input
                                            {...field}
                                            autoComplete="off"
                                            placeholder={t(
                                                'sales.orderDetails.delivery.placeholders.shippingVendor',
                                                { defaultValue: 'Carrier name' },
                                            )}
                                        />
                                    )}
                                </Field>
                            </FormItem>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem
                                    label={t('sales.orderDetails.delivery.fields.deliveryFees', {
                                        defaultValue: 'Delivery fee',
                                    })}
                                >
                                    <Field name="deliveryFees">
                                        {({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                                <FormItem
                                    label={t('sales.orderDetails.delivery.fields.estimatedDate', {
                                        defaultValue: 'Estimated delivery date',
                                    })}
                                    help={t('sales.orderDetails.delivery.helpers.estimatedDate', {
                                        defaultValue:
                                            'Pick a specific delivery date or leave empty and define the day range.',
                                    })}
                                >
                                    <DatePicker
                                        value={values.estimatedDate}
                                        onChange={(value) => setFieldValue('estimatedDate', value)}
                                    />
                                </FormItem>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem
                                    label={t('sales.orderDetails.delivery.fields.minDays', {
                                        defaultValue: 'Minimum days',
                                    })}
                                >
                                    <Field name="estimatedMinDays">
                                        {({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                                <FormItem
                                    label={t('sales.orderDetails.delivery.fields.maxDays', {
                                        defaultValue: 'Maximum days',
                                    })}
                                >
                                    <Field name="estimatedMaxDays">
                                        {({ field }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                            </div>
                        </FormContainer>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button type="button" disabled={isSubmitting} onClick={onClose}>
                                {t('text.actions.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                variant="solid"
                                loading={isSubmitting}
                                disabled={isSubmitting || !dirty}
                            >
                                {t('text.actions.save')}
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </Dialog>
    )
}

export default EditDeliveryDialog
