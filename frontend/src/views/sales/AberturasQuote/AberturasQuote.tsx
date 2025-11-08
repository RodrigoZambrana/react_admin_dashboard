import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import { toast } from '@/components/ui/toast'
import { apiGetParametricConfig, apiGetParametricMatrix, apiGetSalesProducts } from '@/services/SalesService'
import { apiGetAberturasSelectors } from '@/services/SettingsService'
import type { TableQueries } from '@/@types/common'
import { clientConfig } from '@/configs/clientConfig'
import type { ParametricConfigSnapshot } from '@/views/sales/ProductForm/ParametricConfigurator'
import { mapSelectorsToOptions, mergeSelectorValues } from '@/views/sales/parametric/selectorUtils'
import type { AberturasSelectorSummary, SelectorOption } from '@/views/sales/parametric/selectorUtils'

type ProductSummary = {
    id: string
    name: string
    currency?: string
    salePrice?: number
    productCode?: string
    serieSummary?: string
    colorSummary?: string
    glassSummary?: string
    familySummary?: string
    category?: string
    specifications?: string | null
    description?: string | null
}

type MatrixRow = {
    id: number
    familyId: string
    serie: string
    material: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    price: number
    priceBase: number | null
    priceMosquitero: number | null
    priceMonoblock: number | null
    priceMonoblockMosquitero: number | null
    hasMosquiteroOption: boolean
    hasMonoblockOption: boolean
    shutterMaterial: string
    currency: string
    detailSnapshot: string | null
    specifications?: string | null
    referenceDate: string | null
    source: string | null
}

type SizeOption = {
    value: string
    label: string
    width: number
    height: number
}

type Option = SelectorOption

const findOptionByValue = (options: Option[], value?: string | null) => {
    if (!value) {
        return null
    }
    return options.find((option) => option.value === value) ?? null
}

const resolveOptionLabel = (options: Option[], value?: string | null) =>
    findOptionByValue(options, value)?.label ?? value ?? ''

type FormState = {
    sizeKey: string
    widthMm: number
    heightMm: number
    familyId: string
    color: string
    serie: string
    vidrio: string
    mosquitero: boolean
    monoblock: boolean
}

const buildDefaultFormState = (
    selectors: ParametricConfigSnapshot['selectors'] | null,
    preferredRow?: MatrixRow | null,
): FormState | null => {
    const hasData =
        Boolean(preferredRow) ||
        Boolean(
            (selectors?.families?.length ?? 0) ||
                (selectors?.colors?.length ?? 0) ||
                (selectors?.series?.length ?? 0) ||
                (selectors?.glass?.length ?? 0),
        )

    if (!hasData) {
        return null
    }

    return {
        sizeKey: '',
        widthMm: 0,
        heightMm: 0,
        familyId: '',
        color: '',
        serie: '',
        vidrio: '',
        mosquitero: false,
        monoblock: false,
    }
}

type PriceResolution =
    | {
          available: true
          price: number
          currency: string
          estimated: boolean
          components: string[]
      }
    | {
          available: false
          reason:
              | 'missing_base'
              | 'mosq_not_allowed'
              | 'mb_not_allowed'
              | 'missing_price_mosq'
              | 'missing_price_mb'
              | 'missing_price_mbm'
      }

type MatrixMatch = {
    row: MatrixRow
    resolution: PriceResolution
    similarity: number
}

type Suggestion = {
    row: MatrixRow
    price: number
    currency: string
    estimated: boolean
    components: string[]
    similarity: number
}

type AnalysisState =
    | { status: 'idle' }
    | {
          status: 'exact'
          row: MatrixRow
          resolution: Extract<PriceResolution, { available: true }>
      }
    | {
          status: 'unavailable'
          reason: Extract<PriceResolution, { available: false }>['reason'] | 'no_match'
          suggestions: Suggestion[]
      }

type SalesProductsRequest = TableQueries & {
    filterData?: {
        mode?: 'parametric' | 'all'
    }
}

type SalesProductsResponse = {
    data: ProductSummary[]
    total: number
}

type ProductFilterCriteria = {
    familyId?: string
    color?: string
    serie?: string
    vidrio?: string
}

const normalizeComparableValue = (value?: string | null) =>
    value
        ? value
              .toString()
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
        : ''

const normalizeComparableKey = (value?: string | null) =>
    normalizeComparableValue(value).replace(/[\s_\-]+/g, '')

const tokenizeSummary = (value: string) =>
    value
        .replace(/_/g, ' ')
        .split(/[,/|•·;>-\s]+/)
        .map((token) => token.trim())
        .filter(Boolean)

const matchesAnyField = (fields: Array<string | null | undefined>, target?: string | null) =>
    fields.some((field) => matchesSummaryValue(field, target))

const matchesSummaryValue = (summary?: string | null, target?: string | null) => {
    if (!target) {
        return true
    }
    if (!summary) {
        return false
    }
    const normalizedTarget = normalizeComparableKey(target)
    if (!normalizedTarget) {
        return true
    }
    const normalizedSummary = normalizeComparableKey(summary)
    if (normalizedSummary.includes(normalizedTarget)) {
        return true
    }
    const tokens = tokenizeSummary(summary).map((token) => normalizeComparableKey(token))
    return tokens.includes(normalizedTarget)
}

const productMatchesFilters = (product: ProductSummary, filters: ProductFilterCriteria) => {
    if (
        filters.familyId &&
        !matchesAnyField(
            [product.familySummary, product.category, product.name, product.specifications, product.description],
            filters.familyId,
        )
    ) {
        return false
    }
    if (filters.color && !matchesSummaryValue(product.colorSummary, filters.color)) {
        return false
    }
    if (filters.serie && !matchesSummaryValue(product.serieSummary, filters.serie)) {
        return false
    }
    if (filters.vidrio && !matchesSummaryValue(product.glassSummary, filters.vidrio)) {
        return false
    }
    return true
}

const ensureUniqueProducts = (list: ProductSummary[]): ProductSummary[] => {
    const seen = new Set<string>()
    return list.filter((item) => {
        if (seen.has(item.id)) {
            return false
        }
        seen.add(item.id)
        return true
    })
}

const formatProductPrice = (product: ProductSummary) => {
    const hasPrice = typeof product.salePrice === 'number' && Number.isFinite(product.salePrice)
    if (hasPrice && product.currency) {
        return toCurrency(product.currency, product.salePrice!)
    }
    if (hasPrice) {
        return product.salePrice!.toFixed(2)
    }
    return '—'
}

const toCurrency = (currency: string, amount: number) => {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
        }).format(amount)
    } catch {
        return `${amount.toFixed(2)} ${currency}`
    }
}

const formatReferenceDate = (value: string | null) => {
    if (!value) {
        return null
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return null
    }
    return parsed.toLocaleDateString()
}

const getSizeKey = (width: number, height: number) => `${width}x${height}`

const extractSizeOptions = (rows: MatrixRow[]): SizeOption[] => {
    const map = new Map<string, SizeOption>()
    rows.forEach((row) => {
        const key = getSizeKey(row.widthMm, row.heightMm)
        if (!map.has(key)) {
            map.set(key, {
                value: key,
                label: `${row.widthMm} × ${row.heightMm} mm`,
                width: row.widthMm,
                height: row.heightMm,
            })
        }
    })
    return Array.from(map.values()).sort((a, b) => {
        if (a.width === b.width) {
            return a.height - b.height
        }
        return a.width - b.width
    })
}

const extractOptions = (rows: MatrixRow[], key: keyof MatrixRow): Option[] => {
    const unique = Array.from(new Set(rows.map((row) => row[key] as string))).filter(Boolean)
    unique.sort((a, b) => a.localeCompare(b))
    return unique.map((value) => ({ value, label: value }))
}

const buildNumericOptions = (values: number[]): Option[] => {
    const unique = Array.from(new Set(values)).filter((value) => Number.isFinite(value))
    unique.sort((a, b) => a - b)
    return unique.map((value) => ({ value: String(value), label: `${value}` }))
}

const buildStringOptions = (values: string[]): Option[] => {
    const unique = Array.from(new Set(values.filter(Boolean)))
    unique.sort((a, b) => a.localeCompare(b))
    return unique.map((value) => ({ value, label: value }))
}

const resolvePrice = (
    row: MatrixRow,
    options: { mosquitero: boolean; monoblock: boolean },
): PriceResolution => {
    const base = row.priceBase ?? row.price
    if (!base || base <= 0) {
        return { available: false, reason: 'missing_base' }
    }

    const basePrice = Number(base.toFixed(4))

    if (!options.mosquitero && !options.monoblock) {
        return {
            available: true,
            price: basePrice,
            currency: row.currency,
            estimated: false,
            components: ['base'],
        }
    }

    if (options.mosquitero && !row.hasMosquiteroOption) {
        return { available: false, reason: 'mosq_not_allowed' }
    }

    if (options.monoblock && !row.hasMonoblockOption) {
        return { available: false, reason: 'mb_not_allowed' }
    }

    const mosqPrice = row.priceMosquitero ?? null
    const mbPrice = row.priceMonoblock ?? null
    const mbMosqPrice = row.priceMonoblockMosquitero ?? null

    if (options.mosquitero && options.monoblock) {
        if (mbMosqPrice && mbMosqPrice > 0) {
            return {
                available: true,
                price: Number(mbMosqPrice.toFixed(4)),
                currency: row.currency,
                estimated: false,
                components: ['monoblock_mosq'],
            }
        }
        if (mosqPrice && mosqPrice > 0 && mbPrice && mbPrice > 0) {
            const deltaMosq = mosqPrice - basePrice
            const deltaMb = mbPrice - basePrice
            const price = basePrice + deltaMosq + deltaMb
            return {
                available: true,
                price: Number(price.toFixed(4)),
                currency: row.currency,
                estimated: true,
                components: ['base', 'delta_mosq', 'delta_mb'],
            }
        }
        return { available: false, reason: 'missing_price_mbm' }
    }

    if (options.mosquitero) {
        if (mosqPrice && mosqPrice > 0) {
            return {
                available: true,
                price: Number(mosqPrice.toFixed(4)),
                currency: row.currency,
                estimated: false,
                components: ['mosquitero'],
            }
        }
        return { available: false, reason: 'missing_price_mosq' }
    }

    if (options.monoblock) {
        if (mbPrice && mbPrice > 0) {
            return {
                available: true,
                price: Number(mbPrice.toFixed(4)),
                currency: row.currency,
                estimated: false,
                components: ['monoblock'],
            }
        }
        return { available: false, reason: 'missing_price_mb' }
    }

    return { available: false, reason: 'missing_base' }
}

const buildSuggestions = (
    rows: MatrixRow[],
    target: {
        familyId: string
        widthMm: number
        heightMm: number
        color: string
        serie: string
        vidrio: string
    },
    toggles: { mosquitero: boolean; monoblock: boolean },
): Suggestion[] => {
    const evaluated = rows
        .map((row) => {
            if (target.familyId && row.familyId !== target.familyId) {
                return null
            }
            const resolution = resolvePrice(row, toggles)
            if (!resolution.available) {
                return null
            }
            const sizeDelta =
                Math.abs(row.widthMm - target.widthMm) +
                Math.abs(row.heightMm - target.heightMm)
            const seriePenalty = row.serie === target.serie ? 0 : 50
            const vidrioPenalty = row.vidrio === target.vidrio ? 0 : 20
            const colorPenalty = row.color === target.color ? 0 : 10
            const similarity = sizeDelta + seriePenalty + vidrioPenalty + colorPenalty
            return {
                row,
                price: resolution.price,
                currency: resolution.currency,
                estimated: resolution.estimated,
                components: resolution.components,
                similarity,
            }
        })
        .filter(Boolean) as Suggestion[]

    evaluated.sort((a, b) => a.similarity - b.similarity)

    return evaluated.slice(0, 6)
}

const reasonKeyMap: Record<
    Extract<PriceResolution, { available: false }>['reason'] | 'no_match',
    string
> = {
    missing_base: 'sales.aberturasQuote.reasons.missingBase',
    mosq_not_allowed: 'sales.aberturasQuote.reasons.mosqNotAllowed',
    mb_not_allowed: 'sales.aberturasQuote.reasons.mbNotAllowed',
    missing_price_mosq: 'sales.aberturasQuote.reasons.missingMosqPrice',
    missing_price_mb: 'sales.aberturasQuote.reasons.missingMonoblockPrice',
    missing_price_mbm: 'sales.aberturasQuote.reasons.missingCombinedPrice',
    shutter_material_mismatch: 'sales.aberturasQuote.reasons.shutterMismatch',
    no_match: 'sales.aberturasQuote.reasons.noMatch',
}

const componentLabels: Record<string, string> = {
    base: 'sales.aberturasQuote.components.base',
    mosquitero: 'sales.aberturasQuote.components.mosquitero',
    monoblock: 'sales.aberturasQuote.components.monoblock',
    monoblock_mosq: 'sales.aberturasQuote.components.monoblockMosq',
    delta_mosq: 'sales.aberturasQuote.components.deltaMosq',
    delta_mb: 'sales.aberturasQuote.components.deltaMb',
}

const AberturasQuote = () => {
    const { t } = useTranslation()
    const isUrucortinas = clientConfig.slug === 'urucortinas'

    const defaultTableQuery: TableQueries = {
        total: 0,
        pageIndex: 1,
        pageSize: 100,
        query: '',
        sort: {
            order: '',
            key: '',
        },
    }

    const [products, setProducts] = useState<ProductSummary[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [matrix, setMatrix] = useState<MatrixRow[]>([])
    const [configSnapshot, setConfigSnapshot] = useState<ParametricConfigSnapshot | null>(null)
    const [selectorSummary, setSelectorSummary] = useState<AberturasSelectorSummary | null>(null)

    const summarySelectors = useMemo(() => {
        if (!selectorSummary) {
            return null
        }
        return {
            families: selectorSummary.families,
            series: selectorSummary.series,
            materials: ['ALUMINIO'],
            colors: selectorSummary.colors,
            glass: selectorSummary.glass,
            widths: [] as number[],
            heights: [] as number[],
            shutterMaterials: ['PVC', 'ALUMINIO'],
            hasMosquiteroOption: true,
            hasMonoblockOption: true,
        }
    }, [selectorSummary])

    const selectors = configSnapshot?.selectors ?? null

    const mergedSelectors = useMemo(() => {
        if (!selectors && !summarySelectors) {
            return null
        }
        if (!selectors) {
            return summarySelectors
        }
        if (!summarySelectors) {
            return selectors
        }
        return {
            ...selectors,
            families: mergeSelectorValues(selectors.families, summarySelectors.families),
            series: mergeSelectorValues(selectors.series, summarySelectors.series),
            materials: mergeSelectorValues(selectors.materials ?? [], summarySelectors.materials ?? []),
            colors: mergeSelectorValues(selectors.colors, summarySelectors.colors),
            glass: mergeSelectorValues(selectors.glass, summarySelectors.glass),
            widths: selectors.widths?.length ? selectors.widths : summarySelectors.widths,
            heights: selectors.heights?.length ? selectors.heights : summarySelectors.heights,
            shutterMaterials: mergeSelectorValues(selectors.shutterMaterials ?? [], summarySelectors.shutterMaterials ?? []),
            hasMosquiteroOption: selectors.hasMosquiteroOption || summarySelectors.hasMosquiteroOption,
            hasMonoblockOption: selectors.hasMonoblockOption || summarySelectors.hasMonoblockOption,
        }
    }, [summarySelectors, selectors])

    const selectorOptionGroups = useMemo(
        () => mapSelectorsToOptions(mergedSelectors, t),
        [mergedSelectors, t],
    )

    const emptyOptionLabel = useMemo(
        () =>
            t('sales.aberturasQuote.options.any', {
                defaultValue: 'Sin filtro (cualquiera)',
            }),
        [t],
    )

    const withEmptyOption = useCallback(
        (options: Option[]): Option[] => {
            if (!options.length) {
                return options
            }
            if (options.some((option) => option.value === '')) {
                return options
            }
            return [{ value: '', label: emptyOptionLabel }, ...options]
        },
        [emptyOptionLabel],
    )

    const productOptions = useMemo(
        () =>
            withEmptyOption(
                products.map((product) => ({
                    value: String(product.id),
                    label: product.name,
                })),
            ),
        [products, withEmptyOption],
    )
    const selectedProductOption = useMemo(
        () => findOptionByValue(productOptions, selectedProductId),
        [productOptions, selectedProductId],
    )
    const {
        families: selectorFamilies,
        series: selectorSeries,
        colors: selectorColors,
        glass: selectorGlass,
    } = selectorOptionGroups
    const [loadingMatrix, setLoadingMatrix] = useState(false)
    const [matrixError, setMatrixError] = useState<string | null>(null)
    const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
    const [formState, setFormState] = useState<FormState | null>(null)
    const [productResults, setProductResults] = useState<ProductSummary[]>([])
    const [productSearchPerformed, setProductSearchPerformed] = useState(false)
    const [manualSizeMode, setManualSizeMode] = useState(true)
    const resetProductResults = useCallback(() => {
        setProductResults([])
        setProductSearchPerformed(false)
    }, [])
    const selectedProduct = useMemo(
        () => products.find((product) => product.id === selectedProductId) ?? null,
        [products, selectedProductId],
    )

    useEffect(() => {
        if (isUrucortinas) {
            return
        }
        toast.push(
            <Notification
                title={t('sales.aberturasQuote.notifications.productsError', {
                    defaultValue: 'No se pudieron cargar los productos paramétricos.',
                })}
                type="warning"
            />,
            { placement: 'top-center' },
        )
    }, [isUrucortinas, t])

    const normalizeProduct = useCallback((item: any): ProductSummary => {
        const rawCurrency =
            (item as ProductSummary).currency ??
            ((item as any)?.parametricPricing?.currency as string | undefined) ??
            ((item as any)?.currency as string | undefined)
        const familyValue =
            ((item as any)?.familySummary as string | undefined) ??
            ((item as any)?.familyName as string | undefined) ??
            ((item as any)?.parametricFamily as string | undefined) ??
            ((item as any)?.categoryName as string | undefined) ??
            ((item as any)?.category as string | undefined)
        return {
            id: String((item as any).id ?? ''),
            name: (item as any).name ?? (item as any).productCode ?? (item as any).parametricSku ?? '-',
            currency: rawCurrency || undefined,
            salePrice: (() => {
                const rawPrice = Number(
                    (item as any).salePrice ??
                        (item as any).price ??
                        (item as any)?.parametricPricing?.basePrice ??
                        Number.NaN,
                )
                return Number.isFinite(rawPrice) ? rawPrice : undefined
            })(),
            productCode: ((item as any).productCode ?? (item as any).parametricSku ?? '') as string,
            serieSummary: ((item as any).serieSummary ?? (item as any).seriesSummary ?? '') as string,
            colorSummary: ((item as any).colorSummary ?? '') as string,
            glassSummary: ((item as any).glassSummary ?? '') as string,
            familySummary: familyValue ?? '',
            category: ((item as any).category ?? (item as any).categoryName ?? '') as string,
            specifications: typeof (item as any).specifications === 'string' ? (item as any).specifications : null,
            description: typeof (item as any).description === 'string' ? (item as any).description : null,
        }
    }, [])

    const fetchProducts = useCallback(async () => {
        if (!isUrucortinas) {
            return
        }
        setLoadingProducts(true)
        try {
            const aggregated: ProductSummary[] = []
            const pageSize = Math.max(250, defaultTableQuery.pageSize)
            let pageIndex = 1
            let total = Number.POSITIVE_INFINITY
            while (aggregated.length < total) {
                const payload: SalesProductsRequest = {
                    ...defaultTableQuery,
                    pageIndex,
                    pageSize,
                    filterData: {
                        mode: 'parametric',
                    },
                }
                const response = await apiGetSalesProducts<SalesProductsResponse, SalesProductsRequest>(payload)
                const list = response.data?.data ?? []
                const normalized = list.map((item) => normalizeProduct(item))
                aggregated.push(...normalized)
                total = Number(response.data?.total ?? aggregated.length)
                if (list.length < pageSize) {
                    break
                }
                pageIndex += 1
            }
            setProducts(aggregated)
            if (selectedProductId && !aggregated.some((item) => String(item.id) === selectedProductId)) {
                setSelectedProductId('')
            }
        } catch (error) {
            console.error('[aberturas] failed to load products', error)
            toast.push(
                <Notification
                    title={t('sales.aberturasQuote.notifications.productsError', {
                        defaultValue: 'No se pudieron cargar los productos paramétricos.',
                    })}
                    type="danger"
                />,
            )
        } finally {
            setLoadingProducts(false)
        }
    }, [isUrucortinas, normalizeProduct, selectedProductId, t])

    useEffect(() => {
        if (!isUrucortinas || selectorSummary) {
            return
        }
        let mounted = true
        const loadSelectors = async () => {
            try {
                const response = await apiGetAberturasSelectors<AberturasSelectorSummary>()
                if (!mounted) {
                    return
                }
                const payload = (response?.data ?? response ?? null) as AberturasSelectorSummary | null
                setSelectorSummary(payload)
            } catch (error) {
                console.error('[aberturas] selectors fetch failed', error)
            }
        }
        loadSelectors()
        return () => {
            mounted = false
        }
    }, [isUrucortinas, selectorSummary])

    const fetchMatrix = useCallback(
        async (productId: string) => {
            if (!isUrucortinas) {
                return
            }
            if (!productId) {
                setMatrix([])
                const defaults = buildDefaultFormState(summarySelectors, null)
                setFormState(defaults)
                setManualSizeMode(true)
                return
            }
            setLoadingMatrix(true)
            setMatrixError(null)
            setAnalysis({ status: 'idle' })
            try {
                const numericId = Number(productId)
                if (!Number.isFinite(numericId)) {
                    throw new Error('invalid_product')
                }
                const response = await apiGetParametricMatrix<MatrixRow[]>(numericId)
                const rows = Array.isArray(response.data ?? response)
                    ? ((response.data ?? response) as MatrixRow[])
                    : []
                setMatrix(rows)
                if (!rows.length) {
                    setMatrixError(
                        t('sales.aberturasQuote.notifications.emptyMatrix', {
                            defaultValue: 'Este producto aún no tiene matriz cargada.',
                        }),
                    )
                }
                let snapshot: ParametricConfigSnapshot | null = null
                try {
                    const configResponse = await apiGetParametricConfig<ParametricConfigSnapshot>(
                        numericId,
                    )
                    snapshot = ((configResponse as any)?.data ?? configResponse) as
                        | ParametricConfigSnapshot
                        | null
                    setConfigSnapshot(snapshot ?? null)
                } catch (configError) {
                    console.error('[aberturas] failed to load parametric config', configError)
                    setConfigSnapshot(null)
                }
                const preferredRow = rows[0] ?? null
                const defaults = buildDefaultFormState(snapshot?.selectors ?? summarySelectors, preferredRow)
                setFormState(defaults)
                setManualSizeMode(true)
            } catch (error) {
                console.error('[aberturas] failed to load matrix', error)
                setMatrix([])
                setConfigSnapshot(null)
                setFormState(buildDefaultFormState(summarySelectors, null))
                setManualSizeMode(true)
                setMatrixError(
                    t('sales.aberturasQuote.notifications.matrixError', {
                        defaultValue: 'No se pudo cargar la matriz de precios.',
                    }),
                )
            } finally {
                setLoadingMatrix(false)
            }
        },
        [isUrucortinas, summarySelectors, t],
    )

    useEffect(() => {
        if (!isUrucortinas) {
            return
        }
        fetchProducts()
    }, [fetchProducts, isUrucortinas])

    useEffect(() => {
        if (!isUrucortinas) {
            return
        }
        if (selectedProductId) {
            fetchMatrix(selectedProductId)
        } else if (summarySelectors) {
            const defaults = buildDefaultFormState(summarySelectors, null)
            setFormState(defaults)
            setManualSizeMode(true)
        }
    }, [fetchMatrix, isUrucortinas, selectedProductId, summarySelectors])

    useEffect(() => {
        if (!formState && summarySelectors) {
            const defaults = buildDefaultFormState(summarySelectors, null)
            setFormState(defaults)
            setManualSizeMode(true)
        }
    }, [formState, summarySelectors])

    const rowsForFamily = useMemo(() => {
        if (!formState?.familyId) {
            return matrix
        }
        return matrix.filter((row) => row.familyId === formState.familyId)
    }, [formState?.familyId, matrix])

    const sizeOptions = useMemo(() => extractSizeOptions(rowsForFamily), [rowsForFamily])

    const sizeSelectOptions = useMemo(() => {
        if (!sizeOptions.length) {
            return []
        }
        return [
            {
                value: '',
                label: t('sales.aberturasQuote.options.sizeAny', {
                    defaultValue: 'Sin filtro de medida',
                }),
                width: 0,
                height: 0,
            },
            ...sizeOptions,
        ]
    }, [sizeOptions, t])

    const familyOptions = useMemo(() => {
        const base = selectorFamilies.length ? selectorFamilies : buildStringOptions(matrix.map((row) => row.familyId))
        return withEmptyOption(base)
    }, [matrix, selectorFamilies, withEmptyOption])

    const colorOptions = useMemo(() => {
        const base = selectorColors.length ? selectorColors : buildStringOptions(matrix.map((row) => row.color))
        return withEmptyOption(base)
    }, [matrix, selectorColors, withEmptyOption])

    const serieOptions = useMemo(() => {
        const base = selectorSeries.length ? selectorSeries : buildStringOptions(matrix.map((row) => row.serie))
        return withEmptyOption(base)
    }, [matrix, selectorSeries, withEmptyOption])

    const vidrioOptions = useMemo(() => {
        const base = selectorGlass.length ? selectorGlass : buildStringOptions(matrix.map((row) => row.vidrio))
        return withEmptyOption(base)
    }, [matrix, selectorGlass, withEmptyOption])

    useEffect(() => {
        if (!formState) {
            return
        }
        const ensureValue = (current: string, options: Option[]) => {
            if (!options.length) {
                return current
            }
            if (current && options.some((option) => option.value === current)) {
                return current
            }
            return ''
        }

        const nextFamily = ensureValue(formState.familyId, familyOptions)
        const nextColor = ensureValue(formState.color, colorOptions)
        const nextSerie = ensureValue(formState.serie, serieOptions)
        const nextVidrio = ensureValue(formState.vidrio, vidrioOptions)

        let payload: Partial<FormState> | null = null

        if (nextFamily !== formState.familyId) {
            const fallbackRow = matrix.find((row) => row.familyId === nextFamily)
            payload = {
                ...(payload ?? {}),
                familyId: nextFamily,
            }
            if (fallbackRow && !manualSizeMode) {
                payload.sizeKey = getSizeKey(fallbackRow.widthMm, fallbackRow.heightMm)
                payload.widthMm = fallbackRow.widthMm
                payload.heightMm = fallbackRow.heightMm
            }
        }

        if (nextColor !== formState.color) {
            payload = { ...(payload ?? {}), color: nextColor }
        }
        if (nextSerie !== formState.serie) {
            payload = { ...(payload ?? {}), serie: nextSerie }
        }
        if (nextVidrio !== formState.vidrio) {
            payload = { ...(payload ?? {}), vidrio: nextVidrio }
        }

        if (payload) {
            payload.mosquitero = false
            payload.monoblock = false
            setFormState((prev) => (prev ? { ...prev, ...payload } : prev))
        }
    }, [colorOptions, familyOptions, formState, manualSizeMode, matrix, serieOptions, vidrioOptions])

    useEffect(() => {
        if (!formState || manualSizeMode) {
            return
        }
        if (!sizeOptions.some((option) => option.value === formState.sizeKey) && sizeOptions.length) {
            const next = sizeOptions[0]
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          sizeKey: next.value,
                          widthMm: next.width,
                          heightMm: next.height,
                      }
                    : prev,
            )
        }
    }, [formState, manualSizeMode, sizeOptions])

    const activeRow = useMemo(() => {
        if (!formState) {
            return null
        }
        return matrix.find(
            (row) =>
                (!formState.familyId || row.familyId === formState.familyId) &&
                row.widthMm === formState.widthMm &&
                row.heightMm === formState.heightMm &&
                row.color === formState.color &&
                row.serie === formState.serie &&
                row.vidrio === formState.vidrio,
        )
    }, [formState, matrix])

    const mosquiteroAvailable = useMemo(() => {
        if (activeRow) {
            return activeRow.hasMosquiteroOption
        }
        return mergedSelectors?.hasMosquiteroOption ?? false
    }, [activeRow, mergedSelectors])

    const monoblockAvailable = useMemo(() => {
        if (activeRow) {
            return activeRow.hasMonoblockOption
        }
        return mergedSelectors?.hasMonoblockOption ?? false
    }, [activeRow, mergedSelectors])

    useEffect(() => {
        if (!formState || !activeRow) {
            return
        }
        const updated: Partial<FormState> = {}
        if (formState.mosquitero && !activeRow.hasMosquiteroOption) {
            updated.mosquitero = false
        }
        if (formState.monoblock && !activeRow.hasMonoblockOption) {
            updated.monoblock = false
        }
        if (Object.keys(updated).length) {
            setFormState((prev) => (prev ? { ...prev, ...updated } : prev))
        }
    }, [activeRow, formState])

    const handleSizeChange = useCallback(
        (value: string) => {
            if (!value) {
                setManualSizeMode(true)
                setFormState((prev) =>
                    prev
                        ? {
                              ...prev,
                              sizeKey: '',
                              widthMm: 0,
                              heightMm: 0,
                          }
                        : prev,
                )
                setAnalysis({ status: 'idle' })
                resetProductResults()
                return
            }
            const option = sizeOptions.find((item) => item.value === value)
            if (!option) {
                return
            }
            setManualSizeMode(false)
            const fallbackRow = matrix.find(
                (row) =>
                    row.widthMm === option.width &&
                    row.heightMm === option.height &&
                    (!formState?.familyId || row.familyId === formState.familyId),
            )
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          sizeKey: option.value,
                          widthMm: option.width,
                          heightMm: option.height,
                      }
                    : fallbackRow
                      ? {
                            sizeKey: option.value,
                            widthMm: fallbackRow.widthMm,
                            heightMm: fallbackRow.heightMm,
                            familyId: fallbackRow.familyId,
                            color: fallbackRow.color,
                            serie: fallbackRow.serie,
                            vidrio: fallbackRow.vidrio,
                            mosquitero: false,
                            monoblock: false,
                        }
                      : prev,
            )
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [formState?.familyId, matrix, resetProductResults, sizeOptions],
    )

    const handleColorChange = useCallback(
        (value: string) => {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          color: value,
                          mosquitero: false,
                          monoblock: false,
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [resetProductResults],
    )

    const handleSerieChange = useCallback(
        (value: string) => {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          serie: value,
                          mosquitero: false,
                          monoblock: false,
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [resetProductResults],
    )

    const handleVidrioChange = useCallback(
        (value: string) => {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          vidrio: value,
                          mosquitero: false,
                          monoblock: false,
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [resetProductResults],
    )

    const handleToggleChange = useCallback(
        (field: 'mosquitero' | 'monoblock') => {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          [field]: !prev[field],
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [resetProductResults],
    )

    const handleFamilyChange = useCallback((value: string) => {
        setFormState((prev) =>
            prev
                ? {
                      ...prev,
                      familyId: value,
                      sizeKey: '',
                      widthMm: 0,
                      heightMm: 0,
                      mosquitero: false,
                      monoblock: false,
                  }
                : prev,
        )
        setManualSizeMode(true)
        setAnalysis({ status: 'idle' })
        resetProductResults()
    }, [resetProductResults])

    const handleDimensionInput = useCallback(
        (field: 'widthMm' | 'heightMm', value: string) => {
            const parsed = Number(value)
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          sizeKey: 'custom',
                          [field]: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                      }
                    : prev,
            )
            setManualSizeMode(true)
            setAnalysis({ status: 'idle' })
            resetProductResults()
        },
        [resetProductResults],
    )

    const canCalculate = useMemo(() => {
        if (!formState) {
            return false
        }
        if (
            !formState.familyId ||
            !formState.color ||
            !formState.serie ||
            !formState.vidrio
        ) {
            return false
        }
        if (manualSizeMode) {
            return formState.widthMm > 0 && formState.heightMm > 0
        }
        return Boolean(formState.sizeKey)
    }, [formState, manualSizeMode])

    const canSearchProducts = useMemo(() => {
        if (!formState) {
            return Boolean(selectedProductId)
        }
        const hasFieldInput = Boolean(
            formState.familyId ||
                formState.color ||
                formState.serie ||
                formState.vidrio ||
                (manualSizeMode
                    ? formState.widthMm > 0 || formState.heightMm > 0
                    : formState.sizeKey) ||
                formState.mosquitero ||
                formState.monoblock,
        )
        return Boolean(selectedProductId || hasFieldInput)
    }, [formState, manualSizeMode, selectedProductId])

    const productFilterSummary = useMemo(() => {
        if (!formState) {
            return []
        }
        const summary: string[] = []
        const push = (label: string, value?: string | null) => {
            if (value) {
                summary.push(`${label}: ${value}`)
            }
        }
        push(
            t('sales.aberturasQuote.labels.family', { defaultValue: 'Tipo de abertura' }),
            resolveOptionLabel(familyOptions, formState.familyId),
        )
        push(
            t('sales.aberturasQuote.labels.color', { defaultValue: 'Color' }),
            resolveOptionLabel(colorOptions, formState.color),
        )
        push(
            t('sales.aberturasQuote.labels.serie', { defaultValue: 'Serie' }),
            resolveOptionLabel(serieOptions, formState.serie),
        )
        push(
            t('sales.aberturasQuote.labels.vidrio', { defaultValue: 'Vidrio' }),
            resolveOptionLabel(vidrioOptions, formState.vidrio),
        )
        return summary
    }, [colorOptions, familyOptions, formState, serieOptions, t, vidrioOptions])

    const handleCalculate = useCallback(() => {
        if (!formState) {
            return
        }
        if (!activeRow) {
            const suggestions = buildSuggestions(
                matrix,
                {
                    familyId: formState.familyId,
                    widthMm: formState.widthMm,
                    heightMm: formState.heightMm,
                    color: formState.color,
                    serie: formState.serie,
                    vidrio: formState.vidrio,
                },
                {
                    mosquitero: formState.mosquitero,
                    monoblock: formState.monoblock,
                },
            )
            setAnalysis({
                status: 'unavailable',
                reason: 'no_match',
                suggestions,
            })
            return
        }
        const resolution = resolvePrice(activeRow, {
            mosquitero: formState.mosquitero,
            monoblock: formState.monoblock,
        })
        if (resolution.available) {
            setAnalysis({
                status: 'exact',
                row: activeRow,
                resolution,
            })
            return
        }
        const suggestions = buildSuggestions(
            matrix,
            {
                familyId: formState.familyId,
                widthMm: formState.widthMm,
                heightMm: formState.heightMm,
                color: formState.color,
                serie: formState.serie,
                vidrio: formState.vidrio,
            },
            {
                mosquitero: formState.mosquitero,
                monoblock: formState.monoblock,
            },
        )
        setAnalysis({
            status: 'unavailable',
            reason: resolution.reason,
            suggestions,
        })
    }, [activeRow, formState, matrix])

    const handleSearch = useCallback(() => {
        if (!formState && !selectedProductId) {
            return
        }
        const criteria: ProductFilterCriteria = {
            familyId: formState?.familyId?.trim() || undefined,
            color: formState?.color?.trim() || undefined,
            serie: formState?.serie?.trim() || undefined,
            vidrio: formState?.vidrio?.trim() || undefined,
        }
        const matches = products.filter((product) => productMatchesFilters(product, criteria))
        let nextResults = matches
        if (selectedProduct) {
            const alreadyIncluded = nextResults.some((item) => item.id === selectedProduct.id)
            nextResults = alreadyIncluded ? nextResults : [selectedProduct, ...nextResults]
        }
        const uniqueResults = ensureUniqueProducts(nextResults)
        setProductResults(uniqueResults)
        setProductSearchPerformed(true)
    }, [formState, products, selectedProduct, selectedProductId])

    const renderComponents = useCallback(
        (components: string[]) =>
            components
                .map((component) =>
                    t(componentLabels[component] ?? component, {
                        defaultValue: component,
                    }),
                )
                .join(' • '),
        [t],
    )

    const renderMatchCard = useCallback(
        (match: MatrixMatch) => (
            <div
                key={`${match.row.id}-${match.similarity}`}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-3 flex flex-col gap-2"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold">
                        {match.resolution.available
                            ? toCurrency(match.row.currency, match.resolution.price)
                            : t('sales.aberturasQuote.result.unavailable', {
                                  defaultValue: 'Sin precio',
                              })}
                    </span>
                    <div className="flex items-center gap-2">
                        {match.resolution.available && match.resolution.estimated && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                {t('sales.aberturasQuote.result.estimatedBadge', {
                                    defaultValue: 'Estimado',
                                })}
                            </Badge>
                        )}
                    {match.similarity > 0 && (
                        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-200">
                            {t('sales.aberturasQuote.filters.similarity', {
                                defaultValue: 'Δ {{value}} mm',
                                value: match.similarity,
                            })}
                        </Badge>
                    )}
                    </div>
                </div>
                <div className="text-xs text-gray-500">
                    {t('sales.aberturasQuote.summary.dimensions', {
                        defaultValue: 'Medida:',
                    })}{' '}
                    {match.row.widthMm} × {match.row.heightMm} mm
                </div>
                <div className="text-xs text-gray-500">
                    {t('sales.aberturasQuote.summary.serie', {
                        defaultValue: 'Serie:',
                    })}{' '}
                    {match.row.serie} ·{' '}
                    {t('sales.aberturasQuote.summary.vidrio', {
                        defaultValue: 'Vidrio:',
                    })}{' '}
                    {match.row.vidrio}
                </div>
                <div className="text-xs text-gray-500">
                    {match.resolution.available
                        ? t('sales.aberturasQuote.result.components', {
                              defaultValue: 'Componentes considerados: {{components}}',
                              components: renderComponents(match.resolution.components),
                          })
                        : t(reasonKeyMap[match.resolution.reason] ?? '', {
                              defaultValue: t('sales.aberturasQuote.reasons.genericFallback', {
                                  defaultValue: 'No hay precio disponible.',
                              }),
                          })}
                </div>
                {match.row.referenceDate && (
                    <div className="text-[11px] text-gray-400">
                        {t('sales.aberturasQuote.summary.reference', {
                            defaultValue: 'Fecha de referencia: {{date}}',
                            date: formatReferenceDate(match.row.referenceDate) ?? '-',
                        })}
                    </div>
                )}
                {match.row.source && (
                    <div className="text-[11px] text-gray-400">
                        {t('sales.aberturasQuote.summary.source', {
                            defaultValue: 'Fuente: {{source}}',
                            source: match.row.source,
                        })}
                    </div>
                )}
            </div>
        ),
        [renderComponents, t],
    )

    if (!isUrucortinas) {
        return (
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    {t('sales.aberturasQuote.title', { defaultValue: 'Presupuestar Aberturas' })}
                </h2>
                <Alert type="warning" showIcon>
                    {t('sales.aberturasQuote.reasons.genericFallback', {
                        defaultValue: 'Esta funcionalidad solo está disponible para Urucortinas.',
                    })}
                </Alert>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">
                    {t('sales.aberturasQuote.title', {
                        defaultValue: 'Presupuestar Aberturas',
                    })}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {t('sales.aberturasQuote.subtitle', {
                        defaultValue:
                            'Explorá la matriz paramétrica para calcular precios y sugerencias cercanas.',
                    })}
                </p>
            </div>

            <AdaptableCard>
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <span className="text-xs uppercase text-gray-500">
                                {t('sales.aberturasQuote.labels.product', {
                                    defaultValue: 'Producto paramétrico',
                                })}
                            </span>
                            {loadingProducts ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Spinner size={18} />{' '}
                                    {t('sales.aberturasQuote.loading.products', {
                                        defaultValue: 'Cargando productos…',
                                    })}
                                </div>
                            ) : (
                                <Select
                                    options={productOptions}
                                    value={selectedProductOption}
                                    placeholder={t('sales.aberturasQuote.labels.productPlaceholder', {
                                        defaultValue: 'Elegí un producto',
                                    })}
                                    isDisabled={!productOptions.length}
                                    onChange={(option) => {
                                        setSelectedProductId((option as Option | null)?.value ?? '')
                                        resetProductResults()
                                    }}
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs uppercase text-gray-500">
                                {t('sales.aberturasQuote.labels.family', {
                                    defaultValue: 'Tipo de abertura',
                                })}
                            </span>
                            <Select
                                options={familyOptions}
                                value={findOptionByValue(familyOptions, formState?.familyId)}
                                placeholder={t('sales.aberturasQuote.labels.familyPlaceholder', {
                                    defaultValue: 'Seleccioná un tipo',
                                })}
                                isDisabled={!familyOptions.length || !formState}
                                onChange={(option) =>
                                    handleFamilyChange((option as Option)?.value ?? '')
                                }
                            />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs uppercase text-gray-500">
                                    {t('sales.aberturasQuote.labels.size', {
                                        defaultValue: 'Medidas predefinidas',
                                    })}
                                </span>
                                <Select
                                    options={sizeSelectOptions}
                                    value={!manualSizeMode && formState?.sizeKey ? formState.sizeKey : null}
                                    placeholder={t('sales.aberturasQuote.labels.sizePlaceholder', {
                                        defaultValue: 'Seleccioná una medida',
                                    })}
                                    isDisabled={!sizeSelectOptions.length || loadingMatrix || !formState}
                                    onChange={(value) => handleSizeChange((value as string) ?? '')}
                                />
                                <p className="text-xs text-gray-500">
                                    {t('sales.aberturasQuote.helpers.sizeHint', {
                                        defaultValue: 'Elegí una medida para completar los campos automáticamente.',
                                    })}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs uppercase text-gray-500">
                                    {t('sales.aberturasQuote.labels.manualSizeToggle', {
                                        defaultValue: 'Ingresar manualmente',
                                    })}
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        value={formState && formState.widthMm > 0 ? String(formState.widthMm) : ''}
                                        placeholder={t('sales.aberturasQuote.labels.manualWidth', {
                                            defaultValue: 'Ancho (mm)',
                                        })}
                                        onChange={(e) => handleDimensionInput('widthMm', e.target.value)}
                                    />
                                    <Input
                                        type="number"
                                        value={formState && formState.heightMm > 0 ? String(formState.heightMm) : ''}
                                        placeholder={t('sales.aberturasQuote.labels.manualHeight', {
                                            defaultValue: 'Alto (mm)',
                                        })}
                                        onChange={(e) => handleDimensionInput('heightMm', e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-gray-500">
                                    {t('sales.aberturasQuote.helpers.manualSizeHint', {
                                        defaultValue: 'Podés ajustar las medidas en cualquier momento sin perder la selección.',
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {matrixError && (
                        <Alert type="warning" showIcon>
                            {matrixError}
                        </Alert>
                    )}

                    {loadingMatrix && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Spinner size={18} />{' '}
                            {t('sales.aberturasQuote.loading.matrix', {
                                defaultValue: 'Cargando matriz de precios…',
                            })}
                        </div>
                    )}

                    {formState && !loadingMatrix && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs uppercase text-gray-500">
                                        {t('sales.aberturasQuote.labels.color', {
                                            defaultValue: 'Color',
                                        })}
                                    </span>
                                    <Select
                                        options={colorOptions}
                                        value={findOptionByValue(colorOptions, formState.color)}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.colorPlaceholder',
                                            {
                                                defaultValue: 'Seleccioná un color',
                                            },
                                        )}
                                        isDisabled={!colorOptions.length}
                                        onChange={(option) =>
                                            handleColorChange((option as Option)?.value ?? '')
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs uppercase text-gray-500">
                                        {t('sales.aberturasQuote.labels.serie', {
                                            defaultValue: 'Serie',
                                        })}
                                    </span>
                                    <Select
                                        options={serieOptions}
                                        value={findOptionByValue(serieOptions, formState.serie)}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.seriePlaceholder',
                                            {
                                                defaultValue: 'Seleccioná una serie',
                                            },
                                        )}
                                        isDisabled={!serieOptions.length}
                                        onChange={(option) =>
                                            handleSerieChange((option as Option)?.value ?? '')
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs uppercase text-gray-500">
                                        {t('sales.aberturasQuote.labels.vidrio', {
                                            defaultValue: 'Vidrio',
                                        })}
                                    </span>
                                    <Select
                                        options={vidrioOptions}
                                        value={findOptionByValue(vidrioOptions, formState.vidrio)}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.vidrioPlaceholder',
                                            {
                                                defaultValue: 'Seleccioná un vidrio',
                                            },
                                        )}
                                        isDisabled={!vidrioOptions.length}
                                        onChange={(option) =>
                                            handleVidrioChange((option as Option)?.value ?? '')
                                        }
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 border border-gray-200 dark:border-gray-700 rounded-md p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium">
                                            {t('sales.aberturasQuote.labels.mosquitero', {
                                                defaultValue: 'Mosquitero',
                                            })}
                                        </span>
                                        {!mosquiteroAvailable && (
                                            <p className="text-xs text-gray-500">
                                                {t('sales.aberturasQuote.helpers.mosqUnavailable', {
                                                    defaultValue:
                                                        'No disponible para esta combinación.',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                    <Switcher
                                        checked={formState.mosquitero}
                                        onChange={() => handleToggleChange('mosquitero')}
                                        disabled={!mosquiteroAvailable}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium">
                                            {t('sales.aberturasQuote.labels.monoblock', {
                                                defaultValue: 'Persiana / Monoblock',
                                            })}
                                        </span>
                                        {!monoblockAvailable && (
                                            <p className="text-xs text-gray-500">
                                                {t('sales.aberturasQuote.helpers.mbUnavailable', {
                                                    defaultValue:
                                                        'No disponible para esta combinación.',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                    <Switcher
                                        checked={formState.monoblock}
                                        onChange={() => handleToggleChange('monoblock')}
                                        disabled={!monoblockAvailable}
                                    />
                                </div>
                                {formState.monoblock && activeRow?.shutterMaterial && (
                                    <p className="text-xs text-gray-500">
                                        {t('sales.aberturasQuote.helpers.shutterMaterial', {
                                            defaultValue: 'Material recomendado: {{material}}',
                                            material: activeRow.shutterMaterial,
                                        })}
                                    </p>
                                )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                        variant="twoTone"
                                        disabled={!canSearchProducts}
                                        onClick={handleSearch}
                                    >
                                        {t('sales.aberturasQuote.filters.searchButton', {
                                            defaultValue: 'Buscar combinaciones',
                                        })}
                                    </Button>
                                    <Button onClick={handleCalculate} disabled={!canCalculate}>
                                        {t('sales.aberturasQuote.actions.calculate', {
                                            defaultValue: 'Calcular precio',
                                        })}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </AdaptableCard>

            {productSearchPerformed && (
                <AdaptableCard>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {t('sales.aberturasQuote.productResults.title', {
                                        defaultValue: 'Productos filtrados',
                                    })}
                                </h3>
                                {productFilterSummary.length ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {productFilterSummary.join(' • ')}
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        {t('sales.aberturasQuote.productResults.noFilters', {
                                            defaultValue: 'Se muestra el producto seleccionado.',
                                        })}
                                    </p>
                                )}
                            </div>
                            <Badge className="self-start bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200">
                                {t('sales.aberturasQuote.productResults.count', {
                                    defaultValue: '{{count}} resultado(s)',
                                    count: productResults.length,
                                })}
                            </Badge>
                        </div>
                        {productResults.length ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                            <th className="py-2 pr-3">
                                                {t('sales.aberturasQuote.productResults.columns.product', {
                                                    defaultValue: 'Producto paramétrico',
                                                })}
                                            </th>
                                            <th className="py-2 px-3">
                                                {t('sales.aberturasQuote.productResults.columns.family', {
                                                    defaultValue: 'Tipo / Familia',
                                                })}
                                            </th>
                                            <th className="py-2 px-3">
                                                {t('sales.aberturasQuote.productResults.columns.serie', {
                                                    defaultValue: 'Serie',
                                                })}
                                            </th>
                                            <th className="py-2 px-3">
                                                {t('sales.aberturasQuote.productResults.columns.color', {
                                                    defaultValue: 'Color',
                                                })}
                                            </th>
                                            <th className="py-2 px-3">
                                                {t('sales.aberturasQuote.productResults.columns.glass', {
                                                    defaultValue: 'Vidrio',
                                                })}
                                            </th>
                                            <th className="py-2 px-3">
                                                {t('sales.aberturasQuote.productResults.columns.price', {
                                                    defaultValue: 'Precio',
                                                })}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productResults.map((product) => (
                                            <tr
                                                key={product.id}
                                                className={`border-b last:border-b-0 border-gray-200 dark:border-gray-700 ${
                                                    selectedProductId === product.id
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                        : ''
                                                }`}
                                            >
                                                <td className="py-2 pr-3 align-top">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {product.name || '—'}
                                                        </span>
                                                        {(product.productCode || product.currency) && (
                                                            <span className="text-xs text-gray-500">
                                                                {[product.productCode ? `SKU: ${product.productCode}` : null, product.currency]
                                                                    .filter(Boolean)
                                                                    .join(' • ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-200">
                                                    {product.familySummary || product.category || '—'}
                                                </td>
                                                <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-200">
                                                    {product.serieSummary || '—'}
                                                </td>
                                                <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-200">
                                                    {product.colorSummary || '—'}
                                                </td>
                                                <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-200">
                                                    {product.glassSummary || '—'}
                                                </td>
                                                <td className="py-2 px-3 align-top text-gray-900 dark:text-gray-100">
                                                    {formatProductPrice(product)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t('sales.aberturasQuote.productResults.empty', {
                                    defaultValue: 'No encontramos productos que cumplan con los filtros seleccionados.',
                                })}
                            </p>
                        )}
                        {selectedProductId && (
                            <p className="text-xs text-gray-500">
                                {t('sales.aberturasQuote.productResults.selectedNotice', {
                                    defaultValue: 'El producto elegido en el selector superior siempre aparece resaltado.',
                                })}
                            </p>
                        )}
                    </div>
                </AdaptableCard>
            )}


            {analysis.status === 'exact' && (
                <AdaptableCard>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">
                                {t('sales.aberturasQuote.result.title', {
                                    defaultValue: 'Precio encontrado',
                                })}
                            </h3>
                            {analysis.resolution.estimated && (
                                <Tooltip
                                    title={t('sales.aberturasQuote.result.estimatedTooltip', {
                                        defaultValue:
                                            'Precio estimado utilizando deltas de mosquitero y/o monoblock.',
                                    })}
                                >
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                        {t('sales.aberturasQuote.result.estimatedBadge', {
                                            defaultValue: 'Estimado',
                                        })}
                                    </Badge>
                                </Tooltip>
                            )}
                        </div>
                        <div className="text-3xl font-semibold">
                            {toCurrency(analysis.resolution.currency, analysis.resolution.price)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {t('sales.aberturasQuote.result.components', {
                                defaultValue: 'Componentes considerados: {{components}}',
                                components: renderComponents(analysis.resolution.components),
                            })}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                            <div>
                                <span className="font-medium">
                                    {t('sales.aberturasQuote.summary.serie', {
                                        defaultValue: 'Serie:',
                                    })}
                                </span>{' '}
                                {analysis.row.serie}
                            </div>
                            <div>
                                <span className="font-medium">
                                    {t('sales.aberturasQuote.summary.vidrio', {
                                        defaultValue: 'Vidrio:',
                                    })}
                                </span>{' '}
                                {analysis.row.vidrio}
                            </div>
                            <div>
                                <span className="font-medium">
                                    {t('sales.aberturasQuote.summary.color', {
                                        defaultValue: 'Color:',
                                    })}
                                </span>{' '}
                                {analysis.row.color}
                            </div>
                            <div>
                                <span className="font-medium">
                                    {t('sales.aberturasQuote.summary.dimensions', {
                                        defaultValue: 'Medida:',
                                    })}
                                </span>{' '}
                                {analysis.row.widthMm} × {analysis.row.heightMm} mm
                            </div>
                            <div className="md:col-span-2">
                                <span className="font-medium">
                                    {t('sales.aberturasQuote.summary.extras', {
                                        defaultValue: 'Extras seleccionados:',
                                    })}
                                </span>{' '}
                                {formState?.mosquitero && formState?.monoblock
                                    ? t('sales.aberturasQuote.summary.extrasBoth', {
                                          defaultValue: 'Mosquitero + Persiana',
                                      })
                                    : formState?.mosquitero
                                    ? t('sales.aberturasQuote.summary.extrasMosq', {
                                          defaultValue: 'Mosquitero',
                                      })
                                    : formState?.monoblock
                                    ? t('sales.aberturasQuote.summary.extrasMb', {
                                          defaultValue: 'Persiana / Monoblock',
                                      })
                                    : t('sales.aberturasQuote.summary.extrasNone', {
                                          defaultValue: 'Sin extras',
                                      })}
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            {(() => {
                                const specs = analysis.row.specifications ?? analysis.row.detailSnapshot ?? ''
                                if (!specs) {
                                    return null
                                }
                                return <div>{specs}</div>
                            })()}
                            {analysis.row.referenceDate && (
                                <div>
                                    {t('sales.aberturasQuote.summary.reference', {
                                        defaultValue: 'Fecha de referencia: {{date}}',
                                        date: formatReferenceDate(analysis.row.referenceDate) ?? '-',
                                    })}
                                </div>
                            )}
                            {analysis.row.source && (
                                <div>
                                    {t('sales.aberturasQuote.summary.source', {
                                        defaultValue: 'Fuente: {{source}}',
                                        source: analysis.row.source,
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </AdaptableCard>
            )}

            {analysis.status === 'unavailable' && (
                <AdaptableCard>
                    <div className="flex flex-col gap-4">
                        <Alert type="warning" showIcon>
                            {t(reasonKeyMap[analysis.reason], {
                                defaultValue: t('sales.aberturasQuote.reasons.genericFallback', {
                                    defaultValue: 'No hay precio configurado para esta combinación.',
                                }),
                            })}
                        </Alert>
                        {analysis.suggestions.length ? (
                            <div className="flex flex-col gap-3">
                                <h4 className="text-sm font-semibold">
                                    {t('sales.aberturasQuote.suggestions.title', {
                                        defaultValue: 'Alternativas cercanas',
                                    })}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {analysis.suggestions.map((suggestion) =>
                                        renderMatchCard({
                                            row: suggestion.row,
                                            resolution: {
                                                available: true,
                                                price: suggestion.price,
                                                currency: suggestion.currency,
                                                estimated: suggestion.estimated,
                                                components: suggestion.components,
                                            },
                                            similarity: suggestion.similarity,
                                        }),
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t('sales.aberturasQuote.suggestions.empty', {
                                    defaultValue:
                                        'No encontramos alternativas cercanas con precios cargados.',
                                })}
                            </p>
                        )}
                    </div>
                </AdaptableCard>
            )}
        </div>
    )
}

export default AberturasQuote
