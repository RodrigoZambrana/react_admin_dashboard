import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Dialog from '@/components/ui/Dialog'
import Switcher from '@/components/ui/Switcher'
import Upload from '@/components/ui/Upload'
import Badge from '@/components/ui/Badge'
import { FormContainer, FormItem } from '@/components/ui/Form'
import hooks from '@/components/ui/hooks'
import {
    closeDialog,
    useAppDispatch,
    useAppSelector,
    CalendarEvent,
    CalendarEventAttachment,
} from '../store'
import { Field, Form, Formik } from 'formik'
import { components, ControlProps, OptionProps } from 'react-select'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { HiCheck, HiOutlineTrash } from 'react-icons/hi'
import {
    apiGetCrmCustomers,
    apiGetCrmCustomerDetails,
    type CalendarEventAddress,
} from '@/services/CrmService'
import { apiGetCalendarEventTypes } from '@/services/SettingsService'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'

const { Control } = components
const { useUniqueId } = hooks

const colorOptions = [
    { value: 'red', label: 'red', color: 'bg-red-500' },
    { value: 'orange', label: 'orange', color: 'bg-orange-500' },
    { value: 'amber', label: 'amber', color: 'bg-amber-500' },
    { value: 'yellow', label: 'yellow', color: 'bg-yellow-500' },
    { value: 'lime', label: 'lime', color: 'bg-lime-500' },
    { value: 'green', label: 'green', color: 'bg-green-500' },
    { value: 'emerald', label: 'emerald', color: 'bg-emerald-500' },
    { value: 'teal', label: 'teal', color: 'bg-teal-500' },
    { value: 'cyan', label: 'cyan', color: 'bg-cyan-500' },
    { value: 'sky', label: 'sky', color: 'bg-sky-500' },
    { value: 'blue', label: 'blue', color: 'bg-blue-500' },
    { value: 'indigo', label: 'indigo', color: 'bg-indigo-500' },
    { value: 'purple', label: 'purple', color: 'bg-purple-500' },
    { value: 'fuchsia', label: 'fuchsia', color: 'bg-fuchsia-500' },
    { value: 'pink', label: 'pink', color: 'bg-pink-500' },
    { value: 'rose', label: 'rose', color: 'bg-rose-500' },
]

type ColorOption = (typeof colorOptions)[number]

const CustomSelectOption = ({
    innerProps,
    label,
    data,
    isSelected,
}: OptionProps<ColorOption>) => {
    return (
        <div
            className={`flex items-center justify-between p-2 ${
                isSelected
                    ? 'bg-gray-100 dark:bg-gray-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            {...innerProps}
        >
            <div className="flex items-center">
                <Badge className={data.color} />
                <span className="ml-2 rtl:mr-2 capitalize">{label}</span>
            </div>
            {isSelected && <HiCheck className="text-emerald-500 text-xl" />}
        </div>
    )
}

const CustomControl = ({ children, ...props }: ControlProps<ColorOption>) => {
    const selected = props.getValue()[0]

    return (
        <Control className="capitalize" {...props}>
            {selected && (
                <Badge className={`${selected.color} ltr:ml-4 rtl:mr-4`} />
            )}
            {children}
        </Control>
    )
}

type CustomerOption = {
    value: string
    label: string
    email?: string
}

type EventTypeOption = {
    value: string
    label: string
}

type FormModel = {
    title: string
    detail: string
    startDate: Date | null
    endDate: Date | null
    color: string
    allDay: boolean
    address: CalendarEventAddress
    isInternal: boolean
    customerId: string | null
    eventType: string
    attachments: File[]
}

type EventDialogProps = {
    submit: (eventData: CalendarEvent, type: string) => void
}

const useValidationSchema = (t: (k: string, opts?: Record<string, unknown>) => string) =>
    Yup.object().shape({
        title: Yup.string().required(t('text.validation.eventTitleRequired')),
        detail: Yup.string().max(
            2000,
            t('text.validation.maxLength', {
                defaultValue: 'Máximo {{max}} caracteres',
                max: 2000,
            }),
        ),
        startDate: Yup.date()
            .nullable()
            .required(t('text.validation.startDateRequired')),
        endDate: Yup.date()
            .nullable()
            .required(
                t('text.validation.endDateRequired', {
                    defaultValue: 'La fecha de fin es obligatoria',
                }),
            )
            .min(
                Yup.ref('startDate'),
                t('text.validation.endDateAfterStart', {
                    defaultValue:
                        'La fecha de fin debe ser posterior a la de inicio.',
                }),
            ),
        color: Yup.string().required(t('text.validation.colorRequired')),
        eventType: Yup.string().required(
            t('calendar.validation.eventTypeRequired', {
                defaultValue: 'Selecciona un tipo de evento',
            }),
        ),
    })

const initialCustomers: CustomerOption[] = []

const emptyAddress: CalendarEventAddress = {
    street: '',
    number: '',
    corner: '',
    apartment: '',
    city: '',
    country: '',
}

const formatAddressLabel = (address?: CalendarEventAddress) => {
    if (!address) {
        return ''
    }
    const line1 = [address.street, address.number]
        .filter((value) => value && String(value).trim() !== '')
        .join(' ')
    const line2 = [address.city, address.country]
        .filter((value) => value && String(value).trim() !== '')
        .join(', ')
    return [line1, line2]
        .filter((value) => value && String(value).trim() !== '')
        .join(', ')
}

const mapFilesToAttachments = (files: File[]): CalendarEventAttachment[] =>
    files.map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        type: file.type,
        size: file.size,
    }))

const EventDialog = ({ submit }: EventDialogProps) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const open = useAppSelector((state) => state.crmCalendar.data.dialogOpen)
    const selected = useAppSelector((state) => state.crmCalendar.data.selected)
    const loading = useAppSelector((state) => state.crmCalendar.data.loading)
    const newId = useUniqueId('event-')

    const [customerOptions, setCustomerOptions] = useState(initialCustomers)
    const [eventTypeOptions, setEventTypeOptions] = useState<EventTypeOption[]>([])
    const [existingAttachments, setExistingAttachments] = useState<
        CalendarEventAttachment[]
    >(selected.extendedProps?.attachments || [])
    const [files, setFiles] = useState<File[]>([])
    const [customerAddressesCache, setCustomerAddressesCache] = useState<
        Record<string, CalendarEventAddress | undefined>
    >({})
    const [loadingAddress, setLoadingAddress] = useState(false)
    const defaultEventType = useMemo(
        () => eventTypeOptions[0]?.value || 'meeting',
        [eventTypeOptions],
    )

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const response = await apiGetCrmCustomers<{
                    data: { id: string | number; name: string; email?: string }[]
                }>({
                    pageIndex: 1,
                    pageSize: 200,
                    sort: { key: 'name', order: 'asc' },
                    query: '',
                } as any)
                const list = ((response as any).data?.data || []).map(
                    (item: any) => ({
                        value: String(item.id),
                        label: item.name,
                        email: item.email,
                    }),
                )
                setCustomerOptions(list)
            } catch (error) {
                toast.push(
                    <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                        {t('calendar.errors.customers', {
                            defaultValue: 'No fue posible cargar los clientes.',
                        })}
                    </Notification>,
                )
            }
        }
        loadCustomers()
    }, [t])

    useEffect(() => {
        const loadEventTypes = async () => {
            try {
                const response = await apiGetCalendarEventTypes<
                    { key: string; label: string }[]
                >()
                const list = Array.isArray(response.data)
                    ? response.data
                          .filter((item) => item && item.key && item.label)
                          .map((item) => ({
                              value: item.key,
                              label: item.label,
                          }))
                    : []
                setEventTypeOptions(
                    list.length > 0
                        ? list
                        : [
                              {
                                  value: 'meeting',
                                  label: t('calendar.eventTypes.meeting', {
                                      defaultValue: 'Reunión',
                                  }),
                              },
                              {
                                  value: 'task',
                                  label: t('calendar.eventTypes.task', {
                                      defaultValue: 'Tarea',
                                  }),
                              },
                              {
                                  value: 'workshop',
                                  label: t('calendar.eventTypes.workshop', {
                                      defaultValue: 'Taller',
                                  }),
                              },
                              {
                                  value: 'other',
                                  label: t('calendar.eventTypes.other', {
                                      defaultValue: 'Otro',
                                  }),
                              },
                          ],
                )
            } catch (error) {
                setEventTypeOptions([
                    { value: 'meeting', label: t('calendar.eventTypes.meeting', { defaultValue: 'Reunión' }) },
                    { value: 'task', label: t('calendar.eventTypes.task', { defaultValue: 'Tarea' }) },
                    { value: 'workshop', label: t('calendar.eventTypes.workshop', { defaultValue: 'Taller' }) },
                    { value: 'other', label: t('calendar.eventTypes.other', { defaultValue: 'Otro' }) },
                ])
            }
        }
        loadEventTypes()
    }, [t])

    useEffect(() => {
        setExistingAttachments(selected.extendedProps?.attachments || [])
        setFiles([])
    }, [selected])

    const handleDialogClose = () => {
        dispatch(closeDialog())
    }

    const startDateTime = selected.start ? dayjs(selected.start) : dayjs()
    const endDateTime = selected.end
        ? dayjs(selected.end)
        : startDateTime.add(1, 'hour')

    const selectedAddress = selected.extendedProps?.address || emptyAddress
    const initialAddress: CalendarEventAddress = {
        ...emptyAddress,
        ...selectedAddress,
    }

    const initialEventTypeValue = selected.extendedProps?.type
        ? String(selected.extendedProps.type)
        : defaultEventType

    const initialValues: FormModel = {
        title: selected.title || '',
        detail: selected.extendedProps?.detail || '',
        startDate: startDateTime.toDate(),
        endDate: selected.end ? endDateTime.toDate() : endDateTime.toDate(),
        color: selected.eventColor || colorOptions[0].value,
        allDay: Boolean(selected.allDay),
        address: initialAddress,
        isInternal: Boolean(selected.extendedProps?.isInternal),
        customerId:
            selected.extendedProps?.customerId && !selected.extendedProps?.isInternal
                ? String(selected.extendedProps.customerId)
                : null,
        eventType: initialEventTypeValue,
        attachments: [],
    }

    const handleSubmit = (
        values: FormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        if (!values.startDate) {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('text.validation.startDateRequired')}
                </Notification>,
            )
            return
        }

        if (!values.endDate) {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('text.validation.endDateRequired', {
                        defaultValue: 'La fecha de fin es obligatoria',
                    })}
                </Notification>,
            )
            return
        }

        const attachments = [
            ...existingAttachments,
            ...mapFilesToAttachments(files),
        ]

        const addressPayload: CalendarEventAddress = {
            ...emptyAddress,
            ...(values.address || {}),
        }

        const locationLabel = formatAddressLabel(addressPayload)

        const typeLabel = values.isInternal
            ? 'internal'
            : values.eventType || defaultEventType

        const startMoment = dayjs(values.startDate)
        const endMomentCandidate = dayjs(values.endDate)

        const normalizedStart = values.allDay
            ? startMoment.hour(0).minute(0).second(0).millisecond(0)
            : startMoment

        let normalizedEnd = values.allDay
            ? endMomentCandidate
                  .hour(23)
                  .minute(59)
                  .second(0)
                  .millisecond(0)
            : endMomentCandidate

        if (normalizedEnd.isBefore(normalizedStart)) {
            normalizedEnd = values.allDay
                ? normalizedStart
                      .add(1, 'day')
                      .hour(23)
                      .minute(59)
                      .second(0)
                      .millisecond(0)
                : normalizedStart.add(1, 'hour')
        }

        const event: CalendarEvent = {
            id: selected.id || newId,
            title: values.title,
            start: normalizedStart.format(),
            end: normalizedEnd ? normalizedEnd.format() : undefined,
            allDay: values.allDay,
            eventColor: values.color,
            extendedProps: {
                ...selected.extendedProps,
                type: typeLabel,
                eventType: typeLabel,
                detail: values.detail,
                location: locationLabel,
                address: addressPayload,
                customerId: values.isInternal
                    ? undefined
                    : values.customerId || undefined,
                isInternal: values.isInternal,
                attachments,
            },
        }

        submit?.(event, selected.type)
        setSubmitting(false)
    }

    const removeAttachment = (id: string) => {
        setExistingAttachments((items) => items.filter((item) => item.id !== id))
    }

    return (
        <Dialog
            isOpen={open}
            onClose={handleDialogClose}
            onRequestClose={handleDialogClose}
            width={700}
            contentClassName="max-h-[90vh]"
        >
            <h5 className="mb-4">
                {selected.type === 'NEW'
                    ? t('text.titles.addEvent')
                    : t('text.titles.editEvent')}
            </h5>
            <Formik
                enableReinitialize
                initialValues={initialValues}
                validationSchema={useValidationSchema(t)}
                onSubmit={(values, helpers) => handleSubmit(values, helpers.setSubmitting)}
            >
                {({
                    values,
                    touched,
                    errors,
                    setFieldValue,
                    isSubmitting,
                }) => {
                    const normalizeAllDayStart = (date: dayjs.Dayjs) =>
                        date.hour(0).minute(0).second(0).millisecond(0)

                    const normalizeAllDayEnd = (date: dayjs.Dayjs) =>
                        date.hour(23).minute(59).second(0).millisecond(0)

                    const ensureEndAfterStart = (
                        start: dayjs.Dayjs,
                        end: dayjs.Dayjs | null,
                        allDay: boolean,
                    ) => {
                        if (!end) {
                            return allDay
                                ? normalizeAllDayEnd(start)
                                : start.add(1, 'hour')
                        }

                        let candidate = allDay
                            ? normalizeAllDayEnd(end)
                            : end

                        if (candidate.isBefore(start)) {
                            candidate = allDay
                                ? normalizeAllDayEnd(start.add(1, 'day'))
                                : start.add(1, 'hour')
                        }

                        return candidate
                    }

                    const handleAllDayToggle = (checked: boolean) => {
                        setFieldValue('allDay', checked)
                        const startBase = dayjs(values.startDate || new Date())
                        const normalizedStart = checked
                            ? normalizeAllDayStart(startBase)
                            : startBase
                                  .hour(9)
                                  .minute(0)
                                  .second(0)
                                  .millisecond(0)

                        const endBase = values.endDate
                            ? dayjs(values.endDate)
                            : normalizedStart.add(checked ? 1 : 1, checked ? 'day' : 'hour')

                        const normalizedEnd = ensureEndAfterStart(
                            normalizedStart,
                            endBase,
                            checked,
                        )

                        setFieldValue('startDate', normalizedStart.toDate())
                        setFieldValue('endDate', normalizedEnd.toDate())
                    }

                    const handleStartChange = (date: Date | null) => {
                        if (!date) {
                            return
                        }

                        const selectedStart = dayjs(date)
                        const normalizedStart = values.allDay
                            ? normalizeAllDayStart(selectedStart)
                            : selectedStart

                        const currentEnd = values.endDate
                            ? dayjs(values.endDate)
                            : null
                        const normalizedEnd = ensureEndAfterStart(
                            normalizedStart,
                            currentEnd,
                            values.allDay,
                        )

                        setFieldValue('startDate', normalizedStart.toDate())
                        setFieldValue('endDate', normalizedEnd.toDate())
                    }

                    const handleEndChange = (date: Date | null) => {
                        if (!date) {
                            return
                        }

                        const selectedEnd = dayjs(date)
                        const startValue = values.startDate
                            ? dayjs(values.startDate)
                            : dayjs(date)
                        const normalizedStart = values.allDay
                            ? normalizeAllDayStart(startValue)
                            : startValue

                        const normalizedEnd = ensureEndAfterStart(
                            normalizedStart,
                            selectedEnd,
                            values.allDay,
                        )

                        setFieldValue('endDate', normalizedEnd.toDate())
                    }

                    const handleCustomerChange = async (
                        option: CustomerOption | null,
                    ) => {
                        const customerId = option ? option.value : null
                        setFieldValue('customerId', customerId)

                        if (!customerId || values.isInternal) {
                            return
                        }

                        const cached = customerAddressesCache[customerId]
                        if (cached) {
                            setFieldValue('address', {
                                ...emptyAddress,
                                ...cached,
                            })
                            return
                        }

                        setLoadingAddress(true)
                        try {
                            const response = await apiGetCrmCustomerDetails<
                                {
                                    addresses?: Array<
                                        (CalendarEventAddress & {
                                            id?: number | string
                                            isPrimary?: boolean
                                        })
                                    >
                                },
                                { id: string }
                            >({ id: customerId })

                            const addresses =
                                response.data.addresses || ([] as Array<
                                    CalendarEventAddress & {
                                        isPrimary?: boolean
                                    }
                                >)

                            const primary =
                                addresses.find((addr) => addr.isPrimary) ||
                                addresses[0]

                            if (primary) {
                                const addressData: CalendarEventAddress = {
                                    street: primary.street || '',
                                    number: primary.number || '',
                                    corner: primary.corner || '',
                                    apartment: primary.apartment || '',
                                    city: primary.city || '',
                                    country: primary.country || '',
                                }

                                setCustomerAddressesCache((prev) => ({
                                    ...prev,
                                    [customerId]: addressData,
                                }))

                                setFieldValue('address', {
                                    ...emptyAddress,
                                    ...addressData,
                                })
                            }
                        } catch (error) {
                            toast.push(
                                <Notification
                                    type="warning"
                                    title={t('common.warning', {
                                        defaultValue: 'Aviso',
                                    })}
                                >
                                    {t('calendar.errors.customerAddress', {
                                        defaultValue:
                                            'No fue posible cargar la dirección del cliente.',
                                    })}
                                </Notification>,
                            )
                        } finally {
                            setLoadingAddress(false)
                        }
                    }

                    return (
                        <Form>
                            <div className="max-h-[68vh] overflow-y-auto pr-1">
                                <FormContainer>
                                    <FormItem
                                        label={t('text.labels.eventTitle')}
                                        invalid={Boolean(errors.title && touched.title)}
                                        errorMessage={errors.title}
                                    >
                                        <Field
                                            name="title"
                                            component={Input}
                                            placeholder={t('calendar.placeholders.title', {
                                                defaultValue: 'Título de la actividad',
                                            })}
                                        />
                                    </FormItem>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <FormItem
                                            label={t('calendar.fields.start', {
                                                defaultValue: 'Inicio',
                                            })}
                                            invalid={Boolean(
                                                errors.startDate && touched.startDate,
                                            )}
                                            errorMessage={errors.startDate as string}
                                        >
                                            {values.allDay ? (
                                                <DatePicker
                                                    value={values.startDate ?? undefined}
                                                    onChange={handleStartChange}
                                                    clearable={false}
                                                />
                                            ) : (
                                                <DatePicker.DateTimepicker
                                                    value={values.startDate ?? undefined}
                                                    onChange={handleStartChange}
                                                    clearable={false}
                                                />
                                            )}
                                        </FormItem>
                                        <FormItem
                                            label={t('calendar.fields.end', {
                                                defaultValue: 'Fin',
                                            })}
                                            invalid={Boolean(errors.endDate && touched.endDate)}
                                            errorMessage={errors.endDate as string}
                                        >
                                            {values.allDay ? (
                                                <DatePicker
                                                    value={values.endDate ?? undefined}
                                                    onChange={handleEndChange}
                                                    clearable={false}
                                                />
                                            ) : (
                                                <DatePicker.DateTimepicker
                                                    value={values.endDate ?? undefined}
                                                    onChange={handleEndChange}
                                                    clearable={false}
                                                />
                                            )}
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <FormItem label={t('calendar.fields.allDay', {
                                            defaultValue: 'Evento de todo el día',
                                        })}>
                                            <Switcher
                                                checked={values.allDay}
                                                onChange={handleAllDayToggle}
                                            />
                                        </FormItem>
                                        <FormItem label={t('calendar.fields.internal', {
                                            defaultValue: 'Evento interno',
                                        })}>
                                            <Switcher
                                                checked={values.isInternal}
                                                onChange={(checked) => {
                                                    setFieldValue('isInternal', checked)
                                                    if (checked) {
                                                        setFieldValue('customerId', null)
                                                        setFieldValue('address', {
                                                            ...emptyAddress,
                                                        })
                                                    }
                                                }}
                                            />
                                        </FormItem>
                                    </div>
                                    <FormItem
                                        label={t('calendar.fields.eventType', {
                                            defaultValue: 'Tipo de evento',
                                        })}
                                        invalid={Boolean(
                                            errors.eventType && touched.eventType,
                                        )}
                                        errorMessage={errors.eventType as string}
                                    >
                                        <Select
                                            value={
                                                eventTypeOptions.find(
                                                    (option) =>
                                                        option.value === values.eventType,
                                                ) || null
                                            }
                                            options={eventTypeOptions}
                                            isClearable={false}
                                            onChange={(option) =>
                                                setFieldValue(
                                                    'eventType',
                                                    option
                                                        ? (option as EventTypeOption).value
                                                        : '',
                                                )
                                            }
                                            placeholder={t(
                                                'calendar.placeholders.eventType',
                                                {
                                                    defaultValue:
                                                        'Selecciona el tipo de evento',
                                                },
                                            )}
                                            isLoading={eventTypeOptions.length === 0}
                                        />
                                    </FormItem>
                                    {!values.isInternal && (
                                        <FormItem
                                            label={t('calendar.fields.customer', {
                                                defaultValue: 'Cliente asociado (opcional)',
                                            })}
                                        >
                                            <Select
                                                value={
                                                    values.customerId
                                                        ? customerOptions.find(
                                                              (option) => option.value === values.customerId,
                                                          )
                                                        : null
                                                }
                                                options={customerOptions}
                                                isClearable
                                                isLoading={loadingAddress}
                                                onChange={(option) =>
                                                    handleCustomerChange(
                                                        option as CustomerOption | null,
                                                    )
                                                }
                                                placeholder={t('calendar.placeholders.customer', {
                                                    defaultValue: 'Seleccionar cliente',
                                                })}
                                            />
                                        </FormItem>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <FormItem
                                            label={t('calendar.fields.address.street', {
                                                defaultValue: 'Calle',
                                            })}
                                        >
                                            <Field
                                                name="address.street"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.street',
                                                    {
                                                        defaultValue: 'Ingresa la calle',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label={t('calendar.fields.address.number', {
                                                defaultValue: 'Número',
                                            })}
                                        >
                                            <Field
                                                name="address.number"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.number',
                                                    {
                                                        defaultValue: 'Número',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <FormItem
                                            label={t('calendar.fields.address.city', {
                                                defaultValue: 'Ciudad',
                                            })}
                                        >
                                            <Field
                                                name="address.city"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.city',
                                                    {
                                                        defaultValue: 'Ciudad',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label={t('calendar.fields.address.country', {
                                                defaultValue: 'País',
                                            })}
                                        >
                                            <Field
                                                name="address.country"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.country',
                                                    {
                                                        defaultValue: 'País',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <FormItem
                                            label={t('calendar.fields.address.corner', {
                                                defaultValue: 'Esquina',
                                            })}
                                        >
                                            <Field
                                                name="address.corner"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.corner',
                                                    {
                                                        defaultValue: 'Esquina',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label={t('calendar.fields.address.apartment', {
                                                defaultValue: 'Apartamento',
                                            })}
                                        >
                                            <Field
                                                name="address.apartment"
                                                component={Input}
                                                placeholder={t(
                                                    'calendar.placeholders.apartment',
                                                    {
                                                        defaultValue: 'Apartamento / Unidad',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                    </div>
                                    <FormItem
                                        label={t('calendar.fields.description', {
                                            defaultValue: 'Descripción',
                                        })}
                                        invalid={Boolean(errors.detail && touched.detail)}
                                        errorMessage={errors.detail}
                                    >
                                        <Field
                                            name="detail"
                                            as={Input}
                                            textArea
                                            rows={4}
                                            placeholder={t('calendar.placeholders.description', {
                                                defaultValue: 'Detalles, objetivos o agenda de la actividad',
                                            })}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('calendar.fields.color', {
                                            defaultValue: 'Color del evento',
                                        })}
                                        invalid={Boolean(errors.color && touched.color)}
                                        errorMessage={errors.color}
                                    >
                                        <Select
                                            value={colorOptions.find(
                                                (option) => option.value === values.color,
                                            )}
                                            onChange={(option) =>
                                                setFieldValue(
                                                    'color',
                                                    (option as ColorOption).value,
                                                )
                                            }
                                            options={colorOptions}
                                            components={{
                                                Option: CustomSelectOption,
                                                Control: CustomControl,
                                            }}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('text.titles.attachments', {
                                            defaultValue: 'Adjuntos',
                                        })}
                                    >
                                        <Upload
                                            multiple
                                            fileList={files}
                                            onChange={(newFiles) => {
                                                setFiles(newFiles)
                                                setFieldValue('attachments', newFiles)
                                            }}
                                            onFileRemove={(updated) => {
                                                setFiles(updated)
                                                setFieldValue('attachments', updated)
                                            }}
                                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip"
                                            tip={t('calendar.attachments.supported', {
                                                defaultValue:
                                                    'Formatos soportados: imágenes y documentos (pdf, doc, xls, csv, txt, zip).',
                                            })}
                                        />
                                        {existingAttachments.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {existingAttachments.map((attachment) => (
                                                    <div
                                                        key={attachment.id}
                                                        className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
                                                    >
                                                        <div className="truncate">
                                                            <p className="font-semibold truncate">
                                                                {attachment.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-300">
                                                                {attachment.type || 'Archivo'} ·{' '}
                                                                {attachment.size
                                                                    ? `${Math.round(attachment.size / 1024)} KB`
                                                                    : t('calendar.attachments.unknownSize', {
                                                                          defaultValue:
                                                                              'Tamaño desconocido',
                                                                      })}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="xs"
                                                            variant="plain"
                                                            icon={<HiOutlineTrash />}
                                                            onClick={() => removeAttachment(attachment.id)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </FormItem>
                                </FormContainer>
                            </div>
                            <div className="mt-4 text-right">
                                <Button
                                    type="button"
                                    className="ltr:mr-2 rtl:ml-2"
                                    onClick={handleDialogClose}
                                >
                                    {t('text.actions.cancel')}
                                </Button>
                                <Button
                                    variant="solid"
                                    type="submit"
                                    loading={isSubmitting || loading}
                                >
                                    {selected.type === 'NEW'
                                        ? t('text.actions.add')
                                        : t('text.actions.save')}
                                </Button>
                            </div>
                        </Form>
                    )
                }}
            </Formik>
        </Dialog>
    )
}

export default EventDialog
