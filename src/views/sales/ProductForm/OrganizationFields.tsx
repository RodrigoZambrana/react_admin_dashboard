import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import CreatableSelect from 'react-select/creatable'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useEffect, useState } from 'react'
import { apiGetProductCategories } from '@/services/SettingsService'
import { useTranslation } from 'react-i18next'

type Options = {
    label: string
    value: string
}[]

type FormFieldsName = {
    category: string
    tags: Options
    vendor: string
    brand: string
}

type OrganizationFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    values: {
        category: string
        tags: Options
        [key: string]: unknown
    }
}

const defaultCategories = [
    { key: 'devices', value: 'devices', label: undefined as string | undefined },
    { key: 'bags', value: 'bags', label: undefined as string | undefined },
    { key: 'shoes', value: 'shoes', label: undefined as string | undefined },
    { key: 'watches', value: 'watches', label: undefined as string | undefined },
    { key: 'cloths', value: 'cloths', label: undefined as string | undefined },
]

const tags = [
    { key: 'trend', value: 'trend' },
    { key: 'unisex', value: 'unisex' },
]

const OrganizationFields = (props: OrganizationFieldsProps) => {
    const { values = { category: '', tags: [] }, touched, errors } = props
    const { t } = useTranslation()

    const [categories, setCategories] = useState(defaultCategories)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetProductCategories<{ id: string; name: string }[]>()
            const opts = (res.data as any[]).map((c) => ({ key: c.id, value: c.id, label: c.name }))
            if (opts.length) setCategories(opts)
        }
        fetch()
    }, [])

    return (
        <AdaptableCard divider isLastChild className="mb-4">
            <h5>{t('sales.productForm.organizations.title')}</h5>
            <p className="mb-6">{t('sales.productForm.organizations.desc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.category')}
                        invalid={
                            (errors.category && touched.category) as boolean
                        }
                        errorMessage={errors.category}
                    >
                        <Field name="category">
                            {({ field, form }: FieldProps) => (
                                <Select
                                    field={field}
                                    form={form}
                                    options={categories.map((c) => ({
                                        value: c.value,
                                        label:
                                            c.label ||
                                            t(
                                                `sales.productForm.categories.${c.key}`,
                                            ),
                                    }))}
                                    value={categories
                                        .map((c) => ({
                                            value: c.value,
                                            label:
                                                c.label ||
                                                t(
                                                    `sales.productForm.categories.${c.key}`,
                                                ),
                                        }))
                                        .find((opt) => opt.value === values.category) || null}
                                    onChange={(option) =>
                                        form.setFieldValue(
                                            field.name,
                                            option?.value,
                                        )
                                    }
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.tags')}
                        invalid={
                            (errors.tags && touched.tags) as unknown as boolean
                        }
                        errorMessage={errors.tags as string}
                    >
                        <Field name="tags">
                            {({ field, form }: FieldProps) => (
                                <Select
                                    isMulti
                                    componentAs={CreatableSelect}
                                    field={field}
                                    form={form}
                                    options={tags.map((tg) => ({
                                        value: tg.value,
                                        label: t(
                                            `sales.productForm.tags.${tg.key}`,
                                        ),
                                    }))}
                                    value={values.tags}
                                    onChange={(option) =>
                                        form.setFieldValue(field.name, option)
                                    }
                                />
                            )}
                        </Field>
                    </FormItem>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.brand')}
                        invalid={(errors.brand && touched.brand) as boolean}
                        errorMessage={errors.brand}
                    >
                        <Field
                            type="text"
                            autoComplete="off"
                            name="brand"
                            placeholder={t('text.labels.brand')}
                            component={Input}
                        />
                    </FormItem>
                </div>
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.vendor')}
                        invalid={(errors.vendor && touched.vendor) as boolean}
                        errorMessage={errors.vendor}
                    >
                        <Field
                            type="text"
                            autoComplete="off"
                            name="vendor"
                            placeholder={t('text.labels.vendor')}
                            component={Input}
                        />
                    </FormItem>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default OrganizationFields
