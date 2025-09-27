import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useTranslation } from 'react-i18next'

type FormFieldsName = {
    status: number
    published?: boolean
}

type PublicationFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    values: {
        status: number
        published?: boolean
    }
}

const PublicationFields = (props: PublicationFieldsProps) => {
    const { touched, errors, values } = props
    const { t } = useTranslation()

    const statusOptions = [
        { value: 0, label: t('text.status.inStock') },
        { value: 1, label: t('text.status.limited') },
        { value: 2, label: t('text.status.outOfStock') },
    ]

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
                    <FormItem
                        label={t('text.columns.stock')}
                        invalid={(errors.status && touched.status) as boolean}
                        errorMessage={errors.status as string}
                    >
                        <Field name="status">
                            {({ field, form }: FieldProps) => (
                                <Select
                                    options={statusOptions}
                                    value={statusOptions.find(
                                        (opt) => opt.value === values.status,
                                    )}
                                    onChange={(opt) =>
                                        form.setFieldValue(
                                            field.name,
                                            (opt as { value: number }).value,
                                        )
                                    }
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default PublicationFields
