import { useEffect, useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { NumericFormat, NumericFormatProps } from 'react-number-format'
import { useTranslation } from 'react-i18next'
import { apiGetProductStatuses } from '@/services/SettingsService'
import type { ComponentType } from 'react'

const deriveStatus = (stock: number, permanent: boolean) => {
    if (permanent) {
        return 0
    }
    if (stock <= 0) {
        return 2
    }
    if (stock < 5) {
        return 1
    }
    return 0
}

type FormFieldsName = {
    status: number
    published?: boolean
    stock: number
    permanentStock?: boolean
}

type PublicationFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    values: {
        status: number
        published?: boolean
        stock: number
        permanentStock?: boolean
    }
    setFieldValue: (field: string, value: unknown) => void
}

const NumericFormatInput = ({
    onValueChange,
    ...rest
}: Omit<NumericFormatProps, 'form'> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: any
    field: FieldProps['field']
}) => {
    return (
        <NumericFormat
            customInput={Input as ComponentType}
            type="text"
            autoComplete="off"
            allowNegative={false}
            onValueChange={onValueChange}
            {...rest}
        />
    )
}

const PublicationFields = ({
    touched,
    errors,
    values,
    setFieldValue,
}: PublicationFieldsProps) => {
    const { t } = useTranslation()

    const permanentStockEnabled = Boolean(values.permanentStock)

    const [statusOptions, setStatusOptions] = useState(
        () => [
            { value: 0, label: t('text.status.inStock') },
            { value: 1, label: t('text.status.limited') },
            { value: 2, label: t('text.status.outOfStock') },
        ],
    )

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiGetProductStatuses<
                    { id: number | string; code?: number | string; name: string; color?: string }[]
                >()
                const opts = (res.data as any[]).map((s) => ({
                    value: s.code !== undefined ? Number(s.code) : Number(s.id),
                    label: s.name,
                    color: (s as any).color,
                }))
                if (opts.length) {
                    setStatusOptions(opts)
                }
            } catch {
                // ignore
            }
        }
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const numericStock = Number(values.stock ?? 0)
        const computed = deriveStatus(
            Number.isNaN(numericStock) ? 0 : numericStock,
            permanentStockEnabled,
        )
        if (computed !== values.status) {
            setFieldValue('status', computed)
        }
    }, [values.stock, permanentStockEnabled, values.status, setFieldValue])

    const selectedStatus =
        statusOptions.find((opt) => Number(opt.value) === Number(values.status)) ||
        {
            value: values.status,
            label: values.status,
        }

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.columns.stock')}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem label={t('text.status.published')}>
                        <Field name="published">
                            {({ field, form }: FieldProps) => (
                                <Switcher
                                    defaultChecked={
                                        typeof values.published === 'boolean'
                                            ? (values.published as boolean)
                                            : true
                                    }
                                    onChange={(checked) =>
                                        form.setFieldValue(field.name, checked)
                                    }
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
                <div className="col-span-1">
                    <FormItem label={t('text.labels.permanentStock')}>
                        <Field name="permanentStock">
                            {({ field }: FieldProps) => (
                                <Switcher
                                    checked={Boolean(field.value)}
                                    onChange={(checked) => {
                                        setFieldValue(field.name, checked)
                                        const numericStock = Number(values.stock ?? 0)
                                        const status = deriveStatus(
                                            Number.isNaN(numericStock)
                                                ? 0
                                                : numericStock,
                                            checked,
                                        )
                                        setFieldValue('status', status)
                                    }}
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.columns.quantity')}
                        invalid={(errors.stock && touched.stock) as boolean}
                        errorMessage={errors.stock as string}
                    >
                        <Field name="stock">
                            {({ field, form }: FieldProps) => (
                                <NumericFormatInput
                                    form={form}
                                    field={field}
                                    value={field.value}
                                    placeholder={t('text.columns.quantity')}
                                    onValueChange={(val) =>
                                        form.setFieldValue(field.name, val.value)
                                    }
                                    disabled={permanentStockEnabled}
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.stockStatus')}
                        invalid={(errors.status && touched.status) as boolean}
                        errorMessage={errors.status as string}
                    >
                        <Select
                            isDisabled
                            isSearchable={false}
                            options={statusOptions as any}
                            value={selectedStatus as any}
                            components={{ IndicatorSeparator: () => null }}
                        />
                    </FormItem>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default PublicationFields
