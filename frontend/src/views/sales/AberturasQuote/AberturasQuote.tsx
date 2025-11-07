import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Tooltip from '@/components/ui/Tooltip'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import { toast } from '@/components/ui/toast'
import {
    apiGetParametricMatrix,
    apiGetSalesProducts,
} from '@/services/SalesService'
import type { TableQueries } from '@/@types/common'
import { clientConfig } from '@/configs/clientConfig'

type ProductSummary = {
    id: string
    name: string
    currency?: string
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

type Option = {
    value: string
    label: string
}

type FormState = {
    sizeKey: string
    widthMm: number
    heightMm: number
    color: string
    serie: string
    vidrio: string
    mosquitero: boolean
    monoblock: boolean
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
    target: { widthMm: number; heightMm: number; color: string; serie: string; vidrio: string },
    toggles: { mosquitero: boolean; monoblock: boolean },
): Suggestion[] => {
    const preferred = rows.filter(
        (row) => row.widthMm === target.widthMm && row.heightMm === target.heightMm,
    )

    const sizeColorMatches = preferred.filter((row) => row.color === target.color)
    const pool = sizeColorMatches.length ? sizeColorMatches : preferred

    const evaluated = pool
        .map((row) => {
            const resolution = resolvePrice(row, toggles)
            if (!resolution.available) {
                return null
            }
            let similarity = 0
            if (row.serie === target.serie) {
                similarity += 4
            }
            if (row.vidrio === target.vidrio) {
                similarity += 2
            }
            if (row.color === target.color) {
                similarity += 1
            }
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

    evaluated.sort((a, b) => {
        if (b.similarity !== a.similarity) {
            return b.similarity - a.similarity
        }
        return a.price - b.price
    })

    return evaluated.slice(0, 4)
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

    const [products, setProducts] = useState<ProductSummary[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [matrix, setMatrix] = useState<MatrixRow[]>([])
    const [loadingMatrix, setLoadingMatrix] = useState(false)
    const [matrixError, setMatrixError] = useState<string | null>(null)
    const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
    const [formState, setFormState] = useState<FormState | null>(null)

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

    const fetchProducts = useCallback(async () => {
        if (!isUrucortinas) {
            return
        }
        setLoadingProducts(true)
        try {
            const payload: SalesProductsRequest = {
                ...defaultTableQuery,
                filterData: {
                    mode: 'parametric',
                },
            }
            const response = await apiGetSalesProducts<SalesProductsResponse, SalesProductsRequest>(
                payload,
            )
            const list = response.data?.data ?? []
            setProducts(list)
            if (list.length && !selectedProductId) {
                setSelectedProductId(String(list[0].id))
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
    }, [isUrucortinas, selectedProductId, t])

    const fetchMatrix = useCallback(
        async (productId: string) => {
            if (!isUrucortinas) {
                return
            }
            if (!productId) {
                setMatrix([])
                setFormState(null)
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
                if (!rows.length) {
                    setMatrix([])
                    setFormState(null)
                    setMatrixError(
                        t('sales.aberturasQuote.notifications.emptyMatrix', {
                            defaultValue: 'Este producto aún no tiene matriz cargada.',
                        }),
                    )
                    return
                }
                setMatrix(rows)
                const first = rows[0]
                setFormState({
                    sizeKey: getSizeKey(first.widthMm, first.heightMm),
                    widthMm: first.widthMm,
                    heightMm: first.heightMm,
                    color: first.color,
                    serie: first.serie,
                    vidrio: first.vidrio,
                    mosquitero: false,
                    monoblock: false,
                })
            } catch (error) {
                console.error('[aberturas] failed to load matrix', error)
                setMatrix([])
                setFormState(null)
                setMatrixError(
                    t('sales.aberturasQuote.notifications.matrixError', {
                        defaultValue: 'No se pudo cargar la matriz de precios.',
                    }),
                )
            } finally {
                setLoadingMatrix(false)
            }
        },
        [isUrucortinas, t],
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
        }
    }, [fetchMatrix, isUrucortinas, selectedProductId])

    const sizeOptions = useMemo(() => extractSizeOptions(matrix), [matrix])

    const rowsForSize = useMemo(() => {
        if (!formState) {
            return []
        }
        return matrix.filter(
            (row) => row.widthMm === formState.widthMm && row.heightMm === formState.heightMm,
        )
    }, [formState, matrix])

    const colorOptions = useMemo(() => extractOptions(rowsForSize, 'color'), [rowsForSize])

    const rowsForColor = useMemo(() => {
        if (!formState) {
            return []
        }
        return rowsForSize.filter((row) => row.color === formState.color)
    }, [formState, rowsForSize])

    const serieOptions = useMemo(() => extractOptions(rowsForColor, 'serie'), [rowsForColor])

    const rowsForSerie = useMemo(() => {
        if (!formState) {
            return []
        }
        return rowsForColor.filter((row) => row.serie === formState.serie)
    }, [formState, rowsForColor])

    const vidrioOptions = useMemo(() => extractOptions(rowsForSerie, 'vidrio'), [rowsForSerie])

    useEffect(() => {
        if (!formState) {
            return
        }
        if (!sizeOptions.some((option) => option.value === formState.sizeKey)) {
            if (sizeOptions.length) {
                const next = sizeOptions[0]
                setFormState({
                    sizeKey: next.value,
                    widthMm: next.width,
                    heightMm: next.height,
                    color: '',
                    serie: '',
                    vidrio: '',
                    mosquitero: false,
                    monoblock: false,
                })
            }
            return
        }
        const ensureValue = (current: string, options: Option[]) =>
            options.some((option) => option.value === current) && current ? current : options[0]?.value ?? ''

        const nextColor = ensureValue(formState.color, colorOptions)
        const nextSerie = ensureValue(formState.serie, serieOptions)
        const nextVidrio = ensureValue(formState.vidrio, vidrioOptions)

        if (
            nextColor !== formState.color ||
            nextSerie !== formState.serie ||
            nextVidrio !== formState.vidrio
        ) {
            setFormState((prev) =>
                prev
                    ? {
                          ...prev,
                          color: nextColor,
                          serie: nextSerie,
                          vidrio: nextVidrio,
                          mosquitero: false,
                          monoblock: false,
                      }
                    : prev,
            )
        }
    }, [colorOptions, formState, serieOptions, sizeOptions, vidrioOptions])

    const activeRow = useMemo(() => {
        if (!formState) {
            return null
        }
        return matrix.find(
            (row) =>
                row.widthMm === formState.widthMm &&
                row.heightMm === formState.heightMm &&
                row.color === formState.color &&
                row.serie === formState.serie &&
                row.vidrio === formState.vidrio,
        )
    }, [formState, matrix])

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
            const option = sizeOptions.find((item) => item.value === value)
            if (!option) {
                return
            }
            const candidates = matrix.filter(
                (row) => row.widthMm === option.width && row.heightMm === option.height,
            )
            const nextRow = candidates[0]
            setFormState(() => ({
                sizeKey: option.value,
                widthMm: option.width,
                heightMm: option.height,
                color: nextRow ? nextRow.color : '',
                serie: nextRow ? nextRow.serie : '',
                vidrio: nextRow ? nextRow.vidrio : '',
                mosquitero: false,
                monoblock: false,
            }))
            setAnalysis({ status: 'idle' })
        },
        [matrix, sizeOptions],
    )

    const handleColorChange = useCallback((value: string) => {
        setFormState((prev) =>
            prev
                ? {
                      ...prev,
                      color: value,
                      serie: '',
                      vidrio: '',
                      mosquitero: false,
                      monoblock: false,
                  }
                : prev,
        )
        setAnalysis({ status: 'idle' })
    }, [])

    const handleSerieChange = useCallback((value: string) => {
        setFormState((prev) =>
            prev
                ? {
                      ...prev,
                      serie: value,
                      vidrio: '',
                      mosquitero: false,
                      monoblock: false,
                  }
                : prev,
        )
        setAnalysis({ status: 'idle' })
    }, [])

    const handleVidrioChange = useCallback((value: string) => {
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
    }, [])

    const handleToggleChange = useCallback((field: 'mosquitero' | 'monoblock') => {
        setFormState((prev) =>
            prev
                ? {
                      ...prev,
                      [field]: !prev[field],
                  }
                : prev,
        )
        setAnalysis({ status: 'idle' })
    }, [])

    const handleCalculate = useCallback(() => {
        if (!formState) {
            return
        }
        if (!activeRow) {
            const suggestions = buildSuggestions(
                matrix,
                {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    options={products.map((product) => ({
                                        value: String(product.id),
                                        label: product.name,
                                    }))}
                                    value={selectedProductId}
                                    placeholder={t('sales.aberturasQuote.labels.productPlaceholder', {
                                        defaultValue: 'Elegí un producto',
                                    })}
                                    isDisabled={!products.length}
                                    onChange={(value) => setSelectedProductId(String(value))}
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs uppercase text-gray-500">
                                {t('sales.aberturasQuote.labels.size', {
                                    defaultValue: 'Medida (ancho × alto)',
                                })}
                            </span>
                            <Select
                                options={sizeOptions}
                                value={formState?.sizeKey ?? ''}
                                placeholder={t('sales.aberturasQuote.labels.sizePlaceholder', {
                                    defaultValue: 'Seleccioná una medida',
                                })}
                                isDisabled={!sizeOptions.length || loadingMatrix}
                                onChange={(value) => handleSizeChange(value as string)}
                            />
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
                                        value={formState.color}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.colorPlaceholder',
                                            {
                                                defaultValue: 'Seleccioná un color',
                                            },
                                        )}
                                        isDisabled={!colorOptions.length}
                                        onChange={(value) => handleColorChange(value as string)}
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
                                        value={formState.serie}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.seriePlaceholder',
                                            {
                                                defaultValue: 'Seleccioná una serie',
                                            },
                                        )}
                                        isDisabled={!serieOptions.length}
                                        onChange={(value) => handleSerieChange(value as string)}
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
                                        value={formState.vidrio}
                                        placeholder={t(
                                            'sales.aberturasQuote.labels.vidrioPlaceholder',
                                            {
                                                defaultValue: 'Seleccioná un vidrio',
                                            },
                                        )}
                                        isDisabled={!vidrioOptions.length}
                                        onChange={(value) => handleVidrioChange(value as string)}
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
                                        {!activeRow?.hasMosquiteroOption && (
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
                                        disabled={!activeRow?.hasMosquiteroOption}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium">
                                            {t('sales.aberturasQuote.labels.monoblock', {
                                                defaultValue: 'Persiana / Monoblock',
                                            })}
                                        </span>
                                        {!activeRow?.hasMonoblockOption && (
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
                                        disabled={!activeRow?.hasMonoblockOption}
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
                                <div>
                                    <Button onClick={handleCalculate}>
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
                                    {analysis.suggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.row.id}
                                            className="border border-gray-200 dark:border-gray-700 rounded-md p-3 flex flex-col gap-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-base font-semibold">
                                                    {toCurrency(suggestion.currency, suggestion.price)}
                                                </span>
                                                {suggestion.estimated && (
                                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                                        {t('sales.aberturasQuote.result.estimatedBadge', {
                                                            defaultValue: 'Estimado',
                                                        })}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {t('sales.aberturasQuote.summary.serie', {
                                                    defaultValue: 'Serie:',
                                                })}{' '}
                                                {suggestion.row.serie} ·{' '}
                                                {t('sales.aberturasQuote.summary.vidrio', {
                                                    defaultValue: 'Vidrio:',
                                                })}{' '}
                                                {suggestion.row.vidrio}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {t('sales.aberturasQuote.result.components', {
                                                    defaultValue: 'Componentes considerados: {{components}}',
                                                    components: renderComponents(suggestion.components),
                                                })}
                                            </div>
                                            {suggestion.row.referenceDate && (
                                                <div className="text-[11px] text-gray-400">
                                                    {t('sales.aberturasQuote.summary.reference', {
                                                        defaultValue: 'Fecha de referencia: {{date}}',
                                                        date:
                                                            formatReferenceDate(
                                                                suggestion.row.referenceDate,
                                                            ) ?? '-',
                                                    })}
                                                </div>
                                            )}
                                            {suggestion.row.source && (
                                                <div className="text-[11px] text-gray-400">
                                                    {t('sales.aberturasQuote.summary.source', {
                                                        defaultValue: 'Fuente: {{source}}',
                                                        source: suggestion.row.source,
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
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
