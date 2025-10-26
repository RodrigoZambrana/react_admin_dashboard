import { useEffect, useMemo, useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import { Formik, Form, Field } from 'formik'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import { FormContainer, FormItem } from '@/components/ui/Form'
import { apiGetUsers } from '@/services/UsersService'

const WORK_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CLOSED', 'CANCELED'] as const
type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

type ProductionOrderRecord = {
    id: number
    orderId: number
    workOrderId: number
    status: string
    priority: number
    assignedToId: number | null
    scheduledAt: string | null
    startedAt: string | null
    completedAt: string | null
    deliveredAt: string | null
    notes: string | null
}

type ProductionOrderFormValues = {
    orderId: string
    workOrderId?: string
    status: WorkOrderStatus
    priority: number
    assignedToId: string | null
    scheduledAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    deliveredAt: Date | null
    notes: string
}

type ProductionOrderFormDialogProps = {
    open: boolean
    onClose: () => void
    onSubmit: (values: Record<string, unknown>) => Promise<void>
    record: ProductionOrderRecord | null
}

const validationSchema = (t: (key: string, opts?: Record<string, unknown>) => string) =>
    Yup.object().shape({
        orderId: Yup.number()
            .typeError(t('production.orders.validation.orderId', { defaultValue: 'Order id is required' }))
            .required(t('production.orders.validation.orderId', { defaultValue: 'Order id is required' })),
        priority: Yup.number()
            .typeError(t('production.orders.validation.priority', { defaultValue: 'Priority is required' }))
            .min(1)
            .required(t('production.orders.validation.priority', { defaultValue: 'Priority is required' })),
        scheduledAt: Yup.date()
            .nullable()
            .typeError(t('sales.productionOrders.validation.invalidDate', { defaultValue: 'Select a valid date' })),
        startedAt: Yup.date()
            .nullable()
            .typeError(t('sales.productionOrders.validation.invalidDate', { defaultValue: 'Select a valid date' }))
            .test(
                'start-after-scheduled',
                t('sales.productionOrders.validation.startedBeforeScheduled', {
                    defaultValue: 'Start date cannot be before the scheduled date',
                }),
                function (value) {
                    const scheduledAt = this.parent.scheduledAt as Date | null | undefined
                    if (value && scheduledAt && value.getTime() < scheduledAt.getTime()) {
                        return false
                    }
                    return true
                },
            ),
        completedAt: Yup.date()
            .nullable()
            .typeError(t('sales.productionOrders.validation.invalidDate', { defaultValue: 'Select a valid date' }))
            .test(
                'completed-after-started',
                t('sales.productionOrders.validation.completedBeforeStarted', {
                    defaultValue: 'Completion date cannot be before the start date',
                }),
                function (value) {
                    const startedAt = this.parent.startedAt as Date | null | undefined
                    if (value && startedAt && value.getTime() < startedAt.getTime()) {
                        return false
                    }
                    return true
                },
            ),
        deliveredAt: Yup.date()
            .nullable()
            .typeError(t('sales.productionOrders.validation.invalidDate', { defaultValue: 'Select a valid date' }))
            .test(
                'delivered-after-completed',
                t('sales.productionOrders.validation.deliveredBeforeCompleted', {
                    defaultValue: 'Delivery date cannot be before the completion date',
                }),
                function (value) {
                    const completedAt = this.parent.completedAt as Date | null | undefined
                    if (value && completedAt && value.getTime() < completedAt.getTime()) {
                        return false
                    }
                    return true
                },
            ),
    })

const statusOptions = WORK_ORDER_STATUSES.map((status) => ({
    label: status,
    value: status,
}))

const DEFAULT_STATUS: WorkOrderStatus = 'PENDING'

const ProductionOrderFormDialog = ({ open, onClose, onSubmit, record }: ProductionOrderFormDialogProps) => {
    const { t } = useTranslation()
    const [userOptions, setUserOptions] = useState<Array<{ value: string; label: string }>>([])
    const [usersLoading, setUsersLoading] = useState(false)

    const initialValues = useMemo<ProductionOrderFormValues>(
        () => ({
            orderId: record ? String(record.orderId) : '',
            workOrderId: record ? String(record.workOrderId) : undefined,
            status: (record?.status as WorkOrderStatus) ?? DEFAULT_STATUS,
            priority: record?.priority ?? 1,
            assignedToId: record?.assignedToId ? String(record.assignedToId) : null,
            scheduledAt: record?.scheduledAt ? new Date(record.scheduledAt) : null,
            startedAt: record?.startedAt ? new Date(record.startedAt) : null,
            completedAt: record?.completedAt ? new Date(record.completedAt) : null,
            deliveredAt: record?.deliveredAt ? new Date(record.deliveredAt) : null,
            notes: record?.notes ?? '',
        }),
        [record],
    )

    useEffect(() => {
        if (!open) {
            return
        }
        let active = true
        const fetchUsers = async () => {
            setUsersLoading(true)
            try {
                const response = await apiGetUsers<
                    Array<{ id: number; name?: string | null; lastName?: string | null; email?: string | null }>
                >()
                if (!active) {
                    return
                }
                const options = (response.data ?? []).map((user) => {
                    const fullName = `${user.name ?? ''} ${user.lastName ?? ''}`.trim()
                    const label = fullName || user.email || `#${user.id}`
                    return { value: String(user.id), label }
                })
                if (
                    record?.assignedToId &&
                    !options.some((option) => Number(option.value) === record.assignedToId)
                ) {
                    const fallbackLabel = `${record.assignedTo?.name ?? ''} ${record.assignedTo?.lastName ?? ''}`.trim()
                    options.push({
                        value: String(record.assignedToId),
                        label: fallbackLabel || `#${record.assignedToId}`,
                    })
                }
                setUserOptions(options)
            } catch (error) {
                if (record?.assignedToId) {
                    const fallbackLabel = `${record.assignedTo?.name ?? ''} ${record.assignedTo?.lastName ?? ''}`.trim()
                    setUserOptions([
                        {
                            value: String(record.assignedToId),
                            label: fallbackLabel || `#${record.assignedToId}`,
                        },
                    ])
                } else {
                    setUserOptions([])
                }
            } finally {
                if (active) {
                    setUsersLoading(false)
                }
            }
        }
        fetchUsers()
        return () => {
            active = false
        }
    }, [open, record?.assignedTo?.lastName, record?.assignedTo?.name, record?.assignedToId])

    return (
        <Dialog isOpen={open} onClose={onClose} onRequestClose={onClose} width={540} closable>
            <h4 className="mb-4">
                {record
                    ? t('sales.productionOrders.form.editTitle', { defaultValue: 'Edit production order' })
                    : t('sales.productionOrders.form.createTitle', { defaultValue: 'Create production order' })}
            </h4>
            <Formik<ProductionOrderFormValues>
                initialValues={initialValues}
                enableReinitialize
                validationSchema={validationSchema(t)}
                onSubmit={async (values, { setSubmitting }) => {
                    await onSubmit({
                        orderId: Number(values.orderId),
                        workOrderId: values.workOrderId ? Number(values.workOrderId) : undefined,
                        status: values.status,
                        priority: Number(values.priority),
                        assignedToId:
                            values.assignedToId && values.assignedToId !== ''
                                ? Number(values.assignedToId)
                                : null,
                        scheduledAt: values.scheduledAt?.toISOString() ?? null,
                        startedAt: values.startedAt?.toISOString() ?? null,
                        completedAt: values.completedAt?.toISOString() ?? null,
                        deliveredAt: values.deliveredAt?.toISOString() ?? null,
                        notes: values.notes?.trim() || null,
                    })
                    setSubmitting(false)
                }}
            >
                {({ values, errors, touched, setFieldValue, isSubmitting }) => (
                    <Form>
                        <FormContainer>
                            <FormItem
                                label={t('sales.productionOrders.form.orderId', { defaultValue: 'Order ID' })}
                                invalid={Boolean(errors.orderId && touched.orderId)}
                                errorMessage={errors.orderId as string}
                            >
                                <Field name="orderId" component={Input} type="number" readOnly={Boolean(record)} />
                            </FormItem>
                            {record && (
                                <FormItem label={t('sales.productionOrders.form.workOrderId', { defaultValue: 'Work order ID' })}>
                                    <Field name="workOrderId" component={Input} type="number" readOnly />
                                </FormItem>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem label={t('text.columns.status')}>
                                    <Select
                                        value={statusOptions.find((option) => option.value === values.status)}
                                        options={statusOptions.map((option) => ({
                                            value: option.value,
                                            label: t(`sales.productionOrders.status.${option.value}`, {
                                                defaultValue: option.label,
                                            }),
                                        }))}
                                        onChange={(option) =>
                                            setFieldValue('status', (option as { value: WorkOrderStatus }).value)
                                        }
                                    />
                                </FormItem>
                                <FormItem
                                    label={t('sales.productionOrders.form.priority', { defaultValue: 'Priority' })}
                                    invalid={Boolean(errors.priority && touched.priority)}
                                    errorMessage={errors.priority as string}
                                >
                                    <Field name="priority" component={Input} type="number" min={1} />
                                </FormItem>
                            </div>
                            <FormItem label={t('sales.productionOrders.form.assignedTo', { defaultValue: 'Assigned to' })}>
                                <Select
                                    isClearable
                                    isLoading={usersLoading}
                                    value={
                                        values.assignedToId
                                            ? userOptions.find((option) => option.value === values.assignedToId) ?? null
                                            : null
                                    }
                                    options={userOptions}
                                    placeholder={t('common.labels.unassigned', { defaultValue: 'Unassigned' })}
                                    onChange={(option) =>
                                        setFieldValue('assignedToId', option ? (option as { value: string }).value : null)
                                    }
                                />
                            </FormItem>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem
                                    label={t('sales.productionOrders.form.scheduledAt', { defaultValue: 'Scheduled' })}
                                    invalid={Boolean(errors.scheduledAt && touched.scheduledAt)}
                                    errorMessage={errors.scheduledAt as string}
                                >
                                    <DatePicker
                                        value={values.scheduledAt}
                                        onChange={(value) => setFieldValue('scheduledAt', value)}
                                    />
                                </FormItem>
                                <FormItem
                                    label={t('sales.productionOrders.form.startedAt', { defaultValue: 'Started' })}
                                    invalid={Boolean(errors.startedAt && touched.startedAt)}
                                    errorMessage={errors.startedAt as string}
                                >
                                    <DatePicker
                                        value={values.startedAt}
                                        onChange={(value) => setFieldValue('startedAt', value)}
                                    />
                                </FormItem>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem
                                    label={t('sales.productionOrders.form.completedAt', { defaultValue: 'Completed' })}
                                    invalid={Boolean(errors.completedAt && touched.completedAt)}
                                    errorMessage={errors.completedAt as string}
                                >
                                    <DatePicker
                                        value={values.completedAt}
                                        onChange={(value) => setFieldValue('completedAt', value)}
                                    />
                                </FormItem>
                                <FormItem
                                    label={t('sales.productionOrders.form.deliveredAt', { defaultValue: 'Delivered' })}
                                    invalid={Boolean(errors.deliveredAt && touched.deliveredAt)}
                                    errorMessage={errors.deliveredAt as string}
                                >
                                    <DatePicker
                                        value={values.deliveredAt}
                                        onChange={(value) => setFieldValue('deliveredAt', value)}
                                    />
                                </FormItem>
                            </div>
                            <FormItem label={t('text.columns.notes')}>
                                <Field name="notes" component={Input} as="textarea" rows={3} />
                            </FormItem>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="plain" onClick={onClose}>
                                    {t('text.actions.cancel')}
                                </Button>
                                <Button type="submit" variant="solid" loading={isSubmitting}>
                                    {record
                                        ? t('text.actions.save', { defaultValue: 'Save' })
                                        : t('sales.productionOrders.form.submit', { defaultValue: 'Create production order' })}
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </Dialog>
    )
}

export default ProductionOrderFormDialog
