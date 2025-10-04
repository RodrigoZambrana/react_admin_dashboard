import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Formik, Form, FieldArray, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Loading from '@/components/shared/Loading'
import {
    apiGetCalendarEventTypes,
    apiUpdateCalendarEventTypes,
} from '@/services/SettingsService'
import { HiOutlineTrash } from 'react-icons/hi'

const MIN_TYPES = 1

const buildValidationSchema = (
    t: (key: string, opts?: Record<string, unknown>) => string,
) =>
    Yup.object().shape({
        types: Yup.array()
            .of(
                Yup.object().shape({
                    key: Yup.string()
                        .trim()
                        .matches(/^[a-z0-9\-_.]+$/i, {
                            message: t('settings.calendarEventTypes.validation.keyFormat', {
                                defaultValue:
                                    'La clave solo puede incluir letras, números, guiones y puntos.',
                            }),
                        })
                        .required(
                            t('settings.calendarEventTypes.validation.keyRequired', {
                                defaultValue: 'La clave es obligatoria',
                            }),
                        ),
                    label: Yup.string()
                        .trim()
                        .required(
                            t('settings.calendarEventTypes.validation.labelRequired', {
                                defaultValue: 'El nombre visible es obligatorio',
                            }),
                        ),
                }),
            )
            .test(
                'unique-keys',
                t('settings.calendarEventTypes.validation.uniqueKeys', {
                    defaultValue: 'Las claves deben ser únicas.',
                }),
                (value) => {
                    if (!value) {
                        return false
                    }
                    const keys = value.map((item) => (item.key || '').trim().toLowerCase())
                    return new Set(keys).size === keys.length
                },
            )
            .min(
                MIN_TYPES,
                t('settings.calendarEventTypes.validation.minItems', {
                    defaultValue: 'Debes definir al menos un tipo de evento.',
                }),
            ),
    })

const CalendarEventTypes = () => {
    const { t } = useTranslation()
    const [initialValues, setInitialValues] = useState({
        types: [
            { key: 'meeting', label: t('calendar.eventTypes.meeting', { defaultValue: 'Reunión' }) },
            { key: 'task', label: t('calendar.eventTypes.task', { defaultValue: 'Tarea' }) },
            { key: 'workshop', label: t('calendar.eventTypes.workshop', { defaultValue: 'Taller' }) },
            { key: 'other', label: t('calendar.eventTypes.other', { defaultValue: 'Otro' }) },
        ],
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadTypes = async () => {
            try {
                const response = await apiGetCalendarEventTypes<
                    { key: string; label: string }[]
                >()
                const list = Array.isArray(response.data)
                    ? response.data.filter((item) => item && item.key && item.label)
                    : []
                if (list.length > 0) {
                    setInitialValues({ types: list })
                }
            } catch (error) {
                toast.push(
                    <Notification
                        type="warning"
                        title={t('common.warning', { defaultValue: 'Aviso' })}
                    >
                        {t('settings.calendarEventTypes.loadError', {
                            defaultValue:
                                'No fue posible cargar los tipos actuales. Se muestran los valores por defecto.',
                        })}
                    </Notification>,
                )
            } finally {
                setLoading(false)
            }
        }
        loadTypes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Loading loading={loading}>
            <Card>
                <h3 className="mb-2">
                    {t('settings.calendarEventTypes.title', {
                        defaultValue: 'Tipos de evento del calendario',
                    })}
                </h3>
                <p className="mb-6 text-sm opacity-70">
                    {t('settings.calendarEventTypes.subtitle', {
                        defaultValue: 'Configura las opciones disponibles al crear o editar eventos.',
                    })}
                </p>
                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    validationSchema={buildValidationSchema(t)}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            await apiUpdateCalendarEventTypes<boolean, typeof values>(values)
                            setInitialValues(values)
                            toast.push(
                                <Notification
                                    type="success"
                                    title={t('common.success', { defaultValue: 'Éxito' })}
                                >
                                    {t('settings.calendarEventTypes.updated', {
                                        defaultValue: 'Tipos de evento actualizados correctamente.',
                                    })}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        } catch (error: any) {
                            toast.push(
                                <Notification
                                    type="danger"
                                    title={t('validation.failed', { defaultValue: 'Error' })}
                                >
                                    {error?.response?.data?.message || error?.message || String(error)}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ values, errors, touched, isSubmitting }) => (
                        <Form>
                            <FormContainer>
                                <FieldArray name="types">
                                    {({ remove, push }) => (
                                        <div className="space-y-4">
                                            {values.types.map((type, index) => {
                                                const keyError = Boolean(
                                                    (errors.types as Array<any>)?.[index]?.key &&
                                                        (touched.types as Array<any>)?.[index]?.key,
                                                )
                                                const labelError = Boolean(
                                                    (errors.types as Array<any>)?.[index]?.label &&
                                                        (touched.types as Array<any>)?.[index]?.label,
                                                )
                                                return (
                                                    <div
                                                        key={`event-type-${index}`}
                                                        className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                                                    >
                                                        <FormItem
                                                            className="md:col-span-2"
                                                            label={t('settings.calendarEventTypes.fields.key', {
                                                                defaultValue: 'Clave interna',
                                                            })}
                                                            invalid={keyError}
                                                            errorMessage={
                                                                (errors.types as Array<any>)?.[index]?.key as string
                                                            }
                                                        >
                                                            <Field
                                                                name={`types.${index}.key`}
                                                                component={Input}
                                                                placeholder={t(
                                                                    'settings.calendarEventTypes.placeholders.key',
                                                                    {
                                                                        defaultValue:
                                                                            'Ej: meeting, standup, workshop',
                                                                    },
                                                                )}
                                                            />
                                                        </FormItem>
                                                        <FormItem
                                                            className="md:col-span-3"
                                                            label={t('settings.calendarEventTypes.fields.label', {
                                                                defaultValue: 'Nombre visible',
                                                            })}
                                                            invalid={labelError}
                                                            errorMessage={
                                                                (errors.types as Array<any>)?.[index]?.label as string
                                                            }
                                                        >
                                                            <Field
                                                                name={`types.${index}.label`}
                                                                component={Input}
                                                                placeholder={t(
                                                                    'settings.calendarEventTypes.placeholders.label',
                                                                    {
                                                                        defaultValue:
                                                                            'Nombre que verá el usuario',
                                                                    },
                                                                )}
                                                            />
                                                        </FormItem>
                                                        <div className="flex justify-end md:justify-center">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="plain"
                                                                icon={<HiOutlineTrash />}
                                                                disabled={values.types.length <= MIN_TYPES}
                                                                onClick={() => remove(index)}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            <Button
                                                type="button"
                                                variant="twoTone"
                                                onClick={() => push({ key: '', label: '' })}
                                            >
                                                {t('settings.calendarEventTypes.actions.add', {
                                                    defaultValue: 'Agregar tipo',
                                                })}
                                            </Button>
                                        </div>
                                    )}
                                </FieldArray>
                                <div className="flex justify-end">
                                    <Button type="submit" variant="solid" loading={isSubmitting}>
                                        {t('text.actions.save')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </Card>
        </Loading>
    )
}

export default CalendarEventTypes
