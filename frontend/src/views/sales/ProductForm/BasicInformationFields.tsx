import AdaptableCard from '@/components/shared/AdaptableCard'
import RichTextEditor from '@/components/shared/RichTextEditor'
import Input from '@/components/ui/Input'
import { FormItem } from '@/components/ui/Form'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useTranslation } from 'react-i18next'

type FormFieldsName = {
    name: string
    productCode: string
    description: string
}

type BasicInformationFields = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
}

const BasicInformationFields = (props: BasicInformationFields) => {
    const { touched, errors } = props
    const { t } = useTranslation()

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.titles.basicInformation')}</h5>
            <p className="mb-6">{t('text.descriptions.basicProductInfo')}</p>
            <FormItem
                label={t('text.labels.productName')}
                invalid={(errors.name && touched.name) as boolean}
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
                invalid={(errors.productCode && touched.productCode) as boolean}
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
                label={t('text.labels.description')}
                labelClass="justify-start!"
                invalid={(errors.description && touched.description) as boolean}
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
