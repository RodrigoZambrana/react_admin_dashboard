import { useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import InputGroup from '@/components/ui/InputGroup'
import CurrencySelector from '@/components/shared/CurrencySelector'
import { NumericFormat, NumericFormatProps } from 'react-number-format'
import {
    Field,
    FormikErrors,
    FormikTouched,
    FieldProps,
    FieldInputProps,
} from 'formik'
import type { ComponentType } from 'react'
import type { InputProps } from '@/components/ui/Input'
import type { CurrencyCode } from '@/store'
import { useTranslation } from 'react-i18next'

type FormFieldsName = {
    costPrice: number
    salePrice: number
    bulkDiscountPrice: number
    currency: CurrencyCode
}

type PricingFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    currency: CurrencyCode
    onCurrencyChange: (code: CurrencyCode) => void
    currencyOptions: { value: CurrencyCode; label: string }[]
}

const PriceInput = (props: InputProps) => {
    return <Input {...props} value={props.field.value ?? ''} />
}

const NumericFormatInput = ({
    onValueChange,
    field,
    ...rest
}: Omit<NumericFormatProps, 'form' | 'value'> & {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    form: any
    field: FieldInputProps<unknown>
}) => {
    const { customInput, ...restProps } = rest as NumericFormatProps
    const resolvedValue =
        field?.value === undefined || field?.value === null
            ? ''
            : field.value
    return (
        <NumericFormat
            {...restProps}
            customInput={
                (customInput as ComponentType | undefined) ??
                (Input as ComponentType)
            }
            value={resolvedValue as string | number}
            type="text"
            autoComplete="off"
            allowNegative={false}
            onValueChange={onValueChange}
        />
    )
}

const PricingFields = (props: PricingFieldsProps) => {
    const { touched, errors, currency, onCurrencyChange, currencyOptions } = props
    const { t } = useTranslation()
    const [salePriceManuallyEdited, setSalePriceManuallyEdited] = useState(false)

    const renderCostPriceField = () => (
        <FormItem
            label={t('text.columns.costPrice')}
            invalid={(errors.costPrice && touched.costPrice) as boolean}
            errorMessage={errors.costPrice}
        >
            <Field name="costPrice">
                {({ field, form }: FieldProps) => {
                    return (
                        <InputGroup>
                            <InputGroup.Addon className="font-semibold text-xs uppercase">
                                {currency || 'UYU'}
                            </InputGroup.Addon>
                            <NumericFormatInput
                                form={form}
                                field={field}
                                placeholder={t('text.columns.costPrice')}
                                customInput={PriceInput as ComponentType}
                                onValueChange={(e) => {
                                    const nextValue =
                                        typeof e.value === 'string'
                                            ? e.value
                                            : ''
                                    form.setFieldValue(field.name, nextValue)
                                    if (!salePriceManuallyEdited) {
                                        if (nextValue === '') {
                                            form.setFieldValue('salePrice', '')
                                        } else {
                                            const numericCost = Number(
                                                nextValue || 0,
                                            )
                                            if (Number.isFinite(numericCost)) {
                                                const computed = (numericCost * 1.3).toFixed(2)
                                                form.setFieldValue('salePrice', computed)
                                            }
                                        }
                                    }
                                }}
                            />
                        </InputGroup>
                    )
                }}
            </Field>
        </FormItem>
    )

    const renderSalePriceField = () => (
        <FormItem
            label={t('text.columns.salePrice')}
            invalid={(errors.salePrice && touched.salePrice) as boolean}
            errorMessage={errors.salePrice}
        >
            <Field name="salePrice">
                {({ field, form }: FieldProps) => {
                    return (
                        <>
                            <InputGroup>
                                <InputGroup.Addon className="px-0">
                                    <CurrencySelector
                                        embedded
                                        selectClassName="w-28"
                                        value={currency}
                                        options={currencyOptions}
                                        onChange={(code) => {
                                            onCurrencyChange(code)
                                        }}
                                    />
                                </InputGroup.Addon>
                                <NumericFormatInput
                                    form={form}
                                    field={field}
                                    placeholder={t('text.columns.salePrice')}
                                    customInput={PriceInput as ComponentType}
                                    onValueChange={(e) => {
                                        const nextValue =
                                            typeof e.value === 'string'
                                                ? e.value
                                                : ''
                                        form.setFieldValue(field.name, nextValue)
                                        if (nextValue === '') {
                                            setSalePriceManuallyEdited(false)
                                        } else {
                                            setSalePriceManuallyEdited(true)
                                        }
                                    }}
                                />
                            </InputGroup>
                            {!salePriceManuallyEdited && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('text.descriptions.salePriceAuto')}
                                </p>
                            )}
                        </>
                    )
                }}
            </Field>
        </FormItem>
    )

    const renderBulkDiscountField = () => (
        <FormItem
            label={t('text.labels.offerPrice')}
            invalid={
                (errors.bulkDiscountPrice &&
                    touched.bulkDiscountPrice) as boolean
            }
            errorMessage={errors.bulkDiscountPrice}
        >
            <Field name="bulkDiscountPrice">
                {({ field, form }: FieldProps) => (
                    <NumericFormatInput
                        form={form}
                        field={field}
                        placeholder={t('text.labels.offerPrice')}
                        customInput={PriceInput as ComponentType}
                        onValueChange={(e) => {
                            const nextValue =
                                typeof e.value === 'string' ? e.value : ''
                            form.setFieldValue(field.name, nextValue)
                        }}
                    />
                )}
            </Field>
        </FormItem>
    )

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.titles.pricing')}</h5>
            <p className="mb-6">{t('text.descriptions.productSalesInfo')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">{renderCostPriceField()}</div>
                <div className="col-span-1">{renderSalePriceField()}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">{renderBulkDiscountField()}</div>
            </div>
        </AdaptableCard>
    )
}

export default PricingFields
