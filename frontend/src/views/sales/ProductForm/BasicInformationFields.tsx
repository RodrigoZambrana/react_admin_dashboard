import { useMemo } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import RichTextEditor from '@/components/shared/RichTextEditor'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { FormItem } from '@/components/ui/Form'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useTranslation } from 'react-i18next'
import {
    buildSalesUnitOptions,
    DEFAULT_SALES_UNIT,
} from '@/constants/product.constant'

type FormFieldsName = {
    name: string
    productCode: string
    description: string
    unitOfMeasure: string
}

type BasicInformationFields = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
}

const BasicInformationFields = (props: BasicInformationFields) => {
    const { touched, errors } = props
    const { t } = useTranslation()

    const salesUnitOptions = useMemo(
        () => buildSalesUnitOptions(t),
        [t],
    )

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.titles.basicInformation')}</h5>
            <p className="mb-6">{t('text.descriptions.basicProductInfo')}</p>
            <FormItem
                label={t('text.labels.productName')}
                invalid={Boolean(errors.name && touched.name)}
                errorMessage={errors.name}
            >
                <Field
                    type="text"
                    autoComplete="off"
                    name="name"
                    placeholder={t('text.placeholders.name')}
                    component={Input}
                />
            </FormItem>
            <FormItem
                label={t('text.labels.codeSku') || 'Código (SKU)'}
                invalid={Boolean(errors.productCode && touched.productCode)}
                errorMessage={errors.productCode}
            >
                <Field
                    type="text"
                    autoComplete="off"
                    name="productCode"
                    placeholder={t('text.placeholders.code')}
                    component={Input}
                />
            </FormItem>
            <FormItem
                label={t('text.labels.unitOfMeasure')}
                invalid={Boolean(errors.unitOfMeasure && touched.unitOfMeasure)}
                errorMessage={errors.unitOfMeasure}
            >
                <Field name="unitOfMeasure">
                    {({ field, form }: FieldProps<string>) => {
                        const selected =
                            salesUnitOptions.find(
                                (option) => option.value === field.value,
                            ) ??
                            salesUnitOptions.find(
                                (option) => option.value === DEFAULT_SALES_UNIT,
                            )
                        return (
                            <Select
                                name={field.name}
                                value={selected}
                                options={salesUnitOptions}
                                onChange={(option) => {
                                    form.setFieldValue(
                                        field.name,
                                        option?.value ?? DEFAULT_SALES_UNIT,
                                    )
                                }}
                                onBlur={() =>
                                    form.setFieldTouched(field.name, true)
                                }
                                placeholder={t('text.labels.unitOfMeasure')}
                            />
                        )
                    }}
                </Field>
            </FormItem>
            <FormItem
                label={t('text.labels.description')}
                labelClass="justify-start!"
                invalid={Boolean(errors.description && touched.description)}
                errorMessage={errors.description}
            >
                <Field name="description">
                    {({ field, form }: FieldProps) => (
                        <RichTextEditor
                            value={field.value ?? ''}
                            onChange={(val) =>
                                form.setFieldValue(field.name, val)
                            }
                        />
                    )}
                </Field>
            </FormItem>
        </AdaptableCard>
    )
}

export default BasicInformationFields
