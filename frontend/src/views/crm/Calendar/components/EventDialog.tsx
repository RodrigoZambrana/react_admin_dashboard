import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Dialog from '@/components/ui/Dialog'
import Switcher from '@/components/ui/Switcher'
import Upload from '@/components/ui/Upload'
import { FormContainer, FormItem } from '@/components/ui/Form'
import hooks from '@/components/ui/hooks'
import {
    closeDialog,
    useAppDispatch,
    useAppSelector,
    CalendarEvent,
    CalendarEventAttachment,
} from '../store'
import { Field, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { HiOutlineDownload, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi'
import {
    apiGetCustomers,
    apiGetCustomerDetails,
    type CalendarEventAddress,
} from '@/services/CustomersService'
import CountryCitySelector, {
    type CountryCityValue,
} from '@/components/shared/CountryCitySelector'
import { apiGetCalendarEventTypes } from '@/services/SettingsService'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { apiFetchCalendarAttachment } from '@/services/CalendarService'

const { useUniqueId } = hooks

type CustomerOption = {
    value: string
    label: string
    email?: string
}

type EventTypeOption = {
    value: string
    label: string
    color: string
}

type FormModel = {
    title: string
    detail: string
    startDate: Date | null
    endDate: Date | null
    allDay: boolean
    address: CalendarEventAddress
    isInternal: boolean
    customerId: string | null
    eventTypeId: string
    attachments: File[]
}

type EventDialogProps = {
    submit: (eventData: CalendarEvent, type: string) => void
    onDelete?: (id: string) => Promise<unknown> | unknown
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
        eventTypeId: Yup.string().required(
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
    countryCode: '',
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

const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const { result } = reader
            if (typeof result === 'string') {
                const base64 = result.includes(',') ? result.split(',').pop() || '' : result
                resolve(base64)
                return
            }
            if (result instanceof ArrayBuffer) {
                const bytes = new Uint8Array(result)
                let binary = ''
                bytes.forEach((byte) => {
                    binary += String.fromCharCode(byte)
                })
                resolve(window.btoa(binary))
                return
            }
            resolve('')
        }
        reader.onerror = () => reject(reader.error || new Error('no-file'))
        reader.readAsDataURL(file)
    })

const mapFilesToAttachments = async (
    files: File[],
): Promise<CalendarEventAttachment[]> => {
    if (!files.length) {
        return []
    }
    const timestamp = Date.now()
    const mapped = await Promise.all(
        files.map(async (file, index) => {
            try {
                const content = await readFileAsBase64(file)
                return {
                    id: `file-${timestamp}-${index}`,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content,
                } satisfies CalendarEventAttachment
            } catch (error) {
                return {
                    id: `file-${timestamp}-${index}`,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                } satisfies CalendarEventAttachment
            }
        }),
    )
    return mapped.filter(Boolean)
}

const decodeBase64ToBlob = (base64: string, mimeType?: string) => {
    if (typeof window === 'undefined') {
        return new Blob()
    }
    const normalized = base64.includes(',') ? base64.split(',').pop() || '' : base64
    const binaryString = window.atob(normalized)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

const createBlobUrl = (blob: Blob) => {
    if (typeof window === 'undefined') {
        return ''
    }
    return URL.createObjectURL(blob)
}

const EventDialog = ({ submit, onDelete }: EventDialogProps) => {
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
    const [deleting, setDeleting] = useState(false)
    const defaultEventType = useMemo(
        () => eventTypeOptions[0],
        [eventTypeOptions],
    )

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const response = await apiGetCustomers<{
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
                    { id: number; name: string; color?: string }[]
                >()
                const list = Array.isArray(response.data)
                    ? response.data
                          .filter((item) => item && item.id && item.name)
                          .map((item) => ({
                              value: String(item.id),
                              label: item.name,
                              color: item.color || '#2563eb',
                          }))
                    : []
                if (list.length) {
                    setEventTypeOptions(list)
                    return
                }
            } catch (error) {
                toast.push(
                    <Notification type="warning" title={t('common.warning', { defaultValue: 'Aviso' })}>
                        {t('settings.calendarEventTypes.loadError', {
                            defaultValue:
                                'No fue posible cargar los tipos actuales. Se muestran los valores por defecto.',
                        })}
                    </Notification>,
                )
            }
            const fallback: EventTypeOption[] = [
                {
                    value: 'meeting',
                    label: t('calendar.eventTypes.meeting', {
                        defaultValue: 'Reunión',
                    }),
                    color: '#2563eb',
                },
                {
                    value: 'task',
                    label: t('calendar.eventTypes.task', {
                        defaultValue: 'Tarea',
                    }),
                    color: '#059669',
                },
                {
                    value: 'workshop',
                    label: t('calendar.eventTypes.workshop', {
                        defaultValue: 'Taller',
                    }),
                    color: '#7c3aed',
                },
                {
                    value: 'other',
                    label: t('calendar.eventTypes.other', {
                        defaultValue: 'Otro',
                    }),
                    color: '#6b7280',
                },
            ]
            setEventTypeOptions(fallback)
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
        country: selectedAddress?.country || '',
        countryCode: selectedAddress?.countryCode || '',
        city: selectedAddress?.city || '',
        street: selectedAddress?.street || '',
        number: selectedAddress?.number || '',
        corner: selectedAddress?.corner || '',
        apartment: selectedAddress?.apartment || '',
    }

    const resolvedEventTypeId = useMemo(() => {
        const selectedId =
            (selected.extendedProps?.eventTypeId as string | undefined) ??
            (selected.eventTypeId ? String(selected.eventTypeId) : undefined)
        if (selectedId) {
            return selectedId
        }
        const labelFromSelection =
            (selected.extendedProps?.eventType as string | undefined) ??
            (selected.extendedProps?.type as string | undefined) ??
            ''
        if (labelFromSelection && eventTypeOptions.length) {
            const normalized = labelFromSelection.toLowerCase()
            const match = eventTypeOptions.find(
                (option) =>
                    option.value === labelFromSelection ||
                    option.label.toLowerCase() === normalized,
            )
            if (match) {
                return match.value
            }
        }
        return defaultEventType?.value || ''
    }, [defaultEventType, eventTypeOptions, selected])

    const initialValues: FormModel = {
        title: selected.title || '',
        detail: selected.extendedProps?.detail || '',
        startDate: startDateTime.toDate(),
        endDate: selected.end ? endDateTime.toDate() : endDateTime.toDate(),
        allDay: Boolean(selected.allDay),
        address: initialAddress,
        isInternal: Boolean(selected.extendedProps?.isInternal),
        customerId:
            selected.extendedProps?.customerId && !selected.extendedProps?.isInternal
                ? String(selected.extendedProps.customerId)
                : null,
        eventTypeId: resolvedEventTypeId,
        attachments: [],
    }

    const handleSubmit = async (
        values: FormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        setSubmitting(true)
        if (!values.startDate) {
            toast.push(
                <Notification type="danger" title={t('common.error', { defaultValue: 'Error' })}>
                    {t('text.validation.startDateRequired')}
                </Notification>,
            )
            setSubmitting(false)
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
            setSubmitting(false)
            return
        }

        try {
            const newAttachments = await mapFilesToAttachments(files)
            const persistedAttachments = existingAttachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
            }))

            const attachments: CalendarEventAttachment[] = [
                ...persistedAttachments,
                ...newAttachments,
            ]

        const addressPayload: CalendarEventAddress = {
            ...emptyAddress,
            ...(values.address || {}),
        }

        const locationLabel = formatAddressLabel(addressPayload)

        const selectedTypeOption =
            eventTypeOptions.find((option) => option.value === values.eventTypeId) ||
            defaultEventType

        const eventColor =
            selectedTypeOption?.color || selected.eventColor || '#2563eb'

        const typeLabel = values.isInternal
            ? 'internal'
            : selectedTypeOption?.label || defaultEventType?.label || 'Evento'

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
                eventColor,
                eventTypeId: selectedTypeOption?.value,
                extendedProps: {
                    ...selected.extendedProps,
                    type: typeLabel,
                    eventType: selectedTypeOption?.label || typeLabel,
                    eventTypeId: selectedTypeOption?.value,
                    eventTypeName: selectedTypeOption?.label || typeLabel,
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
        } finally {
            setSubmitting(false)
        }
    }

    const readAttachmentBlob = async (
        attachment: CalendarEventAttachment,
        mode: 'inline' | 'attachment',
    ) => {
        try {
            const response = await apiFetchCalendarAttachment(String(attachment.id), { mode })
            return response.data
        } catch (error) {
            if (attachment.content) {
                return decodeBase64ToBlob(attachment.content, attachment.type)
            }
            toast.push(
                <Notification
                    type="danger"
                    title={t('common.error', { defaultValue: 'Error' })}
                >
                    {t('calendar.attachments.downloadFailed', {
                        defaultValue: 'No se pudo obtener el archivo adjunto.',
                    })}
                </Notification>,
            )
            return null
        }
    }

    const handleViewAttachment = async (attachment: CalendarEventAttachment) => {
        if (typeof window === 'undefined') {
            return
        }
        const blob = await readAttachmentBlob(attachment, 'inline')
        if (!blob) {
            return
        }
        const blobUrl = createBlobUrl(blob)
        if (!blobUrl) {
            return
        }
        window.open(blobUrl, '_blank', 'noopener')
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl)
        }, 10_000)
    }

    const handleDownloadAttachment = async (attachment: CalendarEventAttachment) => {
        if (typeof window === 'undefined') {
            return
        }
        const blob = await readAttachmentBlob(attachment, 'attachment')
        if (!blob) {
            return
        }
        const blobUrl = createBlobUrl(blob)
        if (!blobUrl) {
            return
        }
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = attachment.name || 'attachment'
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
    }

    const confirmRemoveAttachment = (attachment: CalendarEventAttachment) => {
        let toastKey: string | undefined

        const closeToast = () => {
            if (toastKey) {
                toast.remove(toastKey)
            }
        }

        const handleConfirm = () => {
            closeToast()
            setExistingAttachments((items) => items.filter((item) => item.id !== attachment.id))
        }

        const handleCancel = () => {
            closeToast()
        }

        const message = t('calendar.attachments.confirmDelete', {
            defaultValue: '¿Deseas eliminar el archivo {{name}}?',
            name: attachment.name ||
                t('calendar.attachments.unnamed', {
                    defaultValue: 'Archivo sin nombre',
                }),
        })

        const notification = (
            <Notification
                type="warning"
                title={t('common.confirmation', { defaultValue: 'Confirmación' })}
                duration={0}
                closable
            >
                <div className="space-y-3">
                    <p>{message}</p>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="plain" onClick={handleCancel}>
                            {t('text.actions.cancel', { defaultValue: 'Cancelar' })}
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            color="red"
                            onClick={handleConfirm}
                        >
                            {t('text.actions.delete', { defaultValue: 'Eliminar' })}
                        </Button>
                    </div>
                </div>
            </Notification>
        )

        const keyOrPromise = toast.push(notification, {
            placement: 'top-center',
            duration: 0,
        })

        if (keyOrPromise instanceof Promise) {
            keyOrPromise.then((key) => {
                toastKey = key
            })
        } else {
            toastKey = keyOrPromise
        }
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
                onSubmit={async (values, helpers) => {
                    await handleSubmit(values, helpers.setSubmitting)
                }}
            >
                {({
                    values,
                    touched,
                    errors,
                    setFieldValue,
                    setFieldTouched,
                    setSubmitting,
                    isSubmitting,
                }) => {
                    const addressCountryError = getIn(
                        errors,
                        'address.country',
                    ) as string | undefined
                    const addressCityError = getIn(
                        errors,
                        'address.city',
                    ) as string | undefined
                    const addressCountryTouched = getIn(
                        touched,
                        'address.country',
                    )
                    const addressCityTouched = getIn(
                        touched,
                        'address.city',
                    )
                    const showAddressError = Boolean(
                        (addressCountryTouched && addressCountryError) ||
                            (addressCityTouched && addressCityError),
                    )
                    const addressErrorMessage =
                        (addressCountryTouched && addressCountryError
                            ? addressCountryError
                            : undefined) ??
                        (addressCityTouched && addressCityError
                            ? addressCityError
                            : undefined) ??
                        addressCityError ??
                        addressCountryError

                    const handleAddressLocationChange = (
                        next: CountryCityValue,
                    ) => {
                        const countryName = next.countryName ?? ''
                        const cityValue = next.city ?? ''
                        const countryCode = next.countryCode ?? ''

                        setFieldValue('address.country', countryName)
                        setFieldValue('address.city', cityValue)
                        setFieldValue('address.countryCode', countryCode)
                        setFieldTouched('address.country', true, false)
                        if (next.city !== undefined) {
                            setFieldTouched('address.city', true, false)
                        }
                    }

                    const selectedEventTypeOption =
                        eventTypeOptions.find(
                            (option) => option.value === values.eventTypeId,
                        ) || null

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
                            const response = await apiGetCustomerDetails<
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
                                    countryCode: primary.countryCode || '',
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

                    const handleDeleteEvent = async () => {
                        if (!selected.id || !onDelete) {
                            return
                        }
                        const message = t('calendar.confirmDelete', {
                            defaultValue:
                                '¿Eliminar este evento? Esta acción no se puede deshacer.',
                        })
                        const confirmed =
                            typeof window === 'undefined'
                                ? true
                                : window.confirm(message)
                        if (!confirmed) {
                            return
                        }
                        try {
                            setDeleting(true)
                            setSubmitting(true)
                            await onDelete(String(selected.id))
                            toast.push(
                                <Notification
                                    type="success"
                                    title={t('common.success', {
                                        defaultValue: 'Éxito',
                                    })}
                                >
                                    {t('calendar.messages.eventDeleted', {
                                        defaultValue:
                                            'Evento eliminado correctamente.',
                                    })}
                                </Notification>,
                            )
                        } catch (error) {
                            toast.push(
                                <Notification
                                    type="danger"
                                    title={t('common.error', {
                                        defaultValue: 'Error',
                                    })}
                                >
                                    {t('calendar.errors.deleteFailed', {
                                        defaultValue:
                                            'No fue posible eliminar el evento.',
                                    })}
                                </Notification>,
                            )
                        } finally {
                            setDeleting(false)
                            setSubmitting(false)
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
                                            errors.eventTypeId && touched.eventTypeId,
                                        )}
                                        errorMessage={errors.eventTypeId as string}
                                    >
                                        <Select
                                            value={
                                                selectedEventTypeOption
                                            }
                                            options={eventTypeOptions}
                                            isClearable={false}
                                            onChange={(option) =>
                                                setFieldValue(
                                                    'eventTypeId',
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
                                            formatOptionLabel={(option) => (
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-3 w-3 rounded-full border border-gray-300 dark:border-gray-500"
                                                        style={{
                                                            backgroundColor:
                                                                option.color,
                                                        }}
                                                    />
                                                    <span>{option.label}</span>
                                                </div>
                                            )}
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
                                    <FormItem
                                        label={t(
                                            'calendar.fields.address.countryCity',
                                            {
                                                defaultValue: 'País y ciudad',
                                            },
                                        )}
                                        invalid={showAddressError}
                                        errorMessage={addressErrorMessage}
                                    >
                                        <CountryCitySelector
                                            value={{
                                                countryCode:
                                                    values.address.countryCode,
                                                countryName: values.address.country,
                                                city: values.address.city,
                                            }}
                                            onChange={handleAddressLocationChange}
                                            countryPlaceholder={t(
                                                'calendar.placeholders.country',
                                                {
                                                    defaultValue: 'País',
                                                },
                                            )}
                                            cityPlaceholder={t(
                                                'calendar.placeholders.city',
                                                {
                                                    defaultValue: 'Ciudad',
                                                },
                                            )}
                                        />
                                    </FormItem>
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
                                                        <div className="min-w-0">
                                                            <p className="font-semibold truncate">
                                                                {attachment.name ||
                                                                    t(
                                                                        'calendar.attachments.unnamed',
                                                                        {
                                                                            defaultValue:
                                                                                'Archivo sin nombre',
                                                                        },
                                                                    )}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                                                                {(attachment.type || 'Archivo') +
                                                                    (attachment.size
                                                                        ? ` · ${Math.round(
                                                                              (attachment.size || 0) /
                                                                                  1024,
                                                                          )} KB`
                                                                        : ` · ${t(
                                                                              'calendar.attachments.unknownSize',
                                                                              {
                                                                                  defaultValue:
                                                                                      'Tamaño desconocido',
                                                                              },
                                                                          )}`)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="xs"
                                                                variant="plain"
                                                                icon={<HiOutlineEye />}
                                                                onClick={() =>
                                                                    handleViewAttachment(attachment)
                                                                }
                                                                aria-label={t(
                                                                    'text.actions.view',
                                                                    {
                                                                        defaultValue: 'Ver',
                                                                    },
                                                                )}
                                                            />
                                                            <Button
                                                                size="xs"
                                                                variant="plain"
                                                                icon={<HiOutlineDownload />}
                                                                onClick={() =>
                                                                    handleDownloadAttachment(
                                                                        attachment,
                                                                    )
                                                                }
                                                                aria-label={t(
                                                                    'text.actions.download',
                                                                    {
                                                                        defaultValue: 'Descargar',
                                                                    },
                                                                )}
                                                            />
                                                            <Button
                                                                size="xs"
                                                                variant="plain"
                                                                icon={<HiOutlineTrash />}
                                                                onClick={() =>
                                                                    confirmRemoveAttachment(
                                                                        attachment,
                                                                    )
                                                                }
                                                                aria-label={t(
                                                                    'text.actions.delete',
                                                                    {
                                                                        defaultValue: 'Eliminar',
                                                                    },
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </FormItem>
                                </FormContainer>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                                {selected.type === 'EDIT' &&
                                    selected.id &&
                                    onDelete && (
                                        <Button
                                            type="button"
                                            variant="solid"
                                            color="red-600"
                                            icon={<HiOutlineTrash />}
                                            className="ltr:mr-auto rtl:ml-auto"
                                            loading={deleting}
                                            disabled={loading || isSubmitting || deleting}
                                            onClick={handleDeleteEvent}
                                        >
                                            {t('text.actions.delete')}
                                        </Button>
                                    )}
                                <Button type="button" onClick={handleDialogClose}>
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
