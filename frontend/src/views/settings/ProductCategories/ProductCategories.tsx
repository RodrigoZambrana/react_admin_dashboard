import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Upload from '@/components/ui/Upload'
import { useTranslation } from 'react-i18next'
import {
    apiGetProductCategories,
    apiCreateProductCategory,
    apiUpdateProductCategory,
    apiDeleteProductCategory,
    apiExportSettings,
    apiImportSettings,
} from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { downloadCsvFile, parseCsvFile } from '@/utils/csv'
import useConfirmation from '@/hooks/useConfirmation'

type CategoryService = {
    id: number
    name: string
    productCode: string | null
    description: string | null
    salePrice: number
    costPrice: number
    currency: string
    taxRate: number | null
    unitOfMeasure: string
}

type RawCategory = {
    id: number
    name: string
    description: string | null
    image: string | null
    parentId: number | null
    installable: boolean
    service: CategoryService | null
}

type CategoryTreeNode = RawCategory & { children: CategoryTreeNode[] }
type FlatCategory = RawCategory & { depth: number }

type ServiceFormState = {
    name: string
    productCode: string
    description: string
    salePrice: string
    costPrice: string
    currency: string
    taxRate: string
    unitOfMeasure: string
}

type FormState = {
    id: number | null
    name: string
    description: string
    image: string
    parentId: string
    installable: boolean
    service: ServiceFormState
}

type ParentOption = { label: string; value: string }

const SALES_UNIT_OPTIONS: Array<{ label: string; value: string }> = [
    { value: 'UNIT', label: 'UNIT' },
    { value: 'SQUARE_METER', label: 'SQUARE_METER' },
    { value: 'LINEAR_METER', label: 'LINEAR_METER' },
]

const DEFAULT_SERVICE_FORM: ServiceFormState = {
    name: '',
    productCode: '',
    description: '',
    salePrice: '',
    costPrice: '',
    currency: 'UYU',
    taxRate: '',
    unitOfMeasure: 'UNIT',
}

const DEFAULT_FORM: FormState = {
    id: null,
    name: '',
    description: '',
    image: '',
    parentId: '',
    installable: false,
    service: { ...DEFAULT_SERVICE_FORM },
}

const { Tr, Td, TBody, THead, Th } = Table

const toNullableString = (value: string): string | null => {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
}

const normalizeCategoryResponse = (entry: unknown, fallbackId: number): RawCategory | null => {
    if (!entry || typeof entry !== 'object') {
        return null
    }
    const raw = entry as Record<string, unknown>
    const idSource = raw.id ?? fallbackId
    const parsedId = typeof idSource === 'number' ? idSource : Number(idSource)
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
        return null
    }
    const name = String(raw.name ?? '').trim()
    if (!name) {
        return null
    }
    const parentIdRaw = raw.parentId
    let parentId: number | null = null
    if (parentIdRaw !== undefined && parentIdRaw !== null && parentIdRaw !== '') {
        const parsedParent = typeof parentIdRaw === 'number' ? parentIdRaw : Number(parentIdRaw)
        parentId = Number.isFinite(parsedParent) && parsedParent > 0 ? parsedParent : null
    }
    const description =
        raw.description === undefined || raw.description === null
            ? null
            : toNullableString(String(raw.description))
    const image =
        raw.image === undefined || raw.image === null
            ? null
            : toNullableString(String(raw.image))
    const serviceRaw = raw.installServiceProduct
    let service: CategoryService | null = null
    if (serviceRaw && typeof serviceRaw === 'object') {
        const serviceEntry = serviceRaw as Record<string, unknown>
        const serviceIdSource = serviceEntry.id
        const parsedServiceId =
            typeof serviceIdSource === 'number' ? serviceIdSource : Number(serviceIdSource)
        if (Number.isFinite(parsedServiceId) && parsedServiceId > 0) {
            const salePriceValue = Number(serviceEntry.salePrice ?? 0)
            const costPriceValue = Number(serviceEntry.costPrice ?? 0)
            const taxRateValue =
                serviceEntry.taxRate === undefined || serviceEntry.taxRate === null
                    ? null
                    : Number(serviceEntry.taxRate)
            const serviceName = String(serviceEntry.name ?? `${name} Installation`).trim()
            const productCodeValue =
                serviceEntry.productCode === undefined || serviceEntry.productCode === null
                    ? null
                    : toNullableString(String(serviceEntry.productCode))
            const serviceDescription =
                serviceEntry.description === undefined || serviceEntry.description === null
                    ? null
                    : toNullableString(String(serviceEntry.description))
            const currencyValue = (String(serviceEntry.currency ?? 'UYU').trim() || 'UYU').toUpperCase()
            const unitValue = String(serviceEntry.unitOfMeasure ?? 'UNIT').trim().toUpperCase() || 'UNIT'

            service = {
                id: Math.trunc(parsedServiceId),
                name: serviceName || `${name} Installation`,
                productCode: productCodeValue,
                description: serviceDescription,
                salePrice: Number.isFinite(salePriceValue) ? salePriceValue : 0,
                costPrice: Number.isFinite(costPriceValue) ? costPriceValue : 0,
                currency: currencyValue,
                taxRate:
                    taxRateValue !== null && Number.isFinite(taxRateValue)
                        ? (taxRateValue as number)
                        : null,
                unitOfMeasure: unitValue,
            }
        }
    }
    return {
        id: Math.trunc(parsedId),
        name,
        description,
        image,
        parentId,
        installable: Boolean(service),
        service,
    }
}

const buildCategoryTree = (items: RawCategory[]): CategoryTreeNode[] => {
    const map = new Map<number, CategoryTreeNode>()
    const roots: CategoryTreeNode[] = []
    items.forEach((item) => {
        map.set(item.id, { ...item, children: [] })
    })
    map.forEach((node) => {
        if (node.parentId && map.has(node.parentId)) {
            map.get(node.parentId)!.children.push(node)
        } else {
            roots.push(node)
        }
    })
    const sort = (nodes: CategoryTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name))
        nodes.forEach((child) => sort(child.children))
    }
    sort(roots)
    return roots
}

const flattenCategoryTree = (nodes: CategoryTreeNode[], depth = 0): FlatCategory[] => {
    return nodes.flatMap((node) => [
        { ...node, depth },
        ...flattenCategoryTree(node.children, depth + 1),
    ])
}

const ProductCategories = () => {
    const { t } = useTranslation()
    const { confirm, ConfirmationDialog } = useConfirmation()
    const [categories, setCategories] = useState<RawCategory[]>([])
    const [form, setForm] = useState<FormState>({
        ...DEFAULT_FORM,
        service: { ...DEFAULT_SERVICE_FORM },
    })
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [fetching, setFetching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const fetchCategories = useCallback(async () => {
        try {
            setFetching(true)
            const res = await apiGetProductCategories<RawCategory[]>()
            const source = Array.isArray(res.data) ? res.data : []
            const normalized: RawCategory[] = []
            source.forEach((entry, index) => {
                const cat = normalizeCategoryResponse(entry, index + 1)
                if (cat) {
                    normalized.push(cat)
                }
            })
            setCategories(normalized)
        } finally {
            setFetching(false)
        }
    }, [])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])
    const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree])
    const categoryNameById = useMemo(() => {
        const map = new Map<number, string>()
        categories.forEach((cat) => map.set(cat.id, cat.name))
        return map
    }, [categories])

    const parentOptions = useMemo<ParentOption[]>(() => {
        const base: ParentOption[] = [
            {
                value: '',
                label:
                    t('settings.productCategories.form.noParent', {
                        defaultValue: 'No parent',
                    }) || 'No parent',
            },
        ]
        flatCategories.forEach((category) => {
            if (form.id !== null && category.id === form.id) {
                return
            }
            const prefix = category.depth > 0 ? `${'— '.repeat(category.depth)}` : ''
            base.push({
                value: String(category.id),
                label: `${prefix}${category.name}`,
            })
        })
        return base
    }, [flatCategories, form.id, t])

    const selectedParentOption = useMemo(() => {
        return parentOptions.find((option) => option.value === form.parentId) ?? parentOptions[0]
    }, [parentOptions, form.parentId])

    const handleFormChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleServiceChange = (key: keyof ServiceFormState, value: string) => {
        setForm((prev) => ({
            ...prev,
            service: {
                ...prev.service,
                [key]: value,
            },
        }))
    }

    const fileToDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })

    const handleImageUpload = async (files: File[]) => {
        const latest = files[files.length - 1]
        if (!latest) {
            setImageFiles([])
            handleFormChange('image', '')
            return
        }
        try {
            const dataUrl = await fileToDataUrl(latest)
            setImageFiles([latest])
            handleFormChange('image', dataUrl)
        } catch {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.productCategories.validation.imageUploadFailed', {
                        defaultValue: 'We could not process the selected image.',
                    })}
                </Notification>,
            )
        }
    }

    const handleImageRemove = () => {
        setImageFiles([])
        handleFormChange('image', '')
    }

    const resetForm = () => {
        setForm({
            ...DEFAULT_FORM,
            service: { ...DEFAULT_SERVICE_FORM },
        })
        setImageFiles([])
    }

    const handleSubmit = async () => {
        const name = form.name.trim()
        if (!name) {
            return
        }
        const description = toNullableString(form.description)
        const image = toNullableString(form.image)
        const parentId = form.parentId ? Number(form.parentId) : null
        if (parentId && form.id !== null && parentId === form.id) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {t('settings.productCategories.validation.selfParent', {
                        defaultValue: 'A category cannot be its own parent.',
                    })}
                </Notification>,
            )
            return
        }

        let servicePayload: Record<string, unknown> | undefined
        if (form.installable) {
            const serviceName = form.service.name.trim() || `${name} Installation`
            const salePriceValue = Number(form.service.salePrice)
            if (!Number.isFinite(salePriceValue) || salePriceValue < 0) {
                toast.push(
                    <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                        {t('settings.productCategories.validation.invalidServicePrice', {
                            defaultValue: 'Please provide a valid installation price.',
                        })}
                    </Notification>,
                )
                return
            }

            const productCode = toNullableString(form.service.productCode)
            const serviceDescription = toNullableString(form.service.description)
            const currency = (form.service.currency || 'UYU').trim().toUpperCase() || 'UYU'
            const unitOfMeasure = form.service.unitOfMeasure.trim().toUpperCase() || 'UNIT'

            let costPriceValue: number | undefined
            if (form.service.costPrice.trim().length > 0) {
                const parsedCost = Number(form.service.costPrice)
                if (!Number.isFinite(parsedCost) || parsedCost < 0) {
                    toast.push(
                        <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                            {t('settings.productCategories.validation.invalidServiceCost', {
                                defaultValue: 'Please provide a valid installation cost.',
                            })}
                        </Notification>,
                    )
                    return
                }
                costPriceValue = parsedCost
            }

            let taxRateValue: number | undefined
            if (form.service.taxRate.trim().length > 0) {
                const parsedTax = Number(form.service.taxRate)
                if (!Number.isFinite(parsedTax)) {
                    toast.push(
                        <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                            {t('settings.productCategories.validation.invalidServiceTax', {
                                defaultValue: 'Please provide a valid tax rate.',
                            })}
                        </Notification>,
                    )
                    return
                }
                taxRateValue = parsedTax
            }

            servicePayload = {
                name: serviceName,
                productCode,
                description: serviceDescription,
                salePrice: salePriceValue,
                currency,
                unitOfMeasure,
            }
            if (typeof costPriceValue === 'number') {
                servicePayload.costPrice = costPriceValue
            }
            if (typeof taxRateValue === 'number') {
                servicePayload.taxRate = taxRateValue
            }
        }

        const payload: Record<string, unknown> = {
            name,
            description,
            image,
            parentId,
            installable: form.installable,
        }
        if (form.installable && servicePayload) {
            payload.service = servicePayload
        }

        try {
            setSaving(true)
            if (form.id) {
                await apiUpdateProductCategory<boolean, Record<string, unknown>>({
                    id: form.id,
                    ...payload,
                })
                toast.push(
                    <Notification title={t('settings.productCategories.updated.title')} type="success">
                        {t('settings.productCategories.updated.desc')}
                    </Notification>,
                )
            } else {
                await apiCreateProductCategory<boolean, Record<string, unknown>>(payload)
                toast.push(
                    <Notification title={t('settings.productCategories.created.title')} type="success">
                        {t('settings.productCategories.created.desc')}
                    </Notification>,
                )
            }
            resetForm()
            fetchCategories()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (category: FlatCategory) => {
        setForm({
            id: category.id,
            name: category.name,
            description: category.description ?? '',
            image: category.image ?? '',
            parentId: category.parentId ? String(category.parentId) : '',
            installable: category.installable,
            service: category.installable && category.service
                ? {
                      name: category.service.name ?? '',
                      productCode: category.service.productCode ?? '',
                      description: category.service.description ?? '',
                      salePrice:
                          category.service.salePrice !== undefined && category.service.salePrice !== null
                              ? String(category.service.salePrice)
                              : '',
                      costPrice:
                          category.service.costPrice !== undefined && category.service.costPrice !== null
                              ? String(category.service.costPrice)
                              : '',
                      currency: category.service.currency ?? 'UYU',
                      taxRate:
                          category.service.taxRate !== null && category.service.taxRate !== undefined
                              ? String(category.service.taxRate)
                              : '',
                      unitOfMeasure: category.service.unitOfMeasure ?? 'UNIT',
                  }
                : { ...DEFAULT_SERVICE_FORM },
        })
        setImageFiles([])
    }

    const handleDelete = async (category: RawCategory) => {
        const confirmed = await confirm({
            title: t('settings.productCategories.delete.title', {
                defaultValue: 'Delete product category',
            }),
            message: t('settings.productCategories.delete.confirm', {
                defaultValue:
                    'Are you sure you want to delete the category "{{name}}"? This action cannot be undone.',
                name: category.name,
            }),
            confirmText: t('text.actions.delete'),
            cancelText: t('text.actions.cancel'),
        })
        if (!confirmed) {
            return
        }
        try {
            await apiDeleteProductCategory<boolean, { id: number }>({ id: category.id })
            toast.push(
                <Notification title={t('settings.productCategories.deleted.title')} type="success">
                    {t('settings.productCategories.deleted.desc')}
                </Notification>,
            )
            if (form.id === category.id) {
                resetForm()
            }
            fetchCategories()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        }
    }

    const handleExport = async () => {
        try {
            setExporting(true)
            const res = await apiExportSettings<any>()
            const rows = Array.isArray(res.data?.productCategories)
                ? res.data.productCategories.map((category: any) => ({
                      name: String(category?.name ?? ''),
                      description: String(category?.description ?? ''),
                      image: String(category?.image ?? ''),
                      parent: String(category?.parent ?? ''),
                      installable: category?.installable ? 'true' : 'false',
                      serviceName: String(category?.service?.name ?? ''),
                      serviceProductCode: String(category?.service?.productCode ?? ''),
                      serviceDescription: String(category?.service?.description ?? ''),
                      serviceSalePrice: String(category?.service?.salePrice ?? ''),
                      serviceCostPrice: String(category?.service?.costPrice ?? ''),
                      serviceCurrency: String(category?.service?.currency ?? ''),
                      serviceTaxRate: String(category?.service?.taxRate ?? ''),
                      serviceUnitOfMeasure: String(category?.service?.unitOfMeasure ?? ''),
                  }))
                : []
            downloadCsvFile('product_categories.csv', rows)
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setExporting(false)
        }
    }

    const triggerImport = () => {
        fileInputRef.current?.click()
    }

    const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) {
            return
        }
        try {
            setImporting(true)
            const rows = await parseCsvFile<Record<string, string | null>>(file)
            const payload = rows
                .map((row) => {
                    const name = String(row.name ?? '').trim()
                    if (!name) {
                        return null
                    }
                    const description = toNullableString(String(row.description ?? ''))
                    const image = toNullableString(String(row.image ?? ''))
                    const parent = toNullableString(String(row.parent ?? ''))
                    const installableFlag = String(row.installable ?? '').trim().toLowerCase()
                    const installable = ['true', '1', 'yes', 'on'].includes(installableFlag)
                    const service = installable
                        ? {
                              name: String(row.serviceName ?? '').trim(),
                              productCode: String(row.serviceProductCode ?? '').trim(),
                              description: String(row.serviceDescription ?? '').trim(),
                              salePrice: String(row.serviceSalePrice ?? '').trim(),
                              costPrice: String(row.serviceCostPrice ?? '').trim(),
                              currency: (String(row.serviceCurrency ?? '').trim() || 'UYU').toUpperCase(),
                              taxRate: String(row.serviceTaxRate ?? '').trim(),
                              unitOfMeasure: (String(row.serviceUnitOfMeasure ?? '').trim() || 'UNIT').toUpperCase(),
                          }
                        : undefined
                    return {
                        name,
                        description,
                        image,
                        parent,
                        installable,
                        service,
                    }
                })
                .filter(
                    (
                        row,
                    ): row is {
                        name: string
                        description: string | null
                        image: string | null
                        parent: string | null
                        installable: boolean
                        service?: Record<string, string>
                    } => row !== null,
                )
            await apiImportSettings({
                productCategories: payload,
            })
            toast.push(
                <Notification type="success" title={t('common.success', { defaultValue: 'Success' })}>
                    {t('settings.productCategories.imported', {
                        defaultValue: 'Categories imported successfully.',
                    })}
                </Notification>,
            )
            fetchCategories()
        } catch (error: any) {
            toast.push(
                <Notification type="danger" title={t('validation.failed', { defaultValue: 'Error' })}>
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
            )
        } finally {
            setImporting(false)
        }
    }

    return (
        <>
            <Card className="card-shadow">
            <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
                <h4>{t('settings.productCategories.title')}</h4>
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="twoTone"
                        loading={exporting}
                        onClick={handleExport}
                    >
                        {t('text.actions.export')}
                    </Button>
                    <Button
                        size="sm"
                        variant="solid"
                        loading={importing}
                        onClick={triggerImport}
                    >
                        {t('text.actions.import', { defaultValue: 'Import' })}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleImportChange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-6 lg:grid-cols-2">
                <Input
                    value={form.name}
                    placeholder={t('settings.productCategories.placeholders.name')}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    disabled={saving}
                />
                <Select<ParentOption>
                    className="min-w-[200px]"
                    options={parentOptions}
                    value={selectedParentOption}
                    onChange={(option) =>
                        handleFormChange('parentId', (option as ParentOption | null)?.value ?? '')
                    }
                    isClearable={false}
                    isDisabled={saving}
                    placeholder={
                        t('settings.productCategories.form.parent', {
                            defaultValue: 'Parent category',
                        }) || 'Parent category'
                    }
                />
                <Input
                    value={form.description}
                    placeholder={
                        t('settings.productCategories.placeholders.description') ||
                        'Description (optional)'
                    }
                    textArea
                    rows={3}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    disabled={saving}
                />
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {t('settings.productCategories.fields.image', {
                            defaultValue: 'Image',
                        })}
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Upload
                            accept="image/*"
                            multiple={false}
                            uploadLimit={1}
                            showList={false}
                            fileList={imageFiles}
                            onChange={handleImageUpload}
                            onFileRemove={() => handleImageRemove()}
                            disabled={saving}
                        >
                            <Button size="sm" variant="solid" disabled={saving}>
                                {t('settings.productCategories.actions.uploadImage', {
                                    defaultValue: 'Upload image',
                                })}
                            </Button>
                        </Upload>
                        {form.image ? (
                            <div className="flex items-center gap-2">
                                <img
                                    src={form.image}
                                    alt={form.name || 'category'}
                                    className="h-12 w-12 rounded border border-gray-200 dark:border-gray-600 object-cover"
                                />
                                <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={handleImageRemove}
                                    disabled={saving}
                                >
                                    {t('settings.productCategories.actions.removeImage', {
                                        defaultValue: 'Remove image',
                                    })}
                                </Button>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('settings.productCategories.placeholders.image') ||
                                    'Image (optional)'}
                            </span>
                        )}
                    </div>
                    <Input
                        value={form.image}
                        placeholder={
                            t('settings.productCategories.placeholders.image') ||
                            'Image URL (optional)'
                        }
                        onChange={(e) => {
                            setImageFiles([])
                            handleFormChange('image', e.target.value)
                        }}
                        disabled={saving}
                    />
                </div>
                <div className="col-span-full flex items-center gap-3">
                    <Switcher
                        checked={form.installable}
                        onChange={(checked) => handleFormChange('installable', checked)}
                        disabled={saving}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                        {t('settings.productCategories.labels.installable', {
                            defaultValue: 'This category requires or offers an installation service',
                        })}
                    </span>
                </div>
                {form.installable && (
                    <div className="col-span-full border border-gray-200 dark:border-gray-600 rounded-md p-4 space-y-4">
                        <div>
                            <h6 className="font-semibold text-sm">
                                {t('settings.productCategories.labels.serviceHeading', {
                                    defaultValue: 'Installation Service',
                                })}
                            </h6>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('settings.productCategories.labels.serviceSubtitle', {
                                    defaultValue: 'Define the installation service that complements this category.',
                                })}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Input
                                value={form.service.name}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceName') ||
                                    'Service name'
                                }
                                onChange={(e) => handleServiceChange('name', e.target.value)}
                                disabled={saving}
                            />
                            <Input
                                value={form.service.productCode}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceProductCode') ||
                                    'Service code (optional)'
                                }
                                onChange={(e) => handleServiceChange('productCode', e.target.value)}
                                disabled={saving}
                            />
                            <Input
                                value={form.service.salePrice}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceSalePrice') ||
                                    'Sale price'
                                }
                                onChange={(e) => handleServiceChange('salePrice', e.target.value)}
                                disabled={saving}
                            />
                            <Input
                                value={form.service.costPrice}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceCostPrice') ||
                                    'Cost price (optional)'
                                }
                                onChange={(e) => handleServiceChange('costPrice', e.target.value)}
                                disabled={saving}
                            />
                            <Input
                                value={form.service.currency}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceCurrency') ||
                                    'Currency'
                                }
                                onChange={(e) => handleServiceChange('currency', e.target.value)}
                                disabled={saving}
                            />
                            <Input
                                value={form.service.taxRate}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceTaxRate') ||
                                    'Tax rate (optional)'
                                }
                                onChange={(e) => handleServiceChange('taxRate', e.target.value)}
                                disabled={saving}
                            />
                            <Select<{ label: string; value: string }>
                                className="min-w-[200px]"
                                options={SALES_UNIT_OPTIONS}
                                value={
                                    SALES_UNIT_OPTIONS.find(
                                        (option) => option.value === form.service.unitOfMeasure,
                                    ) ?? SALES_UNIT_OPTIONS[0]
                                }
                                onChange={(option) =>
                                    handleServiceChange(
                                        'unitOfMeasure',
                                        (option as { value: string } | null)?.value ?? 'UNIT',
                                    )
                                }
                                isClearable={false}
                                isDisabled={saving}
                                placeholder={
                                    t('settings.productCategories.placeholders.serviceUnitOfMeasure') ||
                                    'Unit of measure'
                                }
                            />
                        </div>
                        <Input
                            value={form.service.description}
                            placeholder={
                                t('settings.productCategories.placeholders.serviceDescription') ||
                                'Service description (optional)'
                            }
                            textArea
                            rows={3}
                            onChange={(e) => handleServiceChange('description', e.target.value)}
                            disabled={saving}
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 col-span-full">
                    <Button
                        loading={saving}
                        variant="solid"
                        onClick={handleSubmit}
                    >
                        {form.id
                            ? t('text.actions.save', { defaultValue: 'Save' })
                            : t('text.actions.add')}
                    </Button>
                    {form.id !== null && (
                        <Button
                            onClick={resetForm}
                            disabled={saving}
                        >
                            {t('text.actions.cancel')}
                        </Button>
                    )}
                </div>
            </div>

            <Table>
                <THead>
                    <Tr>
                        <Th>{t('settings.productCategories.columns.name')}</Th>
                        <Th>{t('settings.productCategories.columns.parent')}</Th>
                        <Th>{t('settings.productCategories.columns.description')}</Th>
                        <Th>{t('settings.productCategories.columns.service')}</Th>
                        <Th>{t('settings.productCategories.columns.image')}</Th>
                        <Th className="text-right">{t('text.columns.actions')}</Th>
                    </Tr>
                </THead>
                <TBody>
                    {fetching && flatCategories.length === 0 ? (
                        <Tr>
                            <Td colSpan={6} className="text-center text-sm text-gray-500">
                                {t('text.states.loading', { defaultValue: 'Loading...' })}
                            </Td>
                        </Tr>
                    ) : (
                        flatCategories.map((category) => (
                            <Tr key={category.id}>
                                <Td>
                                    <div style={{ paddingLeft: `${category.depth * 16}px` }}>
                                        {category.name}
                                    </div>
                                </Td>
                                <Td>{category.parentId ? categoryNameById.get(category.parentId) ?? '—' : '—'}</Td>
                                <Td className="max-w-xs">
                                    {category.description || (
                                        <span className="text-gray-400">
                                            {t('text.labels.none', { defaultValue: 'None' })}
                                        </span>
                                    )}
                                </Td>
                                <Td className="max-w-xs">
                                    {category.installable && category.service ? (
                                        <div className="space-y-1">
                                            <div className="font-semibold">{category.service.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {(() => {
                                                    const salePriceNumber = Number(category.service?.salePrice ?? 0)
                                                    const currency = category.service?.currency ?? 'UYU'
                                                    return `${currency} ${salePriceNumber.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}`
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">
                                            {t('text.labels.none', { defaultValue: 'None' })}
                                        </span>
                                    )}
                                </Td>
                                <Td>
                                    {category.image ? (
                                        <img
                                            src={category.image}
                                            alt={category.name}
                                            className="w-12 h-12 object-cover rounded border"
                                        />
                                    ) : (
                                        <span className="text-gray-400">
                                            {t('text.labels.none', { defaultValue: 'None' })}
                                        </span>
                                    )}
                                </Td>
                                <Td className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" onClick={() => handleEdit(category)}>
                                            {t('text.actions.edit')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            color="red-600"
                                            onClick={() => handleDelete(category)}
                                        >
                                            {t('text.actions.delete')}
                                        </Button>
                                    </div>
                                </Td>
                            </Tr>
                        ))
                    )}
                    {flatCategories.length === 0 && !fetching && (
                        <Tr>
                            <Td colSpan={6} className="text-center text-sm text-gray-500">
                                {t('text.messages.noData', { defaultValue: 'No data available' })}
                            </Td>
                        </Tr>
                    )}
                </TBody>
            </Table>
            </Card>
            {ConfirmationDialog}
        </>
    )
}

export default ProductCategories
