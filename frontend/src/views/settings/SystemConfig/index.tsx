import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Loading from '@/components/shared/Loading'
import { apiGetSystemConfig, apiUpdateSystemConfig } from '@/services/SettingsService'

const SystemConfig = () => {
    const { t } = useTranslation()
    const [initial, setInitial] = useState<{ taxRate: number }>({ taxRate: 22 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiGetSystemConfig<{ taxRate?: number }>()
                const value = Number((res.data as any)?.taxRate)
                setInitial({ taxRate: Number.isNaN(value) ? 22 : value })
            } catch {
                setInitial({ taxRate: 22 })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <Loading loading={loading}>
            <Card>
                <h3 className="mb-2">{t('settings.systemConfig.title')}</h3>
                <p className="mb-6 text-sm opacity-70">
                    {t('settings.systemConfig.desc')}
                </p>
                <Formik
                    enableReinitialize
                    initialValues={initial}
                    validationSchema={Yup.object().shape({
                        taxRate: Yup.number()
                            .typeError(t('settings.systemConfig.taxRateLabel'))
                            .min(0, t('validation.fieldInvalid', { field: t('settings.systemConfig.taxRateLabel') }))
                            .max(100, t('validation.fieldInvalid', { field: t('settings.systemConfig.taxRateLabel') }))
                            .required(t('settings.systemConfig.taxRateLabel')),
                    })}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            await apiUpdateSystemConfig<boolean, { taxRate: number }>({ taxRate: values.taxRate })
                            toast.push(
                                <Notification title={t('settings.systemConfig.updated.title')} type="success">
                                    {t('settings.systemConfig.updated.desc')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            setInitial(values)
                        } catch (e: any) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {e?.response?.data?.message || e?.message || String(e)}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ touched, errors, isSubmitting, setFieldValue }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t('settings.systemConfig.taxRateLabel')}
                                    invalid={touched.taxRate && !!errors.taxRate}
                                    errorMessage={errors.taxRate}
                                >
                                    <Field name="taxRate">
                                        {({ field }: { field: any }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.01"
                                                value={field.value}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setFieldValue(
                                                        field.name,
                                                        value === '' ? '' : Number(value),
                                                    )
                                                }}
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                                <div>
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

export default SystemConfig
