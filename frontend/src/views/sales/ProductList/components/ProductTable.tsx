import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import { apiPutSalesProduct } from '@/services/SalesService'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import { FiPackage } from 'react-icons/fi'
import Switcher from '@/components/ui/Switcher'
import Button from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip'
import {
    getProducts,
    setTableData,
    setSelectedProduct,
    toggleDeleteConfirmation,
    updateProductList,
    setSelectedProducts,
    useAppDispatch,
    useAppSelector,
} from '../store'
import useThemeClass from '@/utils/hooks/useThemeClass'
import ProductDeleteConfirmation from './ProductDeleteConfirmation'
import ProductBulkDeleteConfirmation from './ProductBulkDeleteConfirmation'
import { useNavigate } from 'react-router-dom'
import cloneDeep from 'lodash/cloneDeep'
import { deriveInventoryStatus } from '@/utils/inventory'
import { resolveTextDirection } from '@/utils/textDirection'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import type {
    DataTableResetHandle,
    OnSortParam,
    ColumnDef,
    Row,
} from '@/components/shared/DataTable'
import {
    DEFAULT_SALES_UNIT,
    getSalesUnitLabel,
    type SalesUnit,
} from '@/constants/product.constant'
import {
    computePrice as computeAberturasPrice,
    normalizeSelectionByAvailability,
    type ProductRow as AberturasProductRow,
    type Selection as AberturasSelection,
    type ShutterKind,
} from '@/views/sales/parametric/pricingHelpers'
import { applyMarginToCost } from '@/views/sales/parametric/priceUtils'

type ParametricShutterOption = {
    price?: number | null
    priceMosq?: number | null
}

type ParametricPricing = {
    currency?: string
    basePrice?: number | null
    mosquiteroPrice?: number | null
    shutterOptions?: Record<string, ParametricShutterOption>
}

type Product = {
    id: string
    name: string
    productCode: string
    img: string
    category: string
    salePrice: number
    costPrice: number
    stock: number
    status: number
    published?: boolean
    brand?: string
    vendor?: string
    permanentStock?: boolean
    currency?: string
    unitOfMeasure?: SalesUnit
    specifications?: string
    description?: string | null
    familySummary?: string
    familyId?: string
    serieSummary?: string
    widthSummary?: string
    heightSummary?: string
    colorSummary?: string
    glassSummary?: string
    mosquiteroAvailable?: boolean
    monoblockAvailable?: boolean
    shutterMaterialSummary?: string
    parametricSku?: string
    parametricPricing?: ParametricPricing | null
}

export type ProductTableRow = Product

export type ProductTableHiddenColumn = 'sku' | 'specifications' | 'published' | 'costPrice'

type ProductTableProps = {
    dataOverride?: ProductTableRow[]
    loadingOverride?: boolean
    hiddenColumns?: ProductTableHiddenColumn[]
    disableAutoFetch?: boolean
    forceParametricMode?: boolean
    marginPercent?: number
}

type RowOptionState = {
    mosquitero: boolean
    shutterMaterial?: string
}

type AvailabilityInfo = {
    comboOnly: boolean
    comboMaterials: string[]
    baseAvailable: boolean
    mosqAvailable: boolean
    standaloneShutterMaterials: string[]
    requiresSelection: boolean
}

type ComputedPricing = {
    cost: number
    sale: number
    currency?: string
    available: boolean
}

const roundTwo = (value: number) => Math.round(value * 100) / 100

const normalizePrice = (value?: number | null): number => {
    const numeric = Number(value ?? 0)
    return Number.isFinite(numeric) && numeric > 0 ? roundTwo(numeric) : 0
}

const resolveShutterKindFromLabel = (label?: string | null): ShutterKind => {
    const normalized = label?.toString().trim().toLowerCase() ?? ''
    if (!normalized) {
        return 'none'
    }
    if (normalized.includes('pvc')) {
        return 'pvc'
    }
    if (normalized.includes('alu')) {
        return 'aluminio'
    }
    if (normalized.includes('gen')) {
        return 'aluminio'
    }
    return 'none'
}

const buildPricingRowFromSummary = (pricing?: ParametricPricing | null): AberturasProductRow | null => {
    if (!pricing) {
        return null
    }
    const row: AberturasProductRow = {
        price_base: normalizePrice(pricing.basePrice),
        price_mosquitero: normalizePrice(pricing.mosquiteroPrice),
        price_pvc_shutter: 0,
        price_pvc_shutter_mosq: 0,
        price_aluminio_shutter: 0,
        price_aluminio_shutter_mosq: 0,
    }
    Object.entries(pricing.shutterOptions ?? {}).forEach(([material, option]) => {
        const kind = resolveShutterKindFromLabel(material)
        if (kind === 'pvc') {
            row.price_pvc_shutter = Math.max(row.price_pvc_shutter, normalizePrice(option?.price))
            row.price_pvc_shutter_mosq = Math.max(
                row.price_pvc_shutter_mosq,
                normalizePrice(option?.priceMosq),
            )
        } else if (kind === 'aluminio') {
            row.price_aluminio_shutter = Math.max(row.price_aluminio_shutter, normalizePrice(option?.price))
            row.price_aluminio_shutter_mosq = Math.max(
                row.price_aluminio_shutter_mosq,
                normalizePrice(option?.priceMosq),
            )
        }
    })
    const hasValues = Object.values(row).some((value) => value > 0)
    return hasValues ? row : null
}

const convertOptionStateToSelection = (state: RowOptionState): { selection: AberturasSelection; kind: ShutterKind } => {
    const kind = resolveShutterKindFromLabel(state.shutterMaterial)
    if (kind === 'none') {
        return {
            selection: {
                shutter: 'none',
                mosquitero: Boolean(state.mosquitero),
                shutterMosquitero: false,
            },
            kind,
        }
    }
    return {
        selection: {
            shutter: kind,
            mosquitero: false,
            shutterMosquitero: Boolean(state.mosquitero),
        },
        kind,
    }
}

const ActionColumn = ({ row }: { row: Product }) => {
    const dispatch = useAppDispatch()
    const { textTheme } = useThemeClass()
    const navigate = useNavigate()

    const onEdit = () => {
        navigate(`/app/products/edit/${row.id}`)
    }

    const onDelete = () => {
        dispatch(toggleDeleteConfirmation(true))
        dispatch(setSelectedProduct(row.id))
    }

    return (
        <div className="flex justify-end text-lg">
            <span
                className={`cursor-pointer p-2 hover:${textTheme}`}
                onClick={onEdit}
            >
                <HiOutlinePencil />
            </span>
            <span
                className="cursor-pointer p-2 hover:text-red-500"
                onClick={onDelete}
            >
                <HiOutlineTrash />
            </span>
        </div>
    )
}

const ProductColumn = ({ row }: { row: Product }) => {
    const avatar = row.img ? (
        <Avatar src={row.img} />
    ) : (
        <Avatar icon={<FiPackage />} />
    )

    return (
        <div className="flex items-center">
            {avatar}
            <span className={`ml-2 rtl:mr-2 font-semibold`}>{row.name}</span>
        </div>
    )
}

const ProductTable = ({
    dataOverride,
    loadingOverride,
    hiddenColumns = [],
    disableAutoFetch = false,
    forceParametricMode,
    marginPercent,
}: ProductTableProps = {}) => {
    const { t, i18n } = useTranslation()
    const tableRef = useRef<DataTableResetHandle>(null)

    const dispatch = useAppDispatch()

    const { pageIndex, pageSize, sort, query, total } = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )

    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

    const storeLoading = useAppSelector(
        (state) => state.salesProductList.data.loading,
    )

    const storeData = useAppSelector(
        (state) => state.salesProductList.data.productList,
    )

    const loading = loadingOverride ?? storeLoading
    const data = dataOverride ?? storeData
    const selectedProductIds = useAppSelector(
        (state) => state.salesProductList.data.selectedProductIds,
    )

    const updateProductRow = useCallback(
        (id: string, updates: Partial<Product>) => {
            const nextState = data.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
            )
            dispatch(updateProductList(nextState))
        },
        [data, dispatch],
    )

    const fetchData = useCallback(() => {
        dispatch(getProducts({ pageIndex, pageSize, sort, query, filterData }))
    }, [dispatch, pageIndex, pageSize, sort, query, filterData])

    useEffect(() => {
        if (disableAutoFetch || dataOverride) {
            return
        }
        fetchData()
    }, [dataOverride, disableAutoFetch, fetchData])

    useEffect(() => {
        if (tableRef) {
            tableRef.current?.resetSorting()
        }
    }, [filterData])

    const tableData = useMemo(() => {
        if (dataOverride) {
            const count = dataOverride.length
            return {
                pageIndex: 1,
                pageSize: Math.max(count, 1),
                sort: { order: '', key: '' },
                query: '',
                total: count,
            }
        }
        return { pageIndex, pageSize, sort, query, total }
    }, [dataOverride, pageIndex, pageSize, sort, query, total])

    const defaultCurrency = useAppSelector((state) => state.currency.code)
    const fallbackCurrency = useMemo(
        () => normalizeCurrencyCode(defaultCurrency, 'UYU') || 'UYU',
        [defaultCurrency],
    )

    const formatCurrencyValue = useCallback(
        (amount: number, currency?: string) =>
            formatCurrency(amount, currency, i18n.language, {
                fallbackCurrency,
            }),
        [fallbackCurrency, i18n.language],
    )

    const [optionSelections, setOptionSelections] = useState<Record<string, RowOptionState>>({})

    const evaluateAvailability = useCallback((row: Product): AvailabilityInfo => {
        const pricing = row.parametricPricing
        if (!pricing) {
            return {
                comboOnly: false,
                comboMaterials: [],
                baseAvailable: false,
                mosqAvailable: false,
                standaloneShutterMaterials: [],
                requiresSelection: false,
            }
        }
        const baseAvailable = Number(pricing.basePrice ?? 0) > 0
        const mosqAvailable = Number(pricing.mosquiteroPrice ?? 0) > 0
        const shutterDetails = Object.entries(pricing.shutterOptions ?? {})
            .map(([material, option]) => {
                const standalone = Number(option?.price ?? 0)
                const combo = Number(option?.priceMosq ?? 0)
                return { material, standalone, combo }
            })
            .filter((entry) => entry.standalone > 0 || entry.combo > 0)

        const standaloneShutterMaterials = shutterDetails
            .filter((entry) => entry.standalone > 0)
            .map((entry) => entry.material)
        const comboMaterials = shutterDetails
            .filter((entry) => entry.combo > 0 && entry.standalone <= 0)
            .map((entry) => entry.material)

        const hasStandaloneShutter = standaloneShutterMaterials.length > 0
        const comboOnly =
            !baseAvailable && !mosqAvailable && !hasStandaloneShutter && comboMaterials.length > 0
        const requiresSelection = !baseAvailable && (mosqAvailable || shutterDetails.length > 0)

        return {
            comboOnly,
            comboMaterials,
            baseAvailable,
            mosqAvailable,
            standaloneShutterMaterials,
            requiresSelection,
        }
    }, [])

    const deriveDefaultSelection = useCallback(
        (row: Product, availabilityOverride?: AvailabilityInfo): RowOptionState => {
            const availability = availabilityOverride ?? evaluateAvailability(row)
            if (availability.comboOnly && availability.comboMaterials.length) {
                return {
                    mosquitero: true,
                    shutterMaterial: availability.comboMaterials[0],
                }
            }
            if (availability.requiresSelection) {
                if (availability.mosqAvailable) {
                    return { mosquitero: true }
                }
                if (availability.standaloneShutterMaterials.length) {
                    return {
                        mosquitero: false,
                        shutterMaterial: availability.standaloneShutterMaterials[0],
                    }
                }
            }
            return { mosquitero: false }
        },
        [evaluateAvailability],
    )

    const normalizeSelectionForRow = useCallback(
        (row: Product, selection?: RowOptionState | null): RowOptionState => {
            const availability = evaluateAvailability(row)
            const pricing = row.parametricPricing

            const isValid = (candidate?: RowOptionState | null) => {
                if (!candidate) {
                    return false
                }
                if (availability.comboOnly) {
                    return (
                        candidate.mosquitero &&
                        Boolean(candidate.shutterMaterial) &&
                        availability.comboMaterials.includes(candidate.shutterMaterial as string)
                    )
                }
                if (candidate.shutterMaterial) {
                    const option = pricing?.shutterOptions?.[candidate.shutterMaterial]
                    if (!option) {
                        return false
                    }
                    const standalone = Number(option.price ?? 0)
                    const combo = Number(option.priceMosq ?? 0)
                    if (candidate.mosquitero) {
                        return combo > 0 || availability.mosqAvailable
                    }
                    return standalone > 0
                }
                if (candidate.mosquitero) {
                    return availability.mosqAvailable
                }
                return availability.baseAvailable || !availability.requiresSelection
            }

            if (isValid(selection)) {
                return selection as RowOptionState
            }
            return deriveDefaultSelection(row, availability)
        },
        [deriveDefaultSelection, evaluateAvailability],
    )

    useEffect(() => {
        setOptionSelections((prev) => {
            const next: Record<string, RowOptionState> = {}
            data.forEach((row) => {
                next[row.id] = normalizeSelectionForRow(row, prev[row.id])
            })
            return next
        })
    }, [data, normalizeSelectionForRow])

    const getSelectionForRow = useCallback(
        (row: Product): RowOptionState =>
            normalizeSelectionForRow(row, optionSelections[row.id]),
        [normalizeSelectionForRow, optionSelections],
    )

    const computeEffectivePrices = useCallback(
        (row: Product): ComputedPricing => {
            const selectionState = getSelectionForRow(row)
            const pricing = row.parametricPricing
            const currency = pricing?.currency || row.currency
            if (!pricing) {
                return {
                    sale: Number(row.salePrice ?? 0),
                    cost: Number(row.costPrice ?? 0),
                    currency,
                    available: true,
                }
            }
            const kind = resolveShutterKindFromLabel(selectionState.shutterMaterial)
            const pricingRow = buildPricingRowFromSummary(pricing)
            if (pricingRow) {
                const normalized = normalizeSelectionForRow(row, selectionState)
                const normalizedSelection = convertOptionStateToSelection(normalized).selection
                const result = computeAberturasPrice(
                    pricingRow,
                    normalizeSelectionByAvailability(pricingRow, normalizedSelection),
                    marginPercent ?? 0,
                )
                if (result.available || kind !== 'none' || !selectionState.shutterMaterial) {
                    return {
                        sale: result.sale,
                        cost: result.cost,
                        currency,
                        available: result.available,
                    }
                }
            }
            const option = selectionState.shutterMaterial
                ? pricing.shutterOptions?.[selectionState.shutterMaterial]
                : undefined
            let rawCost = 0
            if (selectionState.shutterMaterial && option) {
                rawCost = selectionState.mosquitero ? Number(option?.priceMosq ?? 0) : Number(option?.price ?? 0)
            } else {
                rawCost = selectionState.mosquitero ? Number(pricing.mosquiteroPrice ?? 0) : Number(pricing.basePrice ?? 0)
            }
            const cost = normalizePrice(rawCost)
            const sale = applyMarginToCost(cost, marginPercent ?? 0)
            return {
                sale,
                cost,
                currency,
                available: cost > 0,
            }
        },
        [getSelectionForRow, marginPercent, normalizeSelectionForRow],
    )

    const renderMosquiteroControl = useCallback(
        (row: Product) => {
            const selection = getSelectionForRow(row)
            const pricing = row.parametricPricing
            const availability = evaluateAvailability(row)
            const effectiveMosq = availability.comboOnly ? true : selection.mosquitero
            const selectedShutter = selection.shutterMaterial
            const selectedOption = selectedShutter
                ? pricing?.shutterOptions?.[selectedShutter]
                : undefined
            const baseMosqAvailable = Boolean(
                pricing?.mosquiteroPrice && pricing.mosquiteroPrice > 0,
            )
            const selectedMosqAvailable = Boolean(
                selectedOption?.priceMosq && selectedOption.priceMosq > 0,
            )
            const mosqEnabledForSelection = selectedShutter
                ? selectedMosqAvailable
                : baseMosqAvailable
            const lockedByCombo = availability.comboOnly
            const priceUnavailable =
                !mosqEnabledForSelection ||
                (availability.requiresSelection && !availability.mosqAvailable && !selectedMosqAvailable)
            const mosqDisabled = !lockedByCombo && priceUnavailable
            const mosqTooltip =
                lockedByCombo
                    ? t('sales.productList.tooltips.mosquitero.comboLocked', {
                          defaultValue: 'This product only has mosquito net + shutter pricing.',
                      })
                    : mosqDisabled && selectedShutter
                    ? t('sales.productList.tooltips.mosquitero.selectedUnavailable', {
                          material:
                              selectedShutter?.trim() ||
                              t('sales.productList.options.genericShutter', { defaultValue: 'Generic' }),
                      })
                    : mosqDisabled
                        ? t('sales.productList.tooltips.mosquitero.baseUnavailable', {
                              defaultValue: 'This product has no mosquito net price.',
                          })
                        : undefined

            const handleMosqToggle = (value: boolean) => {
                if (lockedByCombo) {
                    return
                }
                if (mosqDisabled && value) {
                    return
                }
                setOptionSelections((prev) => {
                    const current = prev[row.id] ?? { mosquitero: false }
                    if (!value && !availability.baseAvailable) {
                        if (!current.shutterMaterial) {
                            return prev
                        }
                        const option = pricing?.shutterOptions?.[current.shutterMaterial]
                        if (!option || Number(option?.price ?? 0) <= 0) {
                            return prev
                        }
                    }
                    let nextShutter = current.shutterMaterial
                    if (!value && current.shutterMaterial && pricing) {
                        const option =
                            pricing.shutterOptions?.[current.shutterMaterial]
                        const requiresMosq =
                            option &&
                            (!option.price || option.price <= 0) &&
                            option.priceMosq &&
                            option.priceMosq > 0
                        if (requiresMosq) {
                            nextShutter = undefined
                        }
                    }
                    return {
                        ...prev,
                        [row.id]: {
                            ...current,
                            mosquitero:
                                !availability.baseAvailable && !value && !current.shutterMaterial
                                    ? current.mosquitero
                                    : value,
                            shutterMaterial: nextShutter,
                        },
                    }
                })
            }

            const switcher = (
                <Switcher
                    checked={effectiveMosq}
                    onChange={handleMosqToggle}
                    disabled={mosqDisabled}
                    aria-label={t('sales.productList.options.mosquitero', {
                        defaultValue: 'Mosquitero',
                    })}
                />
            )

            return (
                <div className="flex items-center justify-center">
                    {mosqTooltip ? (
                        <Tooltip title={mosqTooltip}>
                            <span className="inline-flex">{switcher}</span>
                        </Tooltip>
                    ) : (
                        switcher
                    )}
                </div>
            )
        },
        [evaluateAvailability, getSelectionForRow, optionSelections, setOptionSelections, t],
    )

    const renderShutterControls = useCallback(
        (row: Product) => {
            const selection = getSelectionForRow(row)
            const pricing = row.parametricPricing
            const shutterEntries = Object.entries(pricing?.shutterOptions ?? {})
            const availability = evaluateAvailability(row)
            const forcedMaterial =
                availability.comboOnly && availability.comboMaterials.length
                    ? availability.comboMaterials[0]
                    : undefined
            const effectiveShutter = availability.comboOnly
                ? forcedMaterial ?? selection.shutterMaterial
                : selection.shutterMaterial

            const handleShutterToggle = (material: string, disabled: boolean) => {
                if (disabled) {
                    return
                }
                setOptionSelections((prev) => {
                    const current = prev[row.id] ?? { mosquitero: false }
                    const isSame = current.shutterMaterial === material
                    const nextMaterial = isSame ? undefined : material
                    const baseMosqAvailable = Boolean(
                        pricing?.mosquiteroPrice && pricing.mosquiteroPrice > 0,
                    )

                    if (!nextMaterial) {
                        if (availability.comboOnly) {
                            return prev
                        }
                        if (!availability.baseAvailable && !current.mosquitero) {
                            return prev
                        }
                        const canKeepMosq = baseMosqAvailable || current.mosquitero
                        return {
                            ...prev,
                            [row.id]: {
                                ...current,
                                shutterMaterial: undefined,
                                mosquitero: canKeepMosq ? current.mosquitero : false,
                            },
                        }
                    }

                    const nextOption = pricing?.shutterOptions?.[nextMaterial]
                    const optionStandalonePrice = Number(nextOption?.price ?? 0)
                    const optionComboPrice = Number(nextOption?.priceMosq ?? 0)
                    const optionSupportsMosq = optionComboPrice > 0
                    const optionRequiresMosq =
                        optionStandalonePrice <= 0 && optionComboPrice > 0

                    let nextMosq = current.mosquitero
                    if (optionRequiresMosq) {
                        nextMosq = true
                    } else if (!optionSupportsMosq && nextMosq) {
                        nextMosq = false
                    }

                    return {
                        ...prev,
                        [row.id]: {
                            ...current,
                            shutterMaterial: nextMaterial,
                            mosquitero: availability.comboOnly ? true : nextMosq,
                        },
                    }
                })
            }

            if (!shutterEntries.length) {
                return (
                    <div className="flex justify-center">
                        <Button size="xs" disabled className="pointer-events-none">
                            {t('sales.productList.options.noShutters', {
                                defaultValue: 'Sin persiana',
                            })}
                        </Button>
                    </div>
                )
            }

            return (
                <div className="flex flex-wrap gap-2">
                    {shutterEntries.map(([material, option]) => {
                        const label =
                            material?.trim() ||
                            t('sales.productList.options.genericShutter', {
                                defaultValue: 'Genérica',
                            })
                        const standalonePrice = Number(option?.price ?? 0)
                        const comboPrice = Number(option?.priceMosq ?? 0)
                        const optionAvailable =
                            standalonePrice > 0 || comboPrice > 0
                        const mosqActive = availability.comboOnly ? true : selection.mosquitero
                        const hardLocked = Boolean(forcedMaterial && forcedMaterial === material)
                        const computedDisabled =
                            !optionAvailable ||
                            (mosqActive && comboPrice <= 0 && !hardLocked)
                        let tooltipReason: string | undefined
                        if (!optionAvailable) {
                            tooltipReason = t('sales.productList.tooltips.shutter.noPrice', {
                                defaultValue: 'No price available for this shutter option.',
                            })
                        } else if (mosqActive && comboPrice <= 0 && !hardLocked) {
                            tooltipReason = t('sales.productList.tooltips.shutter.requiresMosquitero', {
                                defaultValue: 'Disable the mosquito net to use this shutter option.',
                            })
                        } else if (hardLocked) {
                            tooltipReason = t('sales.productList.tooltips.shutter.comboLocked', {
                                defaultValue: 'Only shutter + mosquito net combos are available.',
                            })
                        }
                        const active = selection.shutterMaterial === material
                        const isActive = effectiveShutter === material
                        const button = (
                            <Button
                                key={material || label}
                                size="xs"
                                variant={isActive ? 'solid' : 'twoTone'}
                                disabled={computedDisabled || hardLocked}
                                onClick={() =>
                                    handleShutterToggle(
                                        material,
                                        computedDisabled || hardLocked,
                                    )
                                }
                            >
                                {label}
                            </Button>
                        )
                        return tooltipReason ? (
                            <Tooltip key={`${material || label}-tooltip`} title={tooltipReason}>
                                <span className="inline-flex">{button}</span>
                            </Tooltip>
                        ) : (
                            button
                        )
                    })}
                </div>
            )
        },
        [evaluateAvailability, getSelectionForRow, optionSelections, setOptionSelections, t],
    )

    const resolveStockStatus = useMemo(() => {
        const styles = {
            0: {
                labelKey: 'text.status.inStock',
                dotClass: 'bg-emerald-500',
                textClass: 'text-emerald-500',
            },
            1: {
                labelKey: 'text.status.limited',
                dotClass: 'bg-amber-500',
                textClass: 'text-amber-500',
            },
            2: {
                labelKey: 'text.status.outOfStock',
                dotClass: 'bg-red-500',
                textClass: 'text-red-500',
            },
        } as const

        return (stockValue: number, permanent: boolean) => {
            const normalized = Number.isNaN(stockValue) ? 0 : stockValue
            const status = deriveInventoryStatus(normalized, permanent)
            return styles[status]
        }
    }, [])

    const isParametric = useMemo(() => {
        if (typeof forceParametricMode === 'boolean') {
            return forceParametricMode
        }
        const mode = filterData?.mode
        if (Array.isArray(mode)) {
            return mode.length === 1 && mode[0] === 'parametric'
        }
        return mode === 'parametric'
    }, [forceParametricMode, filterData?.mode])

    const selectionEnabled = isParametric && !dataOverride

    useEffect(() => {
        if (!selectionEnabled && selectedProductIds.length) {
            dispatch(setSelectedProducts([]))
            tableRef.current?.resetSelected()
        }
    }, [dispatch, selectionEnabled, selectedProductIds.length])

    useEffect(() => {
        if (!selectedProductIds.length) {
            tableRef.current?.resetSelected()
        }
    }, [selectedProductIds.length])

    const handleRowSelect = useCallback(
        (checked: boolean, row: Product) => {
            const id = String(row.id)
            const current = new Set(selectedProductIds)
            if (checked) {
                current.add(id)
            } else {
                current.delete(id)
            }
            dispatch(setSelectedProducts(Array.from(current)))
        },
        [dispatch, selectedProductIds],
    )

    const handleBulkSelect = useCallback(
        (checked: boolean, rows: Row<Product>[]) => {
            const ids = rows.map((row) => String((row.original as Product).id))
            if (!ids.length) {
                return
            }
            const current = new Set(selectedProductIds)
            ids.forEach((id) => {
                if (checked) {
                    current.add(id)
                } else {
                    current.delete(id)
                }
            })
            dispatch(setSelectedProducts(Array.from(current)))
        },
        [dispatch, selectedProductIds],
    )

    const columns: ColumnDef<Product>[] = useMemo(() => {
        const isColumnHidden = (key: ProductTableHiddenColumn) =>
            hiddenColumns?.includes(key) ?? false
        const cols: ColumnDef<Product>[] = [
            {
                header: t('text.columns.name'),
                accessorKey: 'name',
                cell: (props) => {
                    const row = props.row.original
                    return <ProductColumn row={row} />
                },
            },
        ]

        if (!isColumnHidden('sku')) {
            cols.push({
                header: t('text.labels.codeSku') || 'Code (SKU)',
                accessorKey: 'productCode',
                cell: (props) => {
                    const skuValue = props.row.original.productCode
                    return <span className="font-mono text-xs">{skuValue || '-'}</span>
                },
            })
        }

        cols.push(
            {
                header: isParametric
                    ? t('sales.productList.columns.serie', { defaultValue: 'Serie' })
                    : t('text.columns.category'),
                accessorKey: 'category',
                cell: (props) => {
                    const row = props.row.original
                    const value = isParametric
                        ? (row.serieSummary && row.serieSummary.trim()) || '—'
                        : row.category || '—'
                    return (
                        <span className={isParametric ? '' : 'capitalize'}>
                            {value}
                        </span>
                    )
                },
            },
        )

        if (!isParametric) {
            cols.push({
                header: t('text.labels.unitOfMeasure'),
                accessorKey: 'unitOfMeasure',
                enableSorting: false,
                cell: (props) => {
                    const unit = props.row.original.unitOfMeasure ?? DEFAULT_SALES_UNIT
                    return <span>{getSalesUnitLabel(unit, t)}</span>
                },
            })
        }

        if (!isParametric) {
            cols.push(
                {
                    header: t('text.labels.brand'),
                    accessorKey: 'brand',
                    cell: (props) => {
                        const brand = (props.row.original as any).brand
                        return <span>{brand || '—'}</span>
                    },
                },
                {
                    header: t('text.labels.vendor'),
                    accessorKey: 'vendor',
                    cell: (props) => {
                        const vendor = (props.row.original as any).vendor
                        return <span>{vendor || '—'}</span>
                    },
                },
            )
        }

        if (!isColumnHidden('specifications')) {
            cols.push({
                header: t('text.columns.specifications', {
                    defaultValue: 'Especificaciones',
                }),
                accessorKey: 'specifications',
                enableSorting: false,
                cell: (props) => {
                    const raw = props.row.original.specifications
                    const text =
                        typeof raw === 'string' && raw.trim().length > 0
                            ? raw.trim()
                            : '—'
                    return (
                        <span
                            className="whitespace-pre-wrap text-sm"
                            dir={resolveTextDirection(text)}
                        >
                            {text}
                        </span>
                    )
                },
            })
        }

        if (isParametric) {
            cols.push(
                {
                    header: t('sales.productList.columns.width', {
                        defaultValue: 'Ancho (mm)',
                    }),
                    accessorKey: 'widthSummary',
                    cell: (props) => {
                        const value = props.row.original.widthSummary?.trim()
                        return <span>{value || '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.height', {
                        defaultValue: 'Alto (mm)',
                    }),
                    accessorKey: 'heightSummary',
                    cell: (props) => {
                        const value = props.row.original.heightSummary?.trim()
                        return <span>{value || '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.glass', { defaultValue: 'Vidrio' }),
                    accessorKey: 'glassSummary',
                    cell: (props) => {
                        const value = props.row.original.glassSummary
                        return <span>{value && value.trim() ? value : '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.color', { defaultValue: 'Color' }),
                    accessorKey: 'colorSummary',
                    cell: (props) => {
                        const value = props.row.original.colorSummary
                        return <span>{value && value.trim() ? value : '—'}</span>
                    },
                },
                {
                    header: t('sales.productList.columns.mosquitero', { defaultValue: 'Mosquitero' }),
                    accessorKey: 'mosquiteroAvailable',
                    cell: (props) => renderMosquiteroControl(props.row.original),
                },
                {
                    header: t('sales.productList.columns.monoblock', { defaultValue: 'Monoblock' }),
                    accessorKey: 'monoblockAvailable',
                    cell: (props) => renderShutterControls(props.row.original),
                },
            )
        } else {
            cols.push(
                {
                    header: t('text.columns.stock'),
                    accessorKey: 'status',
                    cell: (props) => {
                        const row = props.row.original
                        const stockValue = Number(row.stock ?? 0)
                        const permanent = Boolean((row as any).permanentStock)
                        const status = resolveStockStatus(
                            Number.isNaN(stockValue) ? 0 : stockValue,
                            permanent,
                        )
                        return (
                            <div className="flex items-center gap-2">
                                <span className={`badge-dot ${status.dotClass}`} />
                                <span
                                    className={`capitalize font-semibold ${status.textClass}`}
                                >
                                    {t(status.labelKey)}
                                </span>
                            </div>
                        )
                    },
                },
                {
                    header: t('text.labels.permanentStock'),
                    accessorKey: 'permanentStock',
                    cell: (props) => {
                        const row = props.row.original
                        const checked = Boolean((row as any).permanentStock)
                        const onToggle = async (val: boolean) => {
                            updateProductRow(row.id, { permanentStock: val })
                            await apiPutSalesProduct<
                                boolean,
                                { id: number; permanentStock: boolean }
                            >({ id: Number(row.id), permanentStock: val })
                            fetchData()
                        }
                        return (
                            <div className="min-w-[120px]">
                                <Switcher
                                    checked={checked}
                                    onChange={(v) => onToggle(v)}
                                />
                            </div>
                        )
                    },
                },
            )
        }

        if (!isColumnHidden('published')) {
            cols.push({
                header: t('text.columns.published'),
                accessorKey: 'published',
                cell: (props) => {
                    const row = props.row.original
                    const checked = typeof row.published === 'boolean' ? row.published : false
                    const onToggle = async (val: boolean) => {
                        updateProductRow(row.id, { published: val })
                        await apiPutSalesProduct<boolean, { id: number; published: boolean }>({ id: Number(row.id), published: val })
                        fetchData()
                    }
                    return (
                        <div className="min-w-[120px]">
                            <Switcher checked={checked} onChange={(v) => onToggle(v)} />
                        </div>
                    )
                },
            })
        }

        if (!isColumnHidden('costPrice')) {
            cols.push({
                header: t('text.columns.costPrice'),
                accessorKey: 'costPrice',
                cell: (props) => {
                    const pricingValues = computeEffectivePrices(props.row.original)
                    const currencyCode = pricingValues.currency || props.row.original.currency
                    if (!pricingValues.available) {
                        return (
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('sales.productList.messages.notAvailable', {
                                    defaultValue: 'No disponible',
                                })}
                            </span>
                        )
                    }
                    return <span>{formatCurrencyValue(pricingValues.cost, currencyCode)}</span>
                },
            })
        }

        cols.push(
            {
                header: t('text.columns.salePrice'),
                accessorKey: 'salePrice',
                cell: (props) => {
                    const pricingValues = computeEffectivePrices(props.row.original)
                    const currencyCode = pricingValues.currency || props.row.original.currency
                    if (!pricingValues.available) {
                        return (
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('sales.productList.messages.notAvailable', {
                                    defaultValue: 'No disponible',
                                })}
                            </span>
                        )
                    }
                    return <span>{formatCurrencyValue(pricingValues.sale, currencyCode)}</span>
                },
            },
            {
                header: '',
                id: 'action',
                cell: (props) => <ActionColumn row={props.row.original} />,
            },
        )

        return cols
    }, [
        computeEffectivePrices,
        fetchData,
        formatCurrencyValue,
        isParametric,
        renderMosquiteroControl,
        renderShutterControls,
        hiddenColumns,
        resolveStockStatus,
        t,
        updateProductRow,
    ])

    const onPaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        dispatch(setTableData(newTableData))
    }

    const onSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        dispatch(setTableData(newTableData))
    }

    const onSort = (sort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = sort
        dispatch(setTableData(newTableData))
    }

    return (
        <>
            <DataTable
                ref={tableRef}
                columns={columns}
                data={data}
                selectable={selectionEnabled}
                onCheckBoxChange={selectionEnabled ? handleRowSelect : undefined}
                onIndeterminateCheckBoxChange={
                    selectionEnabled ? handleBulkSelect : undefined
                }
                skeletonAvatarColumns={[0]}
                skeletonAvatarProps={{ className: 'rounded-md' }}
                loading={loading}
                pagingData={{
                    total: tableData.total as number,
                    pageIndex: tableData.pageIndex as number,
                    pageSize: tableData.pageSize as number,
                }}
                onPaginationChange={onPaginationChange}
                onSelectChange={onSelectChange}
                onSort={onSort}
            />
            <ProductDeleteConfirmation />
            <ProductBulkDeleteConfirmation />
        </>
    )
}

export default ProductTable
