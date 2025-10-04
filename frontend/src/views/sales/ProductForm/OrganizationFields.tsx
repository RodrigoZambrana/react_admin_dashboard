import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Tag from '@/components/ui/Tag'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useEffect, useState, KeyboardEvent } from 'react'
import { apiGetProductCategories } from '@/services/SettingsService'
import { useTranslation } from 'react-i18next'

type CategoryOption = {
    label: string
    value: number
}

type FormFieldsName = {
    categoryId: number | null
    tags: string[]
    vendor: string
    brand: string
}

type OrganizationFieldsProps = {
    touched: FormikTouched<FormFieldsName>
    errors: FormikErrors<FormFieldsName>
    values: {
        categoryId: number | null
    tags: string[]
        [key: string]: unknown
    }
}

const OrganizationFields = (props: OrganizationFieldsProps) => {
    const { values = { categoryId: null, tags: [] }, touched, errors } = props
    const { t } = useTranslation()

    const [categories, setCategories] = useState<CategoryOption[]>([])
    const [tagInputValue, setTagInputValue] = useState('')

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetProductCategories<{ id: number | string; name: string }[]>()
            const opts = (res.data as any[]).map((c) => ({
                value: Number(c.id),
                label: c.name,
            }))
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
                            (errors.categoryId && touched.categoryId) as boolean
                        }
                        errorMessage={errors.categoryId as string}
                    >
                        <Field name="categoryId">
                            {({ field, form }: FieldProps) => {
                                const rawValue = field.value
                                const numericValue =
                                    rawValue === undefined || rawValue === null
                                        ? null
                                        : Number(rawValue)
                                const selected =
                                    numericValue === null
                                        ? null
                                        : categories.find((opt) => opt.value === numericValue)
                                return (
                                    <Select
                                        field={field}
                                        form={form}
                                        options={categories}
                                        value={selected as any}
                                        onChange={(option) =>
                                            form.setFieldValue(
                                                field.name,
                                                option
                                                    ? Number((option as any).value)
                                                    : null,
                                            )
                                        }
                                    />
                                )
                            }}
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
                            {({ field, form }: FieldProps) => {
                                const currentTags = Array.isArray(field.value)
                                    ? (field.value as string[])
                                    : []

                                const addTag = () => {
                                    const newTag = tagInputValue.trim()
                                    if (!newTag) return
                                    if (!currentTags.includes(newTag)) {
                                        form.setFieldValue(field.name, [
                                            ...currentTags,
                                            newTag,
                                        ])
                                    }
                                    setTagInputValue('')
                                }

                                const removeTag = (tag: string) => {
                                    form.setFieldValue(
                                        field.name,
                                        currentTags.filter((item) => item !== tag),
                                    )
                                }

                                const handleKeyDown = (
                                    event: KeyboardEvent<HTMLInputElement>,
                                ) => {
                                    if (event.key === 'Enter' || event.key === ',') {
                                        event.preventDefault()
                                        addTag()
                                    } else if (
                                        event.key === 'Backspace' &&
                                        !tagInputValue &&
                                        currentTags.length
                                    ) {
                                        removeTag(currentTags[currentTags.length - 1])
                                    }
                                }

                                return (
                                    <div>
                                        <Input
                                            value={tagInputValue}
                                            onChange={(e) =>
                                                setTagInputValue(e.target.value)
                                            }
                                            onBlur={addTag}
                                            onKeyDown={handleKeyDown}
                                            placeholder={t('text.labels.tags')}
                                        />
                                        {currentTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {currentTags.map((tag) => (
                                                    <Tag
                                                        key={tag}
                                                        className="bg-gray-100 dark:bg-gray-700 border-0 flex items-center gap-2 px-2 py-1 text-sm"
                                                    >
                                                        <span>{tag}</span>
                                                        <button
                                                            type="button"
                                                            aria-label={t('text.actions.remove')}
                                                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300"
                                                            onClick={() => removeTag(tag)}
                                                        >
                                                            ×
                                                        </button>
                                                    </Tag>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            }}
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
