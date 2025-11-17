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
import Tooltip from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import ProductTable, {
    type ProductTableHiddenColumn,
    type ProductTableRow,
} from '@/views/sales/ProductList/components/ProductTable'
import productListReducer from '@/views/sales/ProductList/store'
import { injectReducer, useAppSelector } from '@/store'
import { DEFAULT_SALES_UNIT, type SalesUnit } from '@/constants/product.constant'

injectReducer('salesProductList', productListReducer)
import {
    apiGetParametricConfig,
    apiGetParametricMatrix,
    apiGetSalesProducts,
    apiSearchParametricMatrix,
} from '@/services/SalesService'
import { apiGetAberturasConfig, apiGetAberturasSelectors } from '@/services/SettingsService'
import type { TableQueries } from '@/@types/common'
import { clientConfig } from '@/configs/clientConfig'
import type { ParametricConfigSnapshot } from '@/views/sales/ProductForm/ParametricConfigurator'
import {
    mapSelectorsToOptions,
    mergeSelectorValues,
    normalizeSelectorValue,
    toSelectorOption,
} from '@/views/sales/parametric/selectorUtils'
import type { AberturasSelectorSummary, SelectorOption } from '@/views/sales/parametric/selectorUtils'
import { applyMarginToCost } from '@/views/sales/parametric/priceUtils'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

type ProductSummary = ProductTableRow

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
    shutterOptionsSnapshot?: Record<string, { price?: number | null; priceMosq?: number | null }> | null
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
    shutterMaterial: string
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
        shutterMaterial: '',
    }
}

type PriceResolution =
    | {
          available: true
          price: number
          currency: string
          estimated: boolean
          components: string[]
          shutterMaterial?: string
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
              | 'shutter_material_mismatch'
      }

type MatchAdjustment = {
    priceRangeFactor: [number, number]
    note: string
}

type MatchMetadata = {
    matchLevel: 'exact' | 'near' | 'none'
    similarityScore: number
    dimensionDistance: number
    attributeMatches: {
        family: boolean
        serie: boolean
        width: boolean
        height: boolean
        vidrio: boolean
        color: boolean
    }
    sizeDeltaMm?: {
        width: number
        height: number
    }
    glassRankDelta?: number
    suggestedAdjustment?: MatchAdjustment
}

type MatrixMatch = {
    row: MatrixRow
    resolution: PriceResolution
    similarity: number
    metadata?: MatchMetadata
    matchLevel?: MatchMetadata['matchLevel']
    suggestedAdjustment?: MatchAdjustment
}

type MatrixSearchResultPayload = {
    exact?: MatrixMatch
    nearest: MatrixMatch[]
    suggestions: MatrixMatch[]
}

const dedupeMatches = (matches?: MatrixMatch[] | null): MatrixMatch[] => {
    if (!matches) {
        return []
    }
    const seen = new Set<number>()
    return matches.filter((match) => {
        if (seen.has(match.row.id)) {
            return false
        }
        seen.add(match.row.id)
        return true
    })
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
          suggestions: MatrixMatch[]
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
    widthMm?: number
    heightMm?: number
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
    normalizeComparableValue(value).replace(/[\s_-]+/g, '')

const tokenizeSummary = (value: string) =>
    value
        .replace(/_/g, ' ')
        .split(/[,/|•·;>\s-]+/)
        .map((token) => token.trim())
        .filter(Boolean)

const matchesAnyField = (fields: Array<string | null | undefined>, target?: string | null) =>
    fields.some((field) => {
        if (!field) {
            return false
        }
        return normalizeComparableKey(field).includes(normalizeComparableKey(target))
    })

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

const extractNumericTokens = (value?: string | null): number[] => {
    if (!value) {
        return []
    }
    const matches = value.match(/\d+(?:[.,]\d+)?/g)
    if (!matches) {
        return []
    }
    return matches
        .map((token) => {
            const normalized = token.replace(',', '.').replace(/\.(?=\d{3}(?:\D|$))/g, '')
            const parsed = Number(normalized)
            return Number.isFinite(parsed) ? parsed : null
        })
        .filter((value): value is number => value !== null)
}

const matchesDimensionToken = (fields: Array<string | null | undefined>, target?: number) => {
    if (!target || target <= 0) {
        return true
    }
    return fields.some((field) => {
        if (!field) {
            return false
        }
        const numbers = extractNumericTokens(field)
        return numbers.some((value) => value === target)
    })
}

const extractDimensionPairs = (value?: string | null): Array<{ width: number; height: number }> => {
    if (!value) {
        return []
    }
    const normalized = value.toLowerCase()
    const pattern = /(\d{2,5})(?:\s*(?:x|×|\*|por|⁄|\/|\\|\-|–|—|\s+por\s+)\s*)(\d{2,5})/gi
    const pairs: Array<{ width: number; height: number }> = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(normalized)) !== null) {
        const width = Number(match[1])
        const height = Number(match[2])
        if (Number.isFinite(width) && Number.isFinite(height)) {
            pairs.push({ width, height })
        }
    }
    return pairs
}

const matchesDimensionAxis = (
    fields: Array<string | null | undefined>,
    axis: 'width' | 'height',
    target?: number,
) => {
    if (!target || target <= 0) {
        return true
    }
    let hasPairs = false
    const matches = fields.some((field) => {
        if (!field) {
            return false
        }
        const pairs = extractDimensionPairs(field)
        if (!pairs.length) {
            return false
        }
        hasPairs = true
        return pairs.some((pair) => (axis === 'width' ? pair.width === target : pair.height === target))
    })
    if (hasPairs) {
        return matches
    }
    return matchesDimensionToken(fields, target)
}

const matchesExactDimensionPair = (
    fields: Array<string | null | undefined>,
    width?: number,
    height?: number,
) => {
    if ((!width || width <= 0) && (!height || height <= 0)) {
        return true
    }
    return fields.some((field) => {
        if (!field) {
            return false
        }
        const pairs = extractDimensionPairs(field)
        return pairs.some((pair) => {
            const widthMatch = !width || width <= 0 || pair.width === width
            const heightMatch = !height || height <= 0 || pair.height === height
            return widthMatch && heightMatch
        })
    })
}

const productMatchesFilters = (product: ProductSummary, filters: ProductFilterCriteria) => {
    if (filters.familyId) {
        const normalizedProductFamily = normalizeComparableKey(product.familyId ?? '')
        const normalizedFilter = normalizeComparableKey(filters.familyId)
        const fallbackMatch = matchesAnyField(
            [product.familySummary, product.category, product.name, product.specifications, product.description],
            filters.familyId,
        )
        if (normalizedProductFamily) {
            if (normalizedProductFamily !== normalizedFilter && !fallbackMatch) {
                return false
            }
        } else if (!fallbackMatch) {
            return false
        }
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
    const dimensionFields = [product.specifications, product.description, product.name]
    if (filters.widthMm && filters.heightMm) {
        if (!matchesExactDimensionPair(dimensionFields, filters.widthMm, filters.heightMm)) {
            return false
        }
    } else {
        if (!matchesDimensionAxis(dimensionFields, 'width', filters.widthMm)) {
            return false
        }
        if (!matchesDimensionAxis(dimensionFields, 'height', filters.heightMm)) {
            return false
        }
    }
    return true
}

const productMatchesExtras = (
    product: ProductSummary,
    extras: { mosquitero: boolean; monoblock: boolean },
    shutterMaterial?: string,
) => {
    const mosq = Boolean(product.mosquiteroAvailable)
    const mono = Boolean(product.monoblockAvailable)
    if (extras.mosquitero && extras.monoblock) {
        return mosq && mono
    }
    if (extras.mosquitero) {
        return mosq
    }
    if (extras.monoblock) {
        if (!mono) {
            return false
        }
        const selection = normalizeSelectorValue(shutterMaterial)
        if (selection && product.shutterMaterialSummary) {
            const summaryTokens = product.shutterMaterialSummary
                .split(',')
                .map((entry) => normalizeSelectorValue(entry))
            if (!summaryTokens.some((token) => token === selection)) {
                return false
            }
        }
        return true
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
    const map = new Map<string, string>()
    values.forEach((raw) => {
        if (!raw) {
            return
        }
        const canonical = normalizeSelectorValue(raw)
        if (!canonical) {
            return
        }
        if (!map.has(canonical)) {
            map.set(canonical, raw)
        }
    })
    const sorted = Array.from(map.entries()).sort((a, b) =>
        a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }),
    )
    return sorted.map(([, label]) => {
        const trimmed = label?.toString().trim() ?? ''
        return { value: trimmed, label: trimmed }
    })
}

const normalizeShutterMaterial = (value?: string | null) => {
    if (!value) {
        return ''
    }
    return value.toString().trim().toUpperCase()
}

type ShutterOptionSnapshot = {
    material: string
    normalized: string
    price?: number | null
    priceMosq?: number | null
}

const collectShutterOptions = (row: MatrixRow): ShutterOptionSnapshot[] => {
    const entries: ShutterOptionSnapshot[] = []
    if (row.shutterOptionsSnapshot) {
        Object.entries(row.shutterOptionsSnapshot).forEach(([material, payload]) => {
            const normalized = normalizeShutterMaterial(material) || 'GENERICA'
            entries.push({
                material,
                normalized,
                price: typeof payload?.price === 'number' ? payload.price : null,
                priceMosq: typeof payload?.priceMosq === 'number' ? payload.priceMosq : null,
            })
        })
    }
    if (!entries.length && ((row.priceMonoblock ?? 0) > 0 || (row.priceMonoblockMosquitero ?? 0) > 0)) {
        const material = row.shutterMaterial?.trim() || 'GENERICA'
        entries.push({
            material,
            normalized: normalizeShutterMaterial(material) || 'GENERICA',
            price: row.priceMonoblock ?? null,
            priceMosq: row.priceMonoblockMosquitero ?? null,
        })
    }
    return entries
}

const resolvePrice = (
    row: MatrixRow,
    options: { mosquitero: boolean; monoblock: boolean; shutterMaterial?: string },
): PriceResolution => {
    const baseCandidate = typeof row.priceBase === 'number' && row.priceBase > 0 ? row.priceBase : row.price
    const basePrice = typeof baseCandidate === 'number' && baseCandidate > 0 ? Number(baseCandidate.toFixed(4)) : null

    if (!options.mosquitero && !options.monoblock) {
        if (!basePrice) {
            return { available: false, reason: 'missing_base' }
        }
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
    let mbPrice = row.priceMonoblock ?? null
    let mbMosqPrice = row.priceMonoblockMosquitero ?? null
    let resolvedShutterMaterial = row.shutterMaterial?.trim() || ''

    if (options.monoblock) {
        const snapshots = collectShutterOptions(row)
        const normalizedRequested = normalizeShutterMaterial(options.shutterMaterial)
        let selected: ShutterOptionSnapshot | undefined
        if (normalizedRequested) {
            selected = snapshots.find((entry) => entry.normalized === normalizedRequested)
            if (!selected && snapshots.length) {
                return { available: false, reason: 'shutter_material_mismatch' }
            }
        }
        if (!selected && snapshots.length) {
            const normalizedDefault = normalizeShutterMaterial(row.shutterMaterial)
            selected = snapshots.find((entry) => entry.normalized === normalizedDefault) ?? snapshots[0]
        }
        if (selected) {
            resolvedShutterMaterial = selected.material
            mbPrice = typeof selected.price === 'number' ? selected.price : mbPrice
            mbMosqPrice = typeof selected.priceMosq === 'number' ? selected.priceMosq : mbMosqPrice
        }
    }

    if (options.mosquitero && options.monoblock) {
        if (mbMosqPrice && mbMosqPrice > 0) {
            return {
                available: true,
                price: Number(mbMosqPrice.toFixed(4)),
                currency: row.currency,
                estimated: false,
                components: ['monoblock_mosq'],
                shutterMaterial: resolvedShutterMaterial || options.shutterMaterial,
            }
        }
        if (mosqPrice && mosqPrice > 0 && mbPrice && mbPrice > 0 && basePrice) {
            const deltaMosq = mosqPrice - basePrice
            const deltaMb = mbPrice - basePrice
            const price = basePrice + deltaMosq + deltaMb
            return {
                available: true,
                price: Number(price.toFixed(4)),
                currency: row.currency,
                estimated: true,
                components: ['base', 'delta_mosq', 'delta_mb'],
                shutterMaterial: resolvedShutterMaterial || options.shutterMaterial,
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
                shutterMaterial: resolvedShutterMaterial || options.shutterMaterial,
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
    toggles: { mosquitero: boolean; monoblock: boolean; shutterMaterial?: string },
): MatrixMatch[] => {
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
                resolution,
                similarity,
            }
        })
        .filter(Boolean) as MatrixMatch[]

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
    const { t, i18n } = useTranslation()
    const isUrucortinas = clientConfig.slug === 'urucortinas'

    const defaultTableQuery = useMemo<TableQueries>(
        () => ({
            total: 0,
            pageIndex: 1,
            pageSize: 100,
            query: '',
            sort: {
                order: '',
                key: '',
            },
        }),
        [],
    )

    const [products, setProducts] = useState<ProductSummary[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [matrix, setMatrix] = useState<MatrixRow[]>([])
    const [configSnapshot, setConfigSnapshot] = useState<ParametricConfigSnapshot | null>(null)
    const [selectorSummary, setSelectorSummary] = useState<AberturasSelectorSummary | null>(null)
    const [productResults, setProductResults] = useState<ProductSummary[]>([])
    const [productSearchPerformed, setProductSearchPerformed] = useState(false)
    const [marginPercent, setMarginPercent] = useState<number>(0)
    const defaultCurrency = useAppSelector((state) => state.currency.code)
    const fallbackCurrency = useMemo(
        () => normalizeCurrencyCode(defaultCurrency, 'UYU') || 'UYU',
        [defaultCurrency],
    )

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

    const loadPricingConfig = useCallback(async () => {
        if (!isUrucortinas) {
            setMarginPercent(0)
            return
        }
        try {
            const response = await apiGetAberturasConfig<{ pricing?: { markupPercent?: number } }>()
            const payload = (response?.data ?? response ?? null) as { pricing?: { markupPercent?: number } } | null
            const margin = Number(payload?.pricing?.markupPercent)
            setMarginPercent(Number.isFinite(margin) ? margin : 0)
        } catch (error) {
            console.error('[aberturas] failed to load pricing config', error)
            setMarginPercent(0)
        }
    }, [isUrucortinas])

    const salePriceFromCost = useCallback(
        (cost?: number | null) => applyMarginToCost(cost, marginPercent),
        [marginPercent],
    )

    const formatSaleCurrency = useCallback(
        (amount: number, currency?: string) =>
            formatCurrency(amount, currency, i18n.language, {
                fallbackCurrency,
            }),
        [fallbackCurrency, i18n.language],
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
    const selectedProduct = useMemo(
        () => products.find((product) => product.id === selectedProductId) ?? null,
        [products, selectedProductId],
    )
    useEffect(() => {
        if (!selectedProduct) {
            return
        }
        setProductResults((prev) => {
            const others = prev.filter((item) => item.id !== selectedProduct.id)
            return ensureUniqueProducts([selectedProduct, ...others])
        })
        setProductSearchPerformed(true)
    }, [selectedProduct])
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
    const [manualSizeMode, setManualSizeMode] = useState(true)
    const [searchResult, setSearchResult] = useState<MatrixSearchResultPayload | null>(null)
    const [searchPerformed, setSearchPerformed] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const productTableHiddenColumns = useMemo<ProductTableHiddenColumn[]>(
        () => ['sku', 'specifications', 'published', 'costPrice'],
        [],
    )
    const resetProductResults = useCallback(() => {
        setProductResults([])
        setProductSearchPerformed(false)
    }, [])
    const resetSearchOutcome = useCallback(() => {
        setSearchResult(null)
        setSearchError(null)
        setSearchPerformed(false)
    }, [])
    const resetAllResults = useCallback(() => {
        resetProductResults()
        resetSearchOutcome()
    }, [resetProductResults, resetSearchOutcome])

    const defaultParametricProductId = useMemo(() => {
        const metadata = (clientConfig.metadata ?? {}) as Record<string, unknown>
        const metaId = Number(
            metadata?.aberturasParametricProductId ?? metadata?.parametricProductId ?? metadata?.DEFAULT_PARAMETRIC_PRODUCT_ID,
        )
        if (Number.isFinite(metaId) && metaId > 0) {
            return String(metaId)
        }
        return ''
    }, [])

    const activeProductId = useMemo(
        () => selectedProductId || defaultParametricProductId,
        [defaultParametricProductId, selectedProductId],
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
        const productCodeRaw =
            (typeof item.productCode === 'string' && item.productCode.trim()) ||
            (typeof item.parametricSku === 'string' && item.parametricSku.trim()) ||
            ''
        const salePrice = Number(
            item.salePrice ?? item.price ?? item?.parametricPricing?.basePrice ?? 0,
        )
        const costPrice = Number(item.costPrice ?? 0)
        const stockValue = Number(item.stock ?? 0)
        const currency =
            item.currency ?? item?.parametricPricing?.currency ?? 'USD'
        const specs =
            typeof item.specifications === 'string' ? item.specifications : ''
        const description =
            typeof item.description === 'string' ? item.description : ''
        const familyIdRaw =
            item.familyId ?? item.family_id ?? item.familyKey ?? item.family ?? ''
        const familyId = typeof familyIdRaw === 'string' ? familyIdRaw.trim() : ''
        return {
            id: String(item.id ?? ''),
            name:
                (typeof item.name === 'string' && item.name.trim()) ||
                productCodeRaw ||
                '-',
            productCode: productCodeRaw,
            img: typeof item.img === 'string' ? item.img : '',
            category: String(item.category ?? ''),
            salePrice: Number.isFinite(salePrice) ? salePrice : 0,
            costPrice: Number.isFinite(costPrice) ? costPrice : 0,
            stock: Number.isFinite(stockValue) ? stockValue : 0,
            status: Number(item.status ?? 0),
            published:
                typeof item.published === 'boolean' ? item.published : undefined,
            brand: typeof item.brand === 'string' ? item.brand : '',
            vendor: typeof item.vendor === 'string' ? item.vendor : '',
            permanentStock: Boolean(item.permanentStock),
            currency,
            unitOfMeasure:
                (item.unitOfMeasure as SalesUnit | undefined) ?? DEFAULT_SALES_UNIT,
            specifications: specs,
            description,
            familySummary:
                (typeof item.familySummary === 'string' && item.familySummary) ||
                '',
            familyId: familyId || undefined,
            serieSummary:
                (typeof item.serieSummary === 'string' && item.serieSummary) ||
                '',
            widthSummary:
                (typeof item.widthSummary === 'string' && item.widthSummary) ||
                '',
            heightSummary:
                (typeof item.heightSummary === 'string' && item.heightSummary) ||
                '',
            colorSummary:
                (typeof item.colorSummary === 'string' && item.colorSummary) ||
                '',
            glassSummary:
                (typeof item.glassSummary === 'string' && item.glassSummary) ||
                '',
            mosquiteroAvailable: Boolean(item.mosquiteroAvailable),
            monoblockAvailable: Boolean(item.monoblockAvailable),
            shutterMaterialSummary:
                (typeof item.shutterMaterialSummary === 'string' &&
                    item.shutterMaterialSummary) ||
                '',
            parametricSku:
                (typeof item.parametricSku === 'string' && item.parametricSku) ||
                '',
            parametricPricing: item.parametricPricing ?? null,
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
                resetAllResults()
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
    }, [defaultTableQuery, isUrucortinas, normalizeProduct, resetAllResults, selectedProductId, t])

    useEffect(() => {
        if (!isUrucortinas) {
            return
        }
        fetchProducts()
    }, [fetchProducts, isUrucortinas])

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

    useEffect(() => {
        loadPricingConfig()
    }, [loadPricingConfig])

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
                resetAllResults()
                return
            }
            setLoadingMatrix(true)
            setMatrixError(null)
            setAnalysis({ status: 'idle' })
            resetAllResults()
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
        [isUrucortinas, resetAllResults, summarySelectors, t],
    )

    useEffect(() => {
        if (!isUrucortinas) {
            return
        }
        if (activeProductId) {
            fetchMatrix(activeProductId)
        } else if (summarySelectors) {
            const defaults = buildDefaultFormState(summarySelectors, null)
            setFormState(defaults)
            setManualSizeMode(true)
        }
    }, [activeProductId, fetchMatrix, isUrucortinas, summarySelectors])

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
            payload.shutterMaterial = ''
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

    const availableShutterMaterials = useMemo(() => {
        if (activeRow) {
            const options = collectShutterOptions(activeRow)
            if (options.length) {
                const seen = new Set<string>()
                return options
                    .map((option) => option.material?.trim())
                    .filter((material): material is string => {
                        if (!material) {
                            return false
                        }
                        const key = normalizeShutterMaterial(material)
                        if (seen.has(key)) {
                            return false
                        }
                        seen.add(key)
                        return true
                    })
            }
            if (activeRow.shutterMaterial?.trim()) {
                return [activeRow.shutterMaterial.trim()]
            }
        }
        return (mergedSelectors?.shutterMaterials ?? []).filter((value) => Boolean(value && value.trim()))
    }, [activeRow, mergedSelectors])

    const shutterMaterialOptions = useMemo(
        () => availableShutterMaterials.map((material) => toSelectorOption(material, material)),
        [availableShutterMaterials],
    )

    const defaultShutterMaterial = useMemo(
        () => availableShutterMaterials.find((value) => value && value.trim()) ?? '',
        [availableShutterMaterials],
    )

    const requiresMonoblock = useMemo(() => {
        if (!activeRow) {
            return false
        }
        const basePrice = typeof activeRow.priceBase === 'number' && activeRow.priceBase > 0
        return !basePrice && activeRow.hasMonoblockOption && availableShutterMaterials.length > 0
    }, [activeRow, availableShutterMaterials])

    useEffect(() => {
        if (!formState) {
            return
        }
        if (requiresMonoblock && !formState.monoblock) {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          monoblock: true,
                      }
                    : prev,
            )
        }
    }, [formState, requiresMonoblock])

    useEffect(() => {
        if (!formState) {
            return
        }
        if (!formState.monoblock) {
            if (formState.shutterMaterial) {
                setFormState((prev) => (prev ? { ...prev, shutterMaterial: '' } : prev))
            }
            return
        }
        if (!availableShutterMaterials.length) {
            if (formState.shutterMaterial) {
                setFormState((prev) => (prev ? { ...prev, shutterMaterial: '' } : prev))
            }
            return
        }
        const normalizedSelection = normalizeShutterMaterial(formState.shutterMaterial)
        const normalizedList = availableShutterMaterials.map((value) => normalizeShutterMaterial(value))
        if (!normalizedSelection || !normalizedList.includes(normalizedSelection)) {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          shutterMaterial: defaultShutterMaterial,
                      }
                    : prev,
            )
        }
    }, [availableShutterMaterials, defaultShutterMaterial, formState])

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
            updated.shutterMaterial = ''
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
                resetAllResults()
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
                            shutterMaterial: '',
                        }
                      : prev,
            )
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [formState?.familyId, matrix, resetAllResults, sizeOptions],
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
                          shutterMaterial: '',
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [resetAllResults],
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
                          shutterMaterial: '',
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [resetAllResults],
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
                          shutterMaterial: '',
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [resetAllResults],
    )

    const handleShutterMaterialChange = useCallback(
        (value: string) => {
            const nextValue = value?.trim() ?? ''
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          shutterMaterial: nextValue,
                      }
                    : prev,
            )
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [resetAllResults],
    )

    const handleToggleChange = useCallback(
        (field: 'mosquitero' | 'monoblock') => {
            setFormState((prev) => {
                if (!prev) {
                    return prev
                }
                if (field === 'monoblock') {
                    const nextValue = !prev.monoblock
                    return {
                        ...prev,
                        monoblock: nextValue,
                        shutterMaterial: nextValue ? prev.shutterMaterial : '',
                    }
                }
                return {
                    ...prev,
                    [field]: !prev[field],
                }
            })
            setAnalysis({ status: 'idle' })
            resetAllResults()
        },
        [resetAllResults],
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
                      shutterMaterial: '',
                  }
                : prev,
        )
        setManualSizeMode(true)
        setAnalysis({ status: 'idle' })
        resetAllResults()
    }, [resetAllResults])

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
            resetAllResults()
        },
        [resetAllResults],
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

    const hasActiveFilters = useMemo(() => {
        if (!formState) {
            return false
        }
        const {
            familyId,
            color,
            serie,
            vidrio,
            widthMm,
            heightMm,
            mosquitero,
            monoblock,
        } = formState
        return Boolean(
            familyId.trim() ||
                color.trim() ||
                serie.trim() ||
                vidrio.trim() ||
                (widthMm && widthMm > 0) ||
                (heightMm && heightMm > 0) ||
                mosquitero ||
                monoblock,
        )
    }, [formState])

    const canSearchProducts = useMemo(
        () => Boolean(formState) && hasActiveFilters,
        [formState, hasActiveFilters],
    )

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
        if (formState.mosquitero) {
            push(
                t('sales.aberturasQuote.labels.mosquitero', { defaultValue: 'Mosquitero' }),
                t('sales.aberturasQuote.filterSummary.enabled', { defaultValue: 'Sí' }),
            )
        }
        if (formState.monoblock) {
            push(
                t('sales.aberturasQuote.labels.monoblock', { defaultValue: 'Monoblock' }),
                t('sales.aberturasQuote.filterSummary.enabled', { defaultValue: 'Sí' }),
            )
        }
        if (formState.widthMm > 0) {
            push(
                t('sales.aberturasQuote.labels.manualWidth', { defaultValue: 'Ancho' }),
                `${formState.widthMm} mm`,
            )
        }
        if (formState.heightMm > 0) {
            push(
                t('sales.aberturasQuote.labels.manualHeight', { defaultValue: 'Alto' }),
                `${formState.heightMm} mm`,
            )
        }
        return summary
    }, [colorOptions, familyOptions, formState, serieOptions, t, vidrioOptions])

    const filtersRequirementMessage = useMemo(
        () =>
            t('sales.aberturasQuote.filters.requirement', {
                defaultValue: 'Seleccioná al menos un filtro para buscar combinaciones.',
            }),
        [t],
    )

    const dimensionFilteredSearchResult = useMemo(() => {
        if (!searchResult || !formState) {
            return searchResult
        }
        const requiredWidth = formState.widthMm > 0 ? formState.widthMm : null
        const requiredHeight = formState.heightMm > 0 ? formState.heightMm : null
        if (!requiredWidth && !requiredHeight) {
            return searchResult
        }
        const enforceWidth = requiredWidth !== null
        const enforceHeight = requiredHeight !== null
        const adjustMatch = (input?: MatrixMatch | null): MatrixMatch | null => {
            if (!input) {
                return null
            }
            const widthMatches = !enforceWidth || input.row.widthMm === requiredWidth
            const heightMatches = !enforceHeight || input.row.heightMm === requiredHeight
            if (widthMatches && heightMatches) {
                return input
            }
            const patchedMetadata = input.metadata
                ? {
                      ...input.metadata,
                      matchLevel: input.metadata.matchLevel === 'exact' ? 'near' : input.metadata.matchLevel,
                      attributeMatches: {
                          ...input.metadata.attributeMatches,
                          width: enforceWidth ? false : input.metadata.attributeMatches.width,
                          height: enforceHeight ? false : input.metadata.attributeMatches.height,
                      },
                  }
                : undefined
            return {
                ...input,
                matchLevel: input.matchLevel === 'exact' ? 'near' : input.matchLevel,
                metadata: patchedMetadata,
            }
        }
        const normalizeList = (list?: MatrixMatch[] | null) =>
            (list ?? [])
                .map((item) => adjustMatch(item))
                .filter((item): item is MatrixMatch => Boolean(item))

        const prioritized = [
            ...(searchResult.exact ? [adjustMatch(searchResult.exact)] : []),
            ...normalizeList(searchResult.nearest),
        ].filter((item): item is MatrixMatch => Boolean(item))

        let promotedExact: MatrixMatch | undefined
        const normalizedNearest: MatrixMatch[] = []
        prioritized.forEach((match) => {
            if (!promotedExact && match.matchLevel === 'exact') {
                promotedExact = match
            } else {
                normalizedNearest.push(match)
            }
        })

        const normalizedSuggestions = normalizeList(searchResult.suggestions)

        return {
            exact: promotedExact,
            nearest: normalizedNearest,
            suggestions: normalizedSuggestions,
        }
    }, [formState, searchResult])

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
                    shutterMaterial: formState.shutterMaterial,
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
            shutterMaterial: formState.shutterMaterial,
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
                shutterMaterial: formState.shutterMaterial,
            },
        )
        setAnalysis({
            status: 'unavailable',
            reason: resolution.reason,
            suggestions,
        })
    }, [activeRow, formState, matrix])

    const handleSearch = useCallback(async () => {
        if (!formState) {
            return
        }
        if (!hasActiveFilters) {
            toast.push(
                <Notification title={filtersRequirementMessage} type="warning" />,
                { placement: 'top-center' },
            )
            return
        }
        const criteria: ProductFilterCriteria = {
            familyId: formState.familyId?.trim() || undefined,
            color: formState.color?.trim() || undefined,
            serie: formState.serie?.trim() || undefined,
            vidrio: formState.vidrio?.trim() || undefined,
            widthMm: formState.widthMm > 0 ? formState.widthMm : undefined,
            heightMm: formState.heightMm > 0 ? formState.heightMm : undefined,
        }
        const matches = products.filter(
            (product) =>
                productMatchesFilters(product, criteria) &&
                productMatchesExtras(product, {
                    mosquitero: formState.mosquitero,
                    monoblock: formState.monoblock,
                }, formState.shutterMaterial),
        )
        const merged = selectedProduct
            ? ensureUniqueProducts([selectedProduct, ...matches.filter((product) => product.id !== selectedProduct.id)])
            : ensureUniqueProducts(matches)
        setProductResults(merged)
        setProductSearchPerformed(true)

        let numericId: number | null = null
        if (activeProductId) {
            const parsed = Number(activeProductId)
            if (Number.isFinite(parsed) && parsed > 0) {
                numericId = parsed
            }
        }
        const payload: Record<string, unknown> = {}
        const applyFilterValue = (value?: string | null) => {
            const normalized = normalizeSelectorValue(value ?? '')
            return normalized || undefined
        }
        const familyValue = applyFilterValue(formState.familyId)
        const serieValue = applyFilterValue(formState.serie)
        const colorValue = applyFilterValue(formState.color)
        const glassValue = applyFilterValue(formState.vidrio)
        if (familyValue) payload.familyId = familyValue
        if (serieValue) payload.serie = serieValue
        if (colorValue) payload.color = colorValue
        if (glassValue) payload.vidrio = glassValue
        if (formState.widthMm > 0) payload.widthMm = formState.widthMm
        if (formState.heightMm > 0) payload.heightMm = formState.heightMm
        if (formState.mosquitero) payload.hasMosquitero = true
        if (formState.monoblock) payload.hasShutterMonoblock = true
        if (formState.monoblock && formState.shutterMaterial) {
            payload.shutterMaterial = formState.shutterMaterial.trim()
        }

        setSearchLoading(true)
        setSearchError(null)
        setSearchPerformed(false)
        try {
            const response = await apiSearchParametricMatrix<MatrixSearchResultPayload, Record<string, unknown>>(
                numericId,
                payload,
            )
            const data = ((response as any)?.data ?? response ?? null) as MatrixSearchResultPayload | null
            const toArray = (value: unknown): MatrixMatch[] => {
                if (!value) {
                    return []
                }
                if (Array.isArray(value)) {
                    return value as MatrixMatch[]
                }
                return [value as MatrixMatch]
            }
            const normalizeList = (list: MatrixMatch[] | null | undefined): MatrixMatch[] =>
                list ? [...list].sort((a, b) => (a.row.priceBase ?? a.row.price) - (b.row.priceBase ?? b.row.price)) : []

            const normalized: MatrixSearchResultPayload = data
                ? {
                      exact: data.exact,
                      nearest: normalizeList(dedupeMatches(toArray((data as any).nearest))),
                      suggestions: normalizeList(
                          dedupeMatches(Array.isArray(data.suggestions) ? data.suggestions : []),
                      ),
                  }
                : { nearest: [], suggestions: [] }
            setSearchResult(normalized)
        } catch (error) {
            console.error('[aberturas] search failed', error)
            setSearchResult(null)
            setSearchError(
                t('sales.aberturasQuote.notifications.searchError', {
                    defaultValue: 'No pudimos obtener coincidencias. Intentá nuevamente en unos segundos.',
                }),
            )
        } finally {
            setSearchPerformed(true)
            setSearchLoading(false)
        }
    }, [activeProductId, filtersRequirementMessage, formState, hasActiveFilters, products, selectedProduct, t])

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

    const describeAttributeMatches = useCallback(
        (metadata?: MatchMetadata) => {
            if (!metadata) {
                return null
            }
            const descriptors = [
                {
                    label: t('sales.aberturasQuote.match.attributes.family', { defaultValue: 'Tipo' }),
                    matched: metadata.attributeMatches.family,
                },
                {
                    label: t('sales.aberturasQuote.match.attributes.serie', { defaultValue: 'Serie' }),
                    matched: metadata.attributeMatches.serie,
                },
                {
                    label: t('sales.aberturasQuote.match.attributes.glass', { defaultValue: 'Vidrio' }),
                    matched: metadata.attributeMatches.vidrio,
                },
                {
                    label: t('sales.aberturasQuote.match.attributes.color', { defaultValue: 'Color' }),
                    matched: metadata.attributeMatches.color,
                },
            ]
            return descriptors
                .map(
                    (descriptor) =>
                        `${descriptor.label}: ${
                            descriptor.matched
                                ? t('sales.aberturasQuote.match.attributeMatch', { defaultValue: 'Sí' })
                                : t('sales.aberturasQuote.match.attributeMismatch', { defaultValue: 'No' })
                        }`,
                )
                .join(' • ')
        },
        [t],
    )

    const formatAdjustmentDelta = useCallback((factor: number) => {
        const delta = (factor - 1) * 100
        const absDelta = Math.abs(delta)
        const formatted =
            absDelta < 0.05
                ? '0%'
                : `${delta > 0 ? '+' : ''}${absDelta >= 10 ? delta.toFixed(0) : delta.toFixed(1)}%`
        return formatted
    }, [])

    const renderMatchInsights = useCallback(
        (match: MatrixMatch) => {
            const blocks: JSX.Element[] = []
            const { metadata } = match
            if (metadata?.sizeDeltaMm) {
                blocks.push(
                    <div key="delta">
                        {t('sales.aberturasQuote.match.sizeDelta', {
                            defaultValue: 'Δ ancho {{width}} mm · Δ alto {{height}} mm',
                            width: metadata.sizeDeltaMm.width,
                            height: metadata.sizeDeltaMm.height,
                        })}
                    </div>,
                )
            }
            const attributeSummary = describeAttributeMatches(metadata)
            if (attributeSummary) {
                blocks.push(
                    <div key="attributes">
                        {t('sales.aberturasQuote.match.attributeSummary', {
                            defaultValue: 'Coincidencias: {{summary}}',
                            summary: attributeSummary,
                        })}
                    </div>,
                )
            }
            const adjustment = match.suggestedAdjustment ?? metadata?.suggestedAdjustment
            if (adjustment) {
                const minPercent = formatAdjustmentDelta(adjustment.priceRangeFactor[0])
                const maxPercent = formatAdjustmentDelta(adjustment.priceRangeFactor[1])
                blocks.push(
                    <div key="adjustment" className="text-amber-600 dark:text-amber-400">
                        {t('sales.aberturasQuote.match.adjustmentRange', {
                            defaultValue: 'Ajuste sugerido: {{min}} – {{max}}',
                            min: minPercent,
                            max: maxPercent,
                        })}
                        {adjustment.note && <div>{adjustment.note}</div>}
                    </div>,
                )
            }
            if (!blocks.length) {
                return null
            }
            return (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
                    {blocks}
                </div>
            )
        },
        [describeAttributeMatches, formatAdjustmentDelta, t],
    )

    const renderMatchCard = useCallback(
        (match: MatrixMatch) => {
            const similarityValue = match.metadata?.dimensionDistance ?? match.similarity
            const matchLevel = match.matchLevel ?? match.metadata?.matchLevel
            const baseEntries = [
                {
                    key: 'priceBase',
                    label: t('sales.aberturasQuote.match.priceLabels.base', { defaultValue: 'Precio base' }),
                    value: typeof match.row.priceBase === 'number' ? match.row.priceBase : match.row.price ?? null,
                    highlight: match.resolution.components.includes('base'),
                },
                {
                    key: 'priceMosquitero',
                    label: t('sales.aberturasQuote.match.priceLabels.mosquitero', { defaultValue: 'Mosquitero' }),
                    value: match.row.priceMosquitero,
                    highlight: match.resolution.components.includes('mosquitero'),
                },
            ].filter((entry) => typeof entry.value === 'number' && entry.value > 0)

            const shutterSnapshot = match.row.shutterOptionsSnapshot ?? undefined
            const snapshotEntries: Array<{
                key: string
                label: string
                value: number | null | undefined
                highlight: boolean
            }> = []
            const snapshotKeys = shutterSnapshot ? Object.keys(shutterSnapshot) : []
            const normalizedSelectedMaterial = (match.row.shutterMaterial ?? '').trim().toUpperCase()
            const matchesSelectedMaterial = (materialKey: string) => {
                const normalized = materialKey.trim().toUpperCase()
                if (normalizedSelectedMaterial) {
                    return normalizedSelectedMaterial === normalized
                }
                return snapshotKeys.length <= 1
            }
            const formatMaterialLabel = (material: string) => {
                const normalized = material.trim().toUpperCase()
                if (!normalized || normalized === 'GENERICA') {
                    return t('sales.aberturasQuote.match.priceLabels.shutterGeneric', {
                        defaultValue: 'Genérico',
                    })
                }
                return normalized
            }

            if (snapshotKeys.length) {
                snapshotKeys.forEach((materialKey) => {
                    const option = shutterSnapshot?.[materialKey]
                    if (!option) {
                        return
                    }
                    if (typeof option.price === 'number' && option.price > 0) {
                        snapshotEntries.push({
                            key: `monoblock-${materialKey}`,
                            label: t('sales.aberturasQuote.match.priceLabels.monoblockMaterial', {
                                defaultValue: 'Monoblock {{material}}',
                                material: formatMaterialLabel(materialKey),
                            }),
                            value: option.price,
                            highlight: match.resolution.components.includes('shutter') && matchesSelectedMaterial(materialKey),
                        })
                    }
                    if (typeof option.priceMosq === 'number' && option.priceMosq > 0) {
                        snapshotEntries.push({
                            key: `monoblock-mosq-${materialKey}`,
                            label: t('sales.aberturasQuote.match.priceLabels.monoblockMosqMaterial', {
                                defaultValue: 'Monoblock {{material}} + mosquitero',
                                material: formatMaterialLabel(materialKey),
                            }),
                            value: option.priceMosq,
                            highlight:
                                match.resolution.components.includes('shutter') &&
                                match.resolution.components.includes('mosquitero') &&
                                matchesSelectedMaterial(materialKey),
                        })
                    }
                })
            } else {
                if (typeof match.row.priceMonoblock === 'number' && match.row.priceMonoblock > 0) {
                    snapshotEntries.push({
                        key: 'priceMonoblock',
                        label: t('sales.aberturasQuote.match.priceLabels.monoblock', { defaultValue: 'Monoblock' }),
                        value: match.row.priceMonoblock,
                        highlight: match.resolution.components.includes('shutter'),
                    })
                }
                if (
                    typeof match.row.priceMonoblockMosquitero === 'number' &&
                    match.row.priceMonoblockMosquitero > 0
                ) {
                    snapshotEntries.push({
                        key: 'priceMonoblockMosquitero',
                        label: t('sales.aberturasQuote.match.priceLabels.monoblockMosq', {
                            defaultValue: 'Monoblock + mosquitero',
                        }),
                        value: match.row.priceMonoblockMosquitero,
                        highlight:
                            match.resolution.components.includes('shutter') &&
                            match.resolution.components.includes('mosquitero'),
                    })
                }
            }

            const priceEntries = [...baseEntries, ...snapshotEntries].filter(
                (entry) => typeof entry.value === 'number' && entry.value > 0,
            )
            return (
                <div
                    key={`${match.row.id}-${match.similarity}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3 flex flex-col gap-2"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">
                            {match.resolution.available
                                ? formatSaleCurrency(
                                      salePriceFromCost(match.resolution.price),
                                      match.row.currency,
                                  )
                                : t('sales.aberturasQuote.result.unavailable', {
                                      defaultValue: 'Sin precio',
                                  })}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {matchLevel === 'exact' && (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                    {t('sales.aberturasQuote.match.badges.exact', { defaultValue: 'Exacto' })}
                                </Badge>
                            )}
                            {matchLevel === 'near' && (
                                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                                    {t('sales.aberturasQuote.match.badges.near', { defaultValue: 'Cercano' })}
                                </Badge>
                            )}
                            {match.resolution.available && match.resolution.estimated && (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                    {t('sales.aberturasQuote.result.estimatedBadge', {
                                        defaultValue: 'Estimado',
                                    })}
                                </Badge>
                            )}
                            {similarityValue > 0 && (
                                <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-200">
                                    {t('sales.aberturasQuote.filters.similarity', {
                                        defaultValue: 'Δ {{value}} mm',
                                        value: similarityValue.toFixed(0),
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
                        {t('sales.aberturasQuote.summary.color', {
                            defaultValue: 'Color:',
                        })}{' '}
                        {match.row.color || t('sales.aberturasQuote.summary.colorUnknown', { defaultValue: 'Sin especificar' })}
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
                    {priceEntries.length ? (
                        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('sales.aberturasQuote.match.priceBreakdownTitle', {
                                    defaultValue: 'Precios configurados',
                                })}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {priceEntries.map((entry) => (
                                    <div
                                        key={`${match.row.id}-${entry.key}`}
                                        className={`border rounded-md px-2 py-1.5 flex items-center justify-between gap-3 ${
                                            entry.highlight
                                                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
                                        }`}
                                    >
                                        <span className="font-medium text-gray-700 dark:text-gray-200">
                                            {entry.label}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                                            {formatSaleCurrency(
                                                salePriceFromCost(entry.value ?? 0),
                                                match.row.currency,
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {renderMatchInsights(match)}
                </div>
            )
        },
        [formatSaleCurrency, renderComponents, renderMatchInsights, salePriceFromCost, t],
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
                                    defaultValue: 'Seleccione abertura existente',
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
                                        resetAllResults()
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
                                                defaultValue: 'Monoblock',
                                            })}
                                        </span>
                                        {requiresMonoblock ? (
                                            <p className="text-xs text-gray-500">
                                                {t('sales.aberturasQuote.helpers.mbRequired', {
                                                    defaultValue: 'Esta medida solo se ofrece como conjunto con persiana.',
                                                })}
                                            </p>
                                        ) : (
                                            !monoblockAvailable && (
                                                <p className="text-xs text-gray-500">
                                                    {t('sales.aberturasQuote.helpers.mbUnavailable', {
                                                        defaultValue:
                                                            'No disponible para esta combinación.',
                                                    })}
                                                </p>
                                            )
                                        )}
                                    </div>
                                    <Switcher
                                        checked={formState.monoblock}
                                        onChange={() => handleToggleChange('monoblock')}
                                        disabled={!monoblockAvailable || requiresMonoblock}
                                    />
                                </div>
                                {formState.monoblock && (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs uppercase text-gray-500">
                                            {t('sales.aberturasQuote.labels.monoblockMaterial', {
                                                defaultValue: 'Material de persiana',
                                            })}
                                        </span>
                                        <Select
                                            options={shutterMaterialOptions}
                                            value={findOptionByValue(
                                                shutterMaterialOptions,
                                                formState.shutterMaterial,
                                            )}
                                            placeholder={t(
                                                'sales.aberturasQuote.labels.monoblockMaterialPlaceholder',
                                                {
                                                    defaultValue: 'Elegí un material',
                                                },
                                            )}
                                            isDisabled={!shutterMaterialOptions.length}
                                            onChange={(option) =>
                                                handleShutterMaterialChange(
                                                    (option as Option)?.value ?? '',
                                                )
                                            }
                                        />
                                        {!shutterMaterialOptions.length && (
                                            <p className="text-xs text-amber-600">
                                                {t('sales.aberturasQuote.helpers.shutterMaterialUnavailable', {
                                                    defaultValue: 'Cargá un material de persiana para habilitar esta opción.',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    {!hasActiveFilters && (
                                        <p className="w-full text-right text-xs text-amber-600 sm:w-auto sm:flex-1 sm:text-left">
                                            {filtersRequirementMessage}
                                        </p>
                                    )}
                                    {canSearchProducts ? (
                                        <Button
                                            variant="twoTone"
                                            disabled={!canSearchProducts}
                                            onClick={handleSearch}
                                        >
                                            {t('sales.aberturasQuote.filters.searchButton', {
                                                defaultValue: 'Buscar combinaciones',
                                            })}
                                        </Button>
                                    ) : (
                                        <Tooltip title={filtersRequirementMessage}>
                                            <span className="inline-flex">
                                                <Button
                                                    variant="twoTone"
                                                    disabled
                                                    onClick={handleSearch}
                                                >
                                                    {t('sales.aberturasQuote.filters.searchButton', {
                                                        defaultValue: 'Buscar combinaciones',
                                                    })}
                                                </Button>
                                            </span>
                                        </Tooltip>
                                    )}
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
                                            defaultValue: 'Sin filtros aplicados. Se muestran todas las combinaciones disponibles.',
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
                            <ProductTable
                                dataOverride={productResults}
                                loadingOverride={loadingProducts}
                                hiddenColumns={productTableHiddenColumns}
                                disableAutoFetch
                                forceParametricMode
                                marginPercent={marginPercent}
                            />
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t('sales.aberturasQuote.productResults.empty', {
                                    defaultValue: 'No encontramos productos que cumplan con los filtros seleccionados.',
                                })}
                            </p>
                        )}
                    </div>
                </AdaptableCard>
            )}

            {searchPerformed && (
                <AdaptableCard>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {t('sales.aberturasQuote.match.sectionTitle', {
                                        defaultValue: 'Resultados de la búsqueda',
                                    })}
                                </h3>
                                {productFilterSummary.length ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {productFilterSummary.join(' • ')}
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        {t('sales.aberturasQuote.match.noFilters', {
                                            defaultValue: 'Sin filtros aplicados.',
                                        })}
                                    </p>
                                )}
                            </div>
                            {searchLoading && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Spinner size={18} />{' '}
                                    {t('sales.aberturasQuote.loading.search', {
                                        defaultValue: 'Buscando…',
                                    })}
                                </div>
                            )}
                        </div>
                        {searchError && (
                            <Alert type="danger" showIcon>
                                {searchError}
                            </Alert>
                        )}
                        {!searchLoading && !searchError && (
                            <>
                                {dimensionFilteredSearchResult?.exact && (
                                    <div className="rounded-md border border-emerald-200 dark:border-emerald-500/30 p-4 space-y-3 bg-emerald-50/50 dark:bg-emerald-500/5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h4 className="text-base font-semibold">
                                                    {t('sales.aberturasQuote.match.exactTitle', {
                                                        defaultValue: 'Coincidencia exacta',
                                                    })}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                                    {t('sales.aberturasQuote.match.exactDescription', {
                                                        defaultValue: 'Cumple todos los atributos solicitados.',
                                                    })}
                                                </p>
                                            </div>
                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                                                {t('sales.aberturasQuote.match.badges.exact', {
                                                    defaultValue: 'Exacto',
                                                })}
                                            </Badge>
                                        </div>
                                        {renderMatchCard(dimensionFilteredSearchResult.exact)}
                                    </div>
                                )}
                                {(() => {
                                    const exactId = dimensionFilteredSearchResult?.exact?.row.id
                                    const nearestList = (dimensionFilteredSearchResult?.nearest ?? []).filter(
                                        (match) => !exactId || match.row.id !== exactId,
                                    )
                                    if (!nearestList.length) {
                                        return null
                                    }
                                    return (
                                        <div className="rounded-md border border-indigo-200 dark:border-indigo-500/30 p-4 space-y-3 bg-indigo-50/40 dark:bg-indigo-500/5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="text-base font-semibold">
                                                        {t('sales.aberturasQuote.match.nearestTitle', {
                                                            defaultValue: 'Coincidencia cercana',
                                                        })}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                                        {t('sales.aberturasQuote.match.nearestDescription', {
                                                            defaultValue:
                                                                'La mejor alternativa disponible considerando la serie y las medidas solicitadas.',
                                                        })}
                                                    </p>
                                                </div>
                                                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100">
                                                    {t('sales.aberturasQuote.match.badges.near', {
                                                        defaultValue: 'Cercano',
                                                    })}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                {nearestList.map((match) => renderMatchCard(match))}
                                            </div>
                                        </div>
                                    )
                                })()}
                                {dimensionFilteredSearchResult?.suggestions?.length ? (
                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-sm font-semibold">
                                            {t('sales.aberturasQuote.match.suggestionsTitle', {
                                                defaultValue: 'Otras sugerencias',
                                            })}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {dimensionFilteredSearchResult.suggestions.map((suggestion) => renderMatchCard(suggestion))}
                                        </div>
                                    </div>
                                ) : null}
                                {!dimensionFilteredSearchResult?.exact &&
                                    !(dimensionFilteredSearchResult?.nearest?.length) &&
                                    !(dimensionFilteredSearchResult?.suggestions?.length) && (
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            {t('sales.aberturasQuote.match.empty', {
                                                defaultValue:
                                                    'No encontramos coincidencias con los filtros aplicados.',
                                            })}
                                        </p>
                                    )}
                            </>
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
                            {formatSaleCurrency(
                                salePriceFromCost(analysis.resolution.price),
                                analysis.resolution.currency,
                            )}
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
                                {(() => {
                                    const materialLabel = (
                                        formState?.shutterMaterial?.trim() ||
                                        analysis.resolution.shutterMaterial ||
                                        analysis.row.shutterMaterial ||
                                        ''
                                    ).trim()
                                    if (formState?.mosquitero && formState?.monoblock) {
                                        return materialLabel
                                            ? t('sales.aberturasQuote.summary.extrasBothMaterial', {
                                                  defaultValue: 'Mosquitero + Persiana ({{material}})',
                                                  material: materialLabel,
                                              })
                                            : t('sales.aberturasQuote.summary.extrasBoth', {
                                                  defaultValue: 'Mosquitero + Persiana',
                                              })
                                    }
                                    if (formState?.mosquitero) {
                                        return t('sales.aberturasQuote.summary.extrasMosq', {
                                            defaultValue: 'Mosquitero',
                                        })
                                    }
                                    if (formState?.monoblock) {
                                        return materialLabel
                                            ? t('sales.aberturasQuote.summary.extrasMbMaterial', {
                                                  defaultValue: 'Monoblock ({{material}})',
                                                  material: materialLabel,
                                              })
                                            : t('sales.aberturasQuote.summary.extrasMb', {
                                                  defaultValue: 'Monoblock',
                                              })
                                    }
                                    return t('sales.aberturasQuote.summary.extrasNone', {
                                        defaultValue: 'Sin extras',
                                    })
                                })()}
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
