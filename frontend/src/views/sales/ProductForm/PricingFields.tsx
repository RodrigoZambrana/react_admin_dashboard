import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
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
import { useTranslation } from 'react-i18next'
import CurrencySelector from '@/components/shared/CurrencySelector'
import InputGroup from '@/components/ui/InputGroup'
import type { CurrencyCode } from '@/store'

type FormFieldsName = {
    price: number
    bulkDiscountPrice: number
    currency: CurrencyCode
}

type PricingFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    currency: CurrencyCode
    onCurrencyChange: (code: CurrencyCode) => void
}

const PriceInput = (props: InputProps) => {
    return <Input {...props} value={props.field.value} />
}

const NumericFormatInput = ({
    onValueChange,
    ...rest
}: Omit<NumericFormatProps, 'form'> & {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    form: any
    field: FieldInputProps<unknown>
}) => {
    return (
        <NumericFormat
            customInput={Input as ComponentType}
            type="text"
            autoComplete="off"
            onValueChange={onValueChange}
            {...rest}
        />
    )
}

const PricingFields = (props: PricingFieldsProps) => {
    const { touched, errors, currency, onCurrencyChange } = props
    const { t } = useTranslation()

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.titles.pricing')}</h5>
            <p className="mb-6">{t('text.descriptions.productSalesInfo')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.columns.price')}
                        invalid={(errors.price && touched.price) as boolean}
                        errorMessage={errors.price}
                    >
                        <Field name="price">
                            {({ field, form }: FieldProps) => {
                                return (
                                    <InputGroup>
                                        <InputGroup.Addon className="px-0">
                                            <CurrencySelector
                                                embedded
                                                selectClassName="w-24"
                                                value={currency}
                                                onChange={onCurrencyChange}
                                            />
                                        </InputGroup.Addon>
                                        <NumericFormatInput
                                            form={form}
                                            field={field}
                                            placeholder={t('text.columns.price')}
                                            customInput={
                                                PriceInput as ComponentType
                                            }
                                            onValueChange={(e) => {
                                                form.setFieldValue(
                                                    field.name,
                                                    e.value,
                                                )
                                            }}
                                        />
                                    </InputGroup>
                                )
                            }}
                        </Field>
                    </FormItem>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.offerPrice')}
                        invalid={
                            (errors.bulkDiscountPrice &&
                                touched.bulkDiscountPrice) as boolean
                        }
                        errorMessage={errors.bulkDiscountPrice}
                    >
                        <Field name="bulkDiscountPrice">
                            {({ field, form }: FieldProps) => {
                                return (
                                    <NumericFormatInput
                                        form={form}
                                        field={field}
                                        placeholder={t('text.labels.offerPrice')}
                                        customInput={
                                            PriceInput as ComponentType
                                        }
                                        onValueChange={(e) => {
                                            form.setFieldValue(
                                                field.name,
                                                e.value,
                                            )
                                        }}
                                    />
                                )
                            }}
                        </Field>
                    </FormItem>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default PricingFields
