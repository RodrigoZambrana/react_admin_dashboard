import {
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
} from 'react'
import { useTranslation } from 'react-i18next'
import { FormContainer } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import StickyFooter from '@/components/shared/StickyFooter'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Form, Formik, FormikProps } from 'formik'
import BasicInformationFields from './BasicInformationFields'
import PricingFields from './PricingFields'
import OrganizationFields from './OrganizationFields'
import ProductImages from './ProductImages'
import PublicationFields from './PublicationFields'
import cloneDeep from 'lodash/cloneDeep'
import { HiOutlineTrash } from 'react-icons/hi'
import { AiOutlineSave } from 'react-icons/ai'
import * as Yup from 'yup'
import type { CurrencyCode } from '@/store'
import { useAppSelector } from '@/store'
import { apiGetSystemConfig } from '@/services/SettingsService'
import { deriveInventoryStatus } from '@/utils/inventory'
import {
    DEFAULT_SALES_UNIT,
    SALES_UNIT_VALUES,
    type SalesUnit,
} from '@/constants/product.constant'
import { sanitizeString } from '@/utils/security/inputGuards'
import { formatCurrencyOptionLabel } from '@/utils/currency'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import VariantConfigurator from './VariantConfigurator'
import type { ParametricConfiguratorDraft } from './ParametricConfigurator'
import type { ProductMode, ProductAttribute, ProductVariant } from './types'
import { clientConfig } from '@/configs/clientConfig'

const sanitizeCurrencyCode = (value?: string | null): CurrencyCode | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim()
    if (!trimmed) {
        return undefined
    }
    const upper = trimmed.toUpperCase()
    if (/^[A-Z]{3,5}$/.test(upper)) {
        return upper as CurrencyCode
    }
    const cleaned = upper.replace(/[^A-Z]/g, '')
    if (/^[A-Z]{3,5}$/.test(cleaned)) {
        return cleaned as CurrencyCode
    }
    return undefined
}

const areCurrencyListsEqual = (a: CurrencyCode[], b: CurrencyCode[]) =>
    a.length === b.length && a.every((code, index) => code === b[index])

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type FormikRef = FormikProps<any>

type InitialData = {
    id: number
    name?: string
    productCode?: string
    img?: string
    imgList?: {
        id: string
        name: string
        img: string
    }[]
    categoryId?: number | null
    costPrice?: number
    salePrice?: number
    stock?: number
    status?: number
    bulkDiscountPrice?: number
    tags?: string[]
    brand?: string
    vendor?: string
    description?: string
    specifications?: string
    published?: boolean
    permanentStock?: boolean
    currency?: CurrencyCode
    unitOfMeasure?: SalesUnit
    mode?: ProductMode
    attributes?: ProductAttribute[]
    variants?: ProductVariant[]
    parametricDraft?: ParametricConfiguratorDraft | null
}

export type FormModel = Omit<InitialData, 'tags' | 'permanentStock'> & {
    tags: string[]
    permanentStock: boolean
    unitOfMeasure: SalesUnit
    mode: ProductMode
    attributes: ProductAttribute[]
    variants: ProductVariant[]
    parametricDraft?: ParametricConfiguratorDraft | null
}

export type SetSubmitting = (isSubmitting: boolean) => void

export type OnDeleteCallback = React.Dispatch<React.SetStateAction<boolean>>

type OnDelete = (callback: OnDeleteCallback) => void

type ProductForm = {
    initialData?: InitialData
    type: 'edit' | 'new'
    onDiscard?: () => void
    onDelete?: OnDelete
    onFormSubmit: (formData: FormModel, setSubmitting: SetSubmitting) => void
    allowedModes?: ProductMode[]
}

const validationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        name: Yup.string().required(t('text.validation.productNameRequired')),
        costPrice: Yup.number()
            .typeError(t('text.validation.costPriceRequired'))
            .required(t('text.validation.costPriceRequired'))
            .min(0, t('text.validation.costPriceMin')), 
        salePrice: Yup.number()
            .typeError(t('text.validation.salePriceRequired'))
            .required(t('text.validation.salePriceRequired'))
            .min(0, t('text.validation.salePriceMin')),
        stock: Yup.number()
            .typeError(t('text.validation.stockNumber') || 'Stock must be a number')
            .required(t('text.validation.stockRequired') || 'Stock is required')
            .min(0, t('text.validation.stockMin') || 'Stock cannot be negative'),
        categoryId: Yup.number()
            .nullable()
            .typeError(t('text.validation.categoryRequired'))
            .required(t('text.validation.categoryRequired')),
        unitOfMeasure: Yup.mixed<SalesUnit>()
            .oneOf(SALES_UNIT_VALUES)
            .required(t('text.validation.unitOfMeasureRequired')),
        mode: Yup.mixed<ProductMode>()
            .oneOf(['simple', 'variable', 'parametric'])
            .required(),
    })

const DeleteProductButton = ({ onDelete }: { onDelete: OnDelete }) => {
    const { t } = useTranslation()
    const [dialogOpen, setDialogOpen] = useState(false)

    const onConfirmDialogOpen = () => {
        setDialogOpen(true)
    }

    const onConfirmDialogClose = () => {
        setDialogOpen(false)
    }

    const handleConfirm = () => {
        onDelete?.(setDialogOpen)
    }

    return (
        <>
            <Button
                className="text-red-600"
                variant="plain"
                size="sm"
                icon={<HiOutlineTrash />}
                type="button"
                onClick={onConfirmDialogOpen}
            >
                {t('text.actions.delete')}
            </Button>
            <ConfirmDialog
                isOpen={dialogOpen}
                type="danger"
                title={t('text.titles.deleteProduct')}
                confirmButtonColor="red-600"
                onClose={onConfirmDialogClose}
                onRequestClose={onConfirmDialogClose}
                onCancel={onConfirmDialogClose}
                onConfirm={handleConfirm}
            >
                <p>{t('text.messages.deleteProductConfirm')}</p>
            </ConfirmDialog>
        </>
    )
}

const ProductForm = forwardRef<FormikRef, ProductForm>((props, ref) => {
    const {
        type,
        initialData: providedInitialData,
        onFormSubmit,
        onDiscard,
        onDelete,
        allowedModes,
    } = props

    // Keep a stable fallback payload so mode toggles are not reset on every render.
    const defaultInitialDataRef = useRef<InitialData>({
        id: 0,
        name: '',
        productCode: '',
        img: '',
        imgList: [],
        categoryId: null,
        costPrice: 0,
        salePrice: 0,
        stock: 0,
        status: 0,
        bulkDiscountPrice: 0,
        tags: [],
        brand: '',
        vendor: '',
        description: '',
        specifications: '',
        published: false,
        permanentStock: false,
        currency: 'UYU',
        unitOfMeasure: DEFAULT_SALES_UNIT,
        mode: 'simple',
        attributes: [],
        variants: [],
    })

    const initialData = providedInitialData ?? defaultInitialDataRef.current

    const isUrucortinas = clientConfig.slug === 'urucortinas'

    const availableModes = useMemo<ProductMode[]>(() => {
        const source = Array.isArray(allowedModes) && allowedModes.length ? allowedModes : ['simple', 'variable', 'parametric']
        const unique = Array.from(new Set(source))
        const filtered = unique.filter((item): item is ProductMode =>
            ['simple', 'variable', 'parametric'].includes(item),
        )
        if (isUrucortinas) {
            return filtered
        }
        return filtered.filter((item) => item !== 'parametric')
    }, [allowedModes, isUrucortinas])

    const initialMode = useMemo<ProductMode>(() => {
        const candidate = (initialData.mode ?? availableModes[0] ?? 'simple') as ProductMode
        if (availableModes.includes(candidate)) {
            return candidate
        }
        return availableModes[0] ?? 'simple'
    }, [availableModes, initialData.mode])

    const { t } = useTranslation()
    const currencyState = useAppSelector((state) => state.currency)

    const storeCurrencyInfo = useMemo(() => {
        const base = sanitizeCurrencyCode(currencyState?.code) ?? ('UYU' as CurrencyCode)
        const rawAvailable = Array.isArray(currencyState?.available) ? currencyState.available : []
        const normalizedAvailable = rawAvailable
            .map((code) => sanitizeCurrencyCode(code))
            .filter((code): code is CurrencyCode => Boolean(code))
        if (!normalizedAvailable.includes(base)) {
            normalizedAvailable.unshift(base)
        }
        return {
            base,
            allowed: Array.from(new Set(normalizedAvailable)),
        }
    }, [currencyState?.available, currencyState?.code])

    const [allowedCurrencyCodes, setAllowedCurrencyCodes] = useState<CurrencyCode[]>(
        storeCurrencyInfo.allowed,
    )

    const [configCurrencyOptions, setConfigCurrencyOptions] = useState<
        { value: CurrencyCode; label: string }[]
    >([])

    const [mode, setMode] = useState<ProductMode>(initialMode)
    const [attributeDefinitions, setAttributeDefinitions] = useState<ProductAttribute[]>
        (initialData.attributes ?? [])
    const [variantRows, setVariantRows] = useState<ProductVariant[]>(initialData.variants ?? [])
    const [parametricDraft, setParametricDraft] = useState<ParametricConfiguratorDraft | null>(null)

    const formRef = useRef<FormikRef | null>(null)

    useEffect(() => {
        if (!currencyState?.loaded) {
            return
        }
        const derived = storeCurrencyInfo.allowed
        setAllowedCurrencyCodes((prev) =>
            areCurrencyListsEqual(prev, derived) ? prev : derived,
        )
    }, [currencyState?.loaded, storeCurrencyInfo])

    useEffect(() => {
        let ignore = false
        const loadCurrencyOptions = async () => {
            try {
                const res = await apiGetSystemConfig<{
                    currencies?: string[]
                    currencyBase?: string
                    currencyOptions?: { code?: string; label?: string; symbol?: string }[]
                }>()
                if (ignore) {
                    return
                }
                const configBase =
                    sanitizeCurrencyCode(res.data?.currencyBase) ?? storeCurrencyInfo.base
                const configuredCurrencies = Array.isArray(res.data?.currencies)
                    ? res.data?.currencies
                    : []
                const normalizedAllowed = configuredCurrencies
                    .map((code) => sanitizeCurrencyCode(code))
                    .filter((code): code is CurrencyCode => Boolean(code))
                const ensuredAllowed = (() => {
                    const list = normalizedAllowed.length ? normalizedAllowed : [configBase]
                    if (!list.includes(configBase)) {
                        list.unshift(configBase)
                    }
                    return Array.from(new Set(list))
                })()
                setAllowedCurrencyCodes((prev) =>
                    areCurrencyListsEqual(prev, ensuredAllowed) ? prev : ensuredAllowed,
                )
                const optionList = Array.isArray(res.data?.currencyOptions)
                    ? res.data?.currencyOptions
                    : []
                if (!optionList.length) {
                    setConfigCurrencyOptions([])
                    return
                }
                const mapped = optionList
                    .map((item) => {
                        const code = sanitizeCurrencyCode(item?.code)
                        if (!code) {
                            return null
                        }
                        return {
                            value: code,
                            label: formatCurrencyOptionLabel(code, item?.label, item?.symbol),
                        }
                    })
                    .filter(Boolean) as { value: CurrencyCode; label: string }[]
                setConfigCurrencyOptions(mapped)
            } catch {
                if (ignore) {
                    return
                }
                setConfigCurrencyOptions((prev) => prev)
            }
        }
        loadCurrencyOptions()
        return () => {
            ignore = true
        }
    }, [storeCurrencyInfo.base])

    const allowedCurrencyOptions = useMemo(
        () => {
            if (!allowedCurrencyCodes.length) {
                return [
                    {
                        value: storeCurrencyInfo.base,
                        label: storeCurrencyInfo.base,
                    },
                ]
            }
            const labelMap = new Map<CurrencyCode, string>()
            configCurrencyOptions.forEach((option) => {
                labelMap.set(option.value, option.label)
            })
            return allowedCurrencyCodes.map((code) => ({
                value: code,
                label: labelMap.get(code) ?? code,
            }))
        },
        [allowedCurrencyCodes, configCurrencyOptions, storeCurrencyInfo.base],
    )

    useEffect(() => {
        setMode((current) => {
            if (current === initialMode) {
                return current
            }
            return initialMode
        })
    }, [initialMode])

    useEffect(() => {
        setAttributeDefinitions(initialData.attributes ?? [])
    }, [initialData.attributes])

    useEffect(() => {
        setVariantRows(initialData.variants ?? [])
    }, [initialData.variants])

    useEffect(() => {
        if (formRef.current) {
            formRef.current.setFieldValue('mode', mode, false)
        }
    }, [mode])

    useEffect(() => {
        if (formRef.current) {
            formRef.current.setFieldValue('attributes', attributeDefinitions, false)
        }
    }, [attributeDefinitions])

    useEffect(() => {
        if (formRef.current) {
            formRef.current.setFieldValue('variants', variantRows, false)
        }
    }, [variantRows])

    useEffect(() => {
        if (!availableModes.includes(mode)) {
            setMode(availableModes[0] ?? initialMode)
        }
    }, [availableModes, mode, initialMode])

    useEffect(() => {
        if (!availableModes.includes('parametric')) {
            setParametricDraft(null)
        }
    }, [availableModes])

    const handleModeChange = useCallback(
        (nextMode: ProductMode) => {
            if (!availableModes.includes(nextMode)) {
                return
            }
            setMode(nextMode)
        },
        [availableModes],
    )

    const handleAttributesUpdate = useCallback((nextAttributes: ProductAttribute[]) => {
        setAttributeDefinitions(nextAttributes)
    }, [])

    const handleVariantsUpdate = useCallback((nextVariants: ProductVariant[]) => {
        setVariantRows(nextVariants)
    }, [])

    const handleParametricDraftChange = useCallback((draft: ParametricConfiguratorDraft | null) => {
        setParametricDraft(draft)
    }, [])

    useEffect(() => {
        if (mode !== 'parametric' && parametricDraft) {
            setParametricDraft(null)
        }
    }, [mode, parametricDraft])

    return (
        <>
            <Formik
                innerRef={(instance) => {
                    formRef.current = instance
                    if (ref) {
                        if (typeof ref === 'function') {
                            ref(instance)
                        } else {
                            ;(ref as MutableRefObject<FormikRef | null>).current = instance
                        }
                    }
                }}
                enableReinitialize
                initialValues={{
                    ...initialData,
                    id: Number(initialData.id ?? 0),
                    specifications:
                        typeof initialData.specifications === 'string'
                            ? initialData.specifications
                            : '',
                    categoryId:
                        initialData.categoryId !== undefined && initialData.categoryId !== null
                            ? Number(initialData.categoryId)
                            : null,
                    published:
                        typeof initialData.published === 'boolean'
                            ? initialData.published
                            : false,
                    currency: (initialData.currency || 'UYU') as CurrencyCode,
                    tags: Array.isArray(initialData?.tags)
                        ? (initialData.tags as string[])
                        : [],
                    permanentStock: Boolean(initialData.permanentStock),
                    unitOfMeasure:
                        (initialData.unitOfMeasure ??
                            DEFAULT_SALES_UNIT) as SalesUnit,
                    mode,
                    attributes: attributeDefinitions,
                    variants: variantRows,
                    parametricDraft,
                }}
                validationSchema={validationSchema(t)}
                onSubmit={(values: FormModel, { setSubmitting }) => {
                    const baseData = cloneDeep(values)
                    baseData.tags = (baseData.tags || []).map((tag) =>
                        typeof tag === 'string' ? tag : tag.value,
                    )
                    baseData.currency = ((baseData.currency || 'UYU') as string).toUpperCase()
                    if (typeof baseData.description === 'string') {
                        baseData.description = sanitizeString(baseData.description)
                    }
                    if (typeof baseData.specifications === 'string') {
                        baseData.specifications = sanitizeString(baseData.specifications)
                    }

                    ;(['salePrice', 'costPrice', 'stock', 'status', 'bulkDiscountPrice', 'categoryId'] as const).forEach(
                        (key) => {
                            const value = (baseData as Record<string, unknown>)[key]
                            if (value !== undefined && value !== null && value !== '') {
                                ;(baseData as Record<string, unknown>)[key] = Number(value)
                            }
                        },
                    )

                    baseData.id = Number(baseData.id ?? 0)
                    if (type === 'new') {
                        baseData.id = 0
                        if (baseData.imgList && baseData.imgList.length > 0) {
                            baseData.img = baseData.imgList[0].img
                        }
                    }

                    const numericStock = Number(baseData.stock ?? 0)
                    const isPermanent = Boolean(baseData.permanentStock)
                    baseData.status = deriveInventoryStatus(
                        Number.isNaN(numericStock) ? 0 : numericStock,
                        isPermanent,
                    )

                    if (mode === 'variable') {
                        if (!attributeDefinitions.length) {
                            toast.push(
                                <Notification
                                    title={t('sales.productForm.variants.error.noAttributes', {
                                        defaultValue:
                                            'Seleccioná al menos un atributo para generar variantes.',
                                    })}
                                    type="danger"
                                />,
                                { placement: 'top-center' },
                            )
                            setSubmitting(false)
                            return
                        }
                        const hasValues = attributeDefinitions.every(
                            (attribute) => attribute.values.length > 0,
                        )
                        if (!hasValues) {
                            toast.push(
                                <Notification
                                    title={t('sales.productForm.variants.error.emptyValues', {
                                        defaultValue: 'Cada atributo debe tener al menos un valor.',
                                    })}
                                    type="danger"
                                />,
                                { placement: 'top-center' },
                            )
                            setSubmitting(false)
                            return
                        }
                        if (!variantRows.length) {
                            toast.push(
                                <Notification
                                    title={t('sales.productForm.variants.error.noVariants', {
                                        defaultValue: 'Configurá al menos una variante antes de guardar.',
                                    })}
                                    type="danger"
                                />,
                                { placement: 'top-center' },
                            )
                            setSubmitting(false)
                            return
                        }
                    }

                    const attributePayload =
                        mode === 'variable'
                            ? attributeDefinitions.map((attribute, attributeIndex) => ({
                                  id: attribute.id,
                                  type: attribute.type,
                                  name: attribute.name,
                                  sortOrder: attribute.sortOrder ?? attributeIndex,
                                  values: attribute.values.map((value, valueIndex) => ({
                                      id: value.id,
                                      key: value.key,
                                      label: value.label,
                                      value: value.value,
                                      colorHex: value.colorHex,
                                      imageUrl: value.imageUrl,
                                      imageAlt: value.imageAlt,
                                      sortOrder: value.sortOrder ?? valueIndex,
                                  })),
                              }))
                            : []

                    const variantPayload =
                        mode === 'variable'
                            ? variantRows.map((variant) => ({
                                  id: variant.id,
                                  key: variant.key,
                                  attributes: variant.attributes.map((attribute) => ({
                                      attribute: attribute.attribute,
                                      valueKey: attribute.valueKey,
                                      optionValueId: attribute.optionValueId,
                                  })),
                                  sku: variant.inheritSku ? undefined : variant.sku || undefined,
                                  barcode: variant.barcode || undefined,
                                  label: variant.label || undefined,
                                  salePrice:
                                      variant.inheritSalePrice || variant.salePrice === null
                                          ? undefined
                                          : Number(variant.salePrice),
                                  costPrice:
                                      variant.inheritCostPrice || variant.costPrice === null
                                          ? undefined
                                          : Number(variant.costPrice),
                                  stock:
                                      variant.inheritStock || variant.stock === null
                                          ? undefined
                                          : Number(variant.stock),
                                  permanentStock: variant.inheritStock
                                      ? undefined
                                      : variant.permanentStock ?? undefined,
                                  isActive: variant.isActive,
                                  inheritSalePrice: variant.inheritSalePrice,
                                  inheritCostPrice: variant.inheritCostPrice,
                                  inheritStock: variant.inheritStock,
                                  inheritSku: variant.inheritSku,
                                  inheritImages: variant.inheritImages,
                                  images: variant.images,
                              }))
                            : []

                    const submitData: FormModel = {
                        ...baseData,
                        mode,
                        attributes: attributePayload,
                        variants: variantPayload,
                        parametricDraft,
                    }
                    delete (submitData as Record<string, unknown>).status
                    onFormSubmit?.(submitData, setSubmitting)
                }}
            >
                {({ values, touched, errors, isSubmitting, setFieldValue }) => {
                    const currentCurrencyCode = String(values.currency || '').toUpperCase() as CurrencyCode
                    const currencyOptionsForSelect = allowedCurrencyOptions.some(
                        (option) => option.value === currentCurrencyCode,
                    )
                        ? allowedCurrencyOptions
                        : allowedCurrencyOptions.concat({
                              value: currentCurrencyCode,
                              label: currentCurrencyCode,
                          })

                    return (
                        <Form>
                            <FormContainer>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2 flex flex-col gap-4">
                                        <BasicInformationFields
                                            touched={touched}
                                            errors={errors}
                                        />
                                        <PricingFields
                                            touched={touched as any}
                                            errors={errors as any}
                                            currency={values.currency as CurrencyCode}
                                            currencyOptions={currencyOptionsForSelect}
                                            onCurrencyChange={(code) => setFieldValue('currency', code)}
                                        />
                                        <VariantConfigurator
                                            mode={mode}
                                            attributes={attributeDefinitions}
                                            variants={variantRows}
                                            basePrice={Number(values.salePrice ?? 0)}
                                            baseStock={Number(values.stock ?? 0)}
                                            currency={currentCurrencyCode}
                                            productId={Number(values.id ?? 0)}
                                            onModeChange={handleModeChange}
                                            onAttributesChange={handleAttributesUpdate}
                                            onVariantsChange={handleVariantsUpdate}
                                            parametricDraft={parametricDraft}
                                            onParametricDraftChange={handleParametricDraftChange}
                                            allowedModes={availableModes}
                                        />
                                        <PublicationFields
                                            touched={touched as any}
                                            errors={errors as any}
                                            values={values as any}
                                            setFieldValue={setFieldValue}
                                        />
                                        <OrganizationFields
                                            touched={touched}
                                            errors={errors}
                                            values={values}
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <ProductImages values={values} />
                                    </div>
                                </div>
                                <StickyFooter
                                    className="w-full px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                    stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                >
                                    <div className="w-full sm:w-auto">
                                        {type === 'edit' && (
                                            <DeleteProductButton onDelete={onDelete as OnDelete} />
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                        <Button
                                            size="sm"
                                            className="w-full sm:w-auto"
                                            type="button"
                                            onClick={() => onDiscard?.()}
                                        >
                                            {t('text.actions.discard')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="solid"
                                            loading={isSubmitting}
                                            icon={<AiOutlineSave />}
                                            type="submit"
                                            className="w-full sm:w-auto"
                                        >
                                            {t('text.actions.save')}
                                        </Button>
                                    </div>
                                </StickyFooter>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
        </>
    )
})

ProductForm.displayName = 'ProductForm'

export default ProductForm
