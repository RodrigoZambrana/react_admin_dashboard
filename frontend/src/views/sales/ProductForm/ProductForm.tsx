import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
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
    published?: boolean
    permanentStock?: boolean
    currency?: CurrencyCode
}

export type FormModel = Omit<InitialData, 'tags' | 'permanentStock'> & {
    tags: string[]
    permanentStock: boolean
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
        initialData = {
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
            permanentStock: false,
            currency: 'UYU',
        },
        onFormSubmit,
        onDiscard,
        onDelete,
    } = props

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

    useEffect(() => {
        if (!currencyState?.loaded) {
            return
        }
        const derived = storeCurrencyInfo.allowed
        setAllowedCurrencyCodes((prev) =>
            areCurrencyListsEqual(prev, derived) ? prev : derived,
        )
    }, [currencyState?.loaded, storeCurrencyInfo])

    const formatCurrencyOptionLabel = useCallback(
        (code: string, text?: string, symbol?: string) => {
            const parts = [code]
            const trimmedText = text?.trim()
            if (trimmedText) {
                parts.push(trimmedText)
            }
            const suffix = symbol?.trim()
            return suffix ? `${parts.join(' · ')} (${suffix})` : parts.join(' · ')
        },
        [],
    )

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
    }, [formatCurrencyOptionLabel, storeCurrencyInfo.base])

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

    return (
        <>
            <Formik
                innerRef={ref}
                initialValues={{
                    ...initialData,
                    id: Number(initialData.id ?? 0),
                    categoryId:
                        initialData.categoryId !== undefined && initialData.categoryId !== null
                            ? Number(initialData.categoryId)
                            : null,
                    published:
                        typeof initialData.published === 'boolean'
                            ? initialData.published
                            : true,
                    currency: (initialData.currency || 'UYU') as CurrencyCode,
                    tags: Array.isArray(initialData?.tags)
                        ? (initialData.tags as string[])
                        : [],
                    permanentStock: Boolean(initialData.permanentStock),
                }}
                validationSchema={validationSchema(t)}
                onSubmit={(values: FormModel, { setSubmitting }) => {
                    const formData = cloneDeep(values)
                    formData.tags = (formData.tags || []).map((tag) => {
                        if (typeof tag !== 'string') {
                            return tag.value
                        }
                        return tag
                    })
                    formData.currency = ((formData.currency || 'UYU') as string).toUpperCase()
                    // Normalize numeric fields to numbers
                    ;(['salePrice', 'costPrice', 'stock', 'status', 'bulkDiscountPrice', 'categoryId'] as const).forEach((k) => {
                        const v: any = (formData as any)[k]
                        if (v !== undefined && v !== null && v !== '') {
                            ;(formData as any)[k] = Number(v)
                        }
                    })
                    formData.id = Number(formData.id ?? 0)
                    if (type === 'new') {
                        formData.id = 0
                        if (formData.imgList && formData.imgList.length > 0) {
                            formData.img = formData.imgList[0].img
                        }
                    }
                    const numericStock = Number(formData.stock ?? 0)
                    const isPermanent = Boolean(formData.permanentStock)
                    formData.status = deriveInventoryStatus(
                        Number.isNaN(numericStock) ? 0 : numericStock,
                        isPermanent,
                    )
                    const submitData = { ...formData }
                    delete (submitData as any).status
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
