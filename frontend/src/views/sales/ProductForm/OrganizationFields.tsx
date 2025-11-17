import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Tag from '@/components/ui/Tag'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import Table from '@/components/ui/Table'
import Notification from '@/components/ui/Notification'
import { Field, FormikErrors, FormikTouched, FieldProps } from 'formik'
import { useCallback, useEffect, useMemo, useState, KeyboardEvent, FormEvent } from 'react'
import {
    apiGetProductCategories,
    apiCreateProductCategory,
    apiUpdateProductCategory,
    apiDeleteProductCategory,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'

type RawCategory = {
    id: number
    name: string
    parentId: number | null
}

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

const normalizeCategory = (entry: unknown, fallbackId: number): RawCategory | null => {
    if (!entry || typeof entry !== 'object') {
        return null
    }
    const raw = entry as Record<string, unknown>
    const idSource = raw.id ?? fallbackId
    const parsedId = typeof idSource === 'number' ? idSource : Number(idSource)
    const nameValue = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!Number.isFinite(parsedId) || parsedId <= 0 || !nameValue) {
        return null
    }
    const parentSource = raw.parentId
    let parentId: number | null = null
    if (parentSource !== undefined && parentSource !== null && parentSource !== '') {
        const parsedParent = typeof parentSource === 'number' ? parentSource : Number(parentSource)
        parentId = Number.isFinite(parsedParent) && parsedParent > 0 ? parsedParent : null
    }
    return {
        id: Math.trunc(parsedId),
        name: nameValue,
        parentId,
    }
}

type CategoryManagerDialogProps = {
    open: boolean
    categories: RawCategory[]
    onRefresh: () => Promise<void> | void
}

const CategoryManagerDialog = ({ open, categories, onRefresh }: CategoryManagerDialogProps) => {
    const { t } = useTranslation()
    const [formState, setFormState] = useState<{ id: number | null; name: string; parentId: string }>({
        id: null,
        name: '',
        parentId: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)

    useEffect(() => {
        if (!open) {
            setFormState({ id: null, name: '', parentId: '' })
            setSubmitting(false)
            setDeletingId(null)
        }
    }, [open])

    const parentOptions = useMemo(() => {
        const rootOption = {
            value: '',
            label: t('sales.productForm.organizations.noParent', {
                defaultValue: 'Sin categoría superior',
            }),
        }
        const options = categories
            .filter((cat) => cat.parentId === null)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((cat) => ({
                value: String(cat.id),
                label: cat.name,
            }))
        return [rootOption, ...options]
    }, [categories, t])

    const categoryRows = useMemo(() => {
        const buildRows = (parentId: number | null, depth = 0): Array<RawCategory & { depth: number }> => {
            return categories
                .filter((cat) => cat.parentId === parentId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .flatMap((cat) => [{ ...cat, depth }, ...buildRows(cat.id, depth + 1)])
        }
        return buildRows(null)
    }, [categories])

    const handleEdit = (category: RawCategory) => {
        setFormState({
            id: category.id,
            name: category.name,
            parentId: category.parentId ? String(category.parentId) : '',
        })
    }

    const handleReset = () => {
        setFormState({ id: null, name: '', parentId: '' })
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmedName = formState.name.trim()
        if (!trimmedName) {
            toast.push(
                <Notification title={t('common.error', { defaultValue: 'Error' })} type="danger">
                    {t('sales.productForm.organizations.nameRequired', {
                        defaultValue: 'Ingresá un nombre para la categoría.',
                    })}
                </Notification>,
            )
            return
        }
        const parentId =
            formState.parentId && formState.parentId !== ''
                ? Number(formState.parentId)
                : null
        setSubmitting(true)
        try {
            if (formState.id) {
                await apiUpdateProductCategory<boolean, Record<string, unknown>>({
                    id: formState.id,
                    name: trimmedName,
                    parentId,
                })
            } else {
                await apiCreateProductCategory<boolean, Record<string, unknown>>({
                    name: trimmedName,
                    parentId,
                })
            }
            toast.push(
                <Notification
                    title={t('sales.productForm.organizations.saveSuccess', {
                        defaultValue: 'Categoría guardada',
                    })}
                    type="success"
                >
                    {t('sales.productForm.organizations.saveSuccessDescription', {
                        defaultValue: 'Los cambios se guardaron correctamente.',
                    })}
                </Notification>,
            )
            handleReset()
            await onRefresh()
        } catch (error: any) {
            const message =
                error?.response?.data?.message || error?.message || t('common.error', { defaultValue: 'Error' })
            toast.push(
                <Notification
                    title={t('sales.productForm.organizations.saveError', {
                        defaultValue: 'No se pudo guardar la categoría',
                    })}
                    type="danger"
                >
                    {message}
                </Notification>,
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (category: RawCategory) => {
        const hasChildren = categories.some((item) => item.parentId === category.id)
        if (hasChildren) {
            toast.push(
                <Notification title={t('common.warning', { defaultValue: 'Atención' })} type="warning">
                    {t('sales.productForm.organizations.deleteBlocked', {
                        defaultValue: 'Eliminá o mové las subcategorías antes de borrar esta categoría.',
                    })}
                </Notification>,
            )
            return
        }
        const confirmed = window.confirm(
            t('sales.productForm.organizations.deleteConfirm', {
                defaultValue: '¿Eliminar la categoría "{{name}}"?',
                name: category.name,
            }),
        )
        if (!confirmed) {
            return
        }
        setDeletingId(category.id)
        try {
            await apiDeleteProductCategory<boolean, { id: number }>({ id: category.id })
            toast.push(
                <Notification
                    title={t('sales.productForm.organizations.deleteSuccess', {
                        defaultValue: 'Categoría eliminada',
                    })}
                    type="success"
                >
                    {t('sales.productForm.organizations.deleteSuccessDescription', {
                        defaultValue: 'La categoría se eliminó correctamente.',
                    })}
                </Notification>,
            )
            if (formState.id === category.id) {
                handleReset()
            }
            await onRefresh()
        } catch (error: any) {
            const message =
                error?.response?.data?.message || error?.message || t('common.error', { defaultValue: 'Error' })
            toast.push(
                <Notification
                    title={t('sales.productForm.organizations.deleteError', {
                        defaultValue: 'No se pudo eliminar la categoría',
                    })}
                    type="danger"
                >
                    {message}
                </Notification>,
            )
        } finally {
            setDeletingId(null)
        }
    }

    if (!open) {
        return null
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h5 className="font-semibold">
                    {t('sales.productForm.organizations.managerTitle', {
                        defaultValue: 'Categorías y subcategorías',
                    })}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('sales.productForm.organizations.managerDescription', {
                        defaultValue: 'Creá o editá categorías sin salir de este formulario.',
                    })}
                </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,320px)] gap-4">
                <div className="overflow-auto border rounded-md">
                    <Table>
                            <THead>
                                <Tr>
                                    <Th>{t('sales.productForm.organizations.tableName', { defaultValue: 'Nombre' })}</Th>
                                    <Th>
                                    {t('sales.productForm.organizations.tableParent', {
                                        defaultValue: 'Superior',
                                    })}
                                    </Th>
                                    <Th className="text-right">
                                        {t('sales.productForm.organizations.tableActions', {
                                            defaultValue: 'Acciones',
                                        })}
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {categoryRows.map((category) => {
                                    const parentName =
                                        categories.find((item) => item.id === category.parentId)?.name || '—'
                                    const padding = category.depth > 0 ? Math.min(category.depth, 4) * 12 : 0
                                    return (
                                        <Tr key={category.id}>
                                            <Td>
                                                <span
                                                    className="font-medium block"
                                                    style={{ paddingLeft: padding }}
                                                >
                                                    {category.depth > 0 && '↳ '}
                                                    {category.name}
                                                </span>
                                            </Td>
                                            <Td>{parentName}</Td>
                                            <Td>
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="xs"
                                                        type="button"
                                                        variant="plain"
                                                        onClick={() => handleEdit(category)}
                                                    >
                                                        {t('text.actions.edit')}
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        type="button"
                                                        variant="plain"
                                                        disabled={deletingId === category.id}
                                                        onClick={() => handleDelete(category)}
                                                    >
                                                        {t('text.actions.delete')}
                                                    </Button>
                                                </div>
                                            </Td>
                                        </Tr>
                                    )
                                })}
                                {!categoryRows.length && (
                                    <Tr>
                                        <Td colSpan={3} className="text-center py-6 text-gray-500 dark:text-gray-400">
                                            {t('sales.productForm.organizations.emptyCategories', {
                                                defaultValue: 'Todavía no hay categorías creadas.',
                                            })}
                                        </Td>
                                    </Tr>
                                )}
                            </TBody>
                    </Table>
                </div>
                <form className="border rounded-md p-3 flex flex-col gap-3" onSubmit={handleSubmit}>
                        <div>
                            <h6 className="font-semibold">
                                {formState.id
                                    ? t('sales.productForm.organizations.editCategory', {
                                          defaultValue: 'Editar categoría',
                                      })
                                    : t('sales.productForm.organizations.newCategory', {
                                          defaultValue: 'Nueva categoría',
                                      })}
                            </h6>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {t('sales.productForm.organizations.nameLabel', { defaultValue: 'Nombre' })}
                            </span>
                            <Input
                                value={formState.name}
                                onChange={(event) =>
                                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {t('sales.productForm.organizations.parentLabel', {
                                    defaultValue: 'Categoría superior',
                                })}
                            </span>
                            <Select
                                options={parentOptions.filter(
                                    (option) => option.value === '' || option.value !== String(formState.id ?? ''),
                                )}
                                value={
                                    parentOptions.find((option) => option.value === formState.parentId) ??
                                    parentOptions[0]
                                }
                                onChange={(option) =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        parentId: (option as { value: string }).value,
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="plain"
                                onClick={handleReset}
                                disabled={submitting}
                            >
                                {t('sales.productForm.organizations.resetCategory', {
                                    defaultValue: 'Limpiar',
                                })}
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                variant="solid"
                                loading={submitting}
                            >
                                {t('sales.productForm.organizations.saveCategory', {
                                    defaultValue: 'Guardar',
                                })}
                            </Button>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('sales.productForm.organizations.managerHint', {
                                defaultValue:
                                    'Seleccioná una categoría para editarla o asigná una superior para crear una subcategoría.',
                            })}
                        </div>
                </form>
            </div>
        </div>
    )
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

const { Tr, Td, TBody, THead, Th } = Table

const OrganizationFields = (props: OrganizationFieldsProps) => {
    const { touched, errors } = props
    const { t } = useTranslation()

    const [rawCategories, setRawCategories] = useState<RawCategory[]>([])
    const [categoriesLoading, setCategoriesLoading] = useState(false)
    const [managerOpen, setManagerOpen] = useState(false)
    const [tagInputValue, setTagInputValue] = useState('')

    const loadCategories = useCallback(async () => {
        setCategoriesLoading(true)
        try {
            const res = await apiGetProductCategories<unknown[]>()
            const payload = Array.isArray(res?.data) ? res.data : []
            const normalized = payload
                .map((entry, index) => normalizeCategory(entry, index + 1))
                .filter((entry): entry is RawCategory => Boolean(entry))
            setRawCategories(normalized)
        } catch (error) {
            console.error('[categories] load failed', error)
            toast.push(
                <Notification title={t('common.error', { defaultValue: 'Error' })} type="danger">
                    {t('sales.productForm.organizations.loadError', {
                        defaultValue: 'No se pudieron cargar las categorías.',
                    })}
                </Notification>,
            )
        } finally {
            setCategoriesLoading(false)
        }
    }, [t])

    useEffect(() => {
        loadCategories()
    }, [loadCategories])

    return (
        <>
            <AdaptableCard divider isLastChild className="mb-4">
                <h5>{t('sales.productForm.organizations.title')}</h5>
                <p className="mb-6">{t('sales.productForm.organizations.desc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <FormItem
                        label={t('text.labels.category')}
                        invalid={(errors.categoryId && touched.categoryId) as boolean}
                        errorMessage={errors.categoryId as string}
                    >
                        <Field name="categoryId">
                            {({ field, form }: FieldProps) => {
                                const rawValue = field.value
                                const selectedValue =
                                    rawValue === undefined || rawValue === null || rawValue === ''
                                        ? null
                                        : Number(rawValue)
                                const selectedCategory =
                                    selectedValue !== null
                                        ? rawCategories.find((cat) => cat.id === selectedValue) ?? null
                                        : null
                                const parentSelectionId =
                                    selectedCategory?.parentId ?? selectedCategory?.id ?? null
                                const parentOptions = rawCategories
                                    .filter((cat) => cat.parentId === null)
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((cat) => ({ value: cat.id, label: cat.name }))
                                const parentSelectValue =
                                    parentSelectionId !== null
                                        ? parentOptions.find((opt) => opt.value === parentSelectionId) ?? null
                                        : null
                                const subcategoryItems =
                                    parentSelectionId !== null
                                        ? rawCategories
                                              .filter((cat) => cat.parentId === parentSelectionId)
                                              .sort((a, b) => a.name.localeCompare(b.name))
                                        : []
                                const subcategoryOptions = subcategoryItems.map((cat) => ({
                                    value: cat.id,
                                    label: cat.name,
                                }))
                                if (selectedValue !== null && !selectedCategory && rawCategories.length) {
                                    form.setFieldValue(field.name, null)
                                }
                                const handleParentSelect = (option: CategoryOption | null) => {
                                    if (!option) {
                                        form.setFieldValue(field.name, null)
                                        return
                                    }
                                    const newParentId = Number(option.value)
                                    const matchingChild = rawCategories.find(
                                        (cat) => cat.parentId === newParentId && cat.id === selectedValue,
                                    )
                                    if (matchingChild) {
                                        form.setFieldValue(field.name, matchingChild.id)
                                        return
                                    }
                                    const firstChild = rawCategories.find((cat) => cat.parentId === newParentId)
                                    form.setFieldValue(field.name, firstChild ? firstChild.id : newParentId)
                                }
                                const handleSubcategorySelect = (option: CategoryOption | null) => {
                                    if (!option) {
                                        form.setFieldValue(field.name, parentSelectionId)
                                        return
                                    }
                                    form.setFieldValue(field.name, Number(option.value))
                                }
                                return (
                                    <div className="flex flex-col gap-2">
                                        <Select
                                            field={field}
                                            form={form}
                                            options={parentOptions}
                                            value={parentSelectValue as any}
                                            isLoading={categoriesLoading}
                                            isDisabled={categoriesLoading || !parentOptions.length}
                                            placeholder={t('text.labels.category')}
                                            onChange={(option) =>
                                                handleParentSelect(option as CategoryOption | null)
                                            }
                                        />
                                        {subcategoryOptions.length > 0 && (
                                            <Select
                                                options={subcategoryOptions}
                                                value={
                                                    selectedCategory && selectedCategory.parentId
                                                        ? subcategoryOptions.find(
                                                              (opt) => opt.value === selectedCategory.id,
                                                          ) ?? null
                                                        : null
                                                }
                                                isLoading={categoriesLoading}
                                                isDisabled={categoriesLoading || !subcategoryOptions.length}
                                                placeholder={t('text.labels.subcategory', {
                                                    defaultValue: 'Subcategoría',
                                                })}
                                                onChange={(option) =>
                                                    handleSubcategorySelect(option as CategoryOption | null)
                                                }
                                            />
                                        )}
                                        <Button
                                            type="button"
                                            size="xs"
                                            variant="plain"
                                            className="self-start"
                                            onClick={() => setManagerOpen(true)}
                                        >
                                            {t('sales.productForm.organizations.manageCategories', {
                                                defaultValue: 'Gestionar categorías',
                                            })}
                                        </Button>
                                    </div>
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
            <Dialog
                isOpen={managerOpen}
                onClose={() => setManagerOpen(false)}
                onRequestClose={() => setManagerOpen(false)}
                className="max-w-4xl w-full"
            >
                <CategoryManagerDialog
                    open={managerOpen}
                    categories={rawCategories}
                    onRefresh={loadCategories}
                />
            </Dialog>
        </>
    )
}

export default OrganizationFields
