import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import InputGroup from '@/components/ui/InputGroup'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Notification from '@/components/ui/Notification'
import Alert from '@/components/ui/Alert'
import Upload from '@/components/ui/Upload'
import { toast } from '@/components/ui/toast'
import {
    apiExportParametricMatrix,
    apiGetParametricConfig,
    apiGetParametricManualConfig,
    apiImportParametricReferences,
} from '@/services/SalesService'
import { apiGetAberturasSelectors } from '@/services/SettingsService'
import { clientConfig } from '@/configs/clientConfig'
import { useAppSelector } from '@/store'
import { SUPERADMIN } from '@/constants/roles.constant'
import {
    createUrucortinasDefaultMatrixFile,
    getUrucortinasDefaultSnapshot,
} from './urucortinasParametricDefaults'
import type {
    ParametricConfiguratorDraft,
    ParametricManualConfigDraft,
    ParametricManualConfigResponse,
} from './parametricTypes'
import {
    createEmptyManualConfigDraft,
    hasManualConfigValues,
    mapDraftToManualPayload,
    mapManualConfigResponseToDraft,
} from './parametricTypes'
import {
    mapSelectorsToOptions,
    mergeSelectorValues,
    toSelectorOption,
} from '@/views/sales/parametric/selectorUtils'
import type { AberturasSelectorSummary, SelectorOption } from '@/views/sales/parametric/selectorUtils'
import isEqual from 'lodash/isEqual'

type QuoteState = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: string
    heightMm: string
    hasMosquitero: boolean
    hasShutterMonoblock: boolean
    shutterMaterial: string
}

type ManualPriceFieldKey =
    | 'priceBase'
    | 'priceMosquitero'
    | 'pricePvcShutter'
    | 'pricePvcShutterMosq'
    | 'priceAluminioShutter'
    | 'priceAluminioShutterMosq'

export type ParametricConfigSnapshot = {
    selectors: {
        families: string[]
        series: string[]
        materials?: string[]
        colors: string[]
        glass: string[]
        widths: number[]
        heights: number[]
        shutterMaterials: string[]
        hasMosquiteroOption: boolean
        hasMonoblockOption: boolean
    }
    stats: {
        rowCount: number
        minimumPrice?: number
        currency?: string
        newestReferenceDate?: string | null
        oldestReferenceDate?: string | null
    }
    compatibility: {
        glassBySeries?: Record<string, string[]>
        monoblockBySeries?: Record<string, boolean>
        sizeLimits?: Record<
            string,
            {
                minWidthMm?: number
                maxWidthMm?: number
                minHeightMm?: number
                maxHeightMm?: number
            }
        >
    }
}

export type ParametricImportSummary = {
    rowsInserted: number
    rowsUpdated: number
    warnings: string[]
}

const createDefaultState = (snapshot: ParametricConfigSnapshot): QuoteState => {
    const selectors = snapshot.selectors
    const pick = <T,>(list: T[], fallback: T): T => (list.length ? list[0] : fallback)
    const defaultShutter = selectors.shutterMaterials.find((value) => value) ?? ''
    const monoblockEnabled = Boolean(selectors.hasMonoblockOption)
    return {
        familyId: pick(selectors.families, ''),
        serie: pick(selectors.series, ''),
        color: pick(selectors.colors, ''),
        vidrio: pick(selectors.glass, ''),
        widthMm: pick(selectors.widths, 0).toString(),
        heightMm: pick(selectors.heights, 0).toString(),
        hasMosquitero: false,
        hasShutterMonoblock: false,
        shutterMaterial: monoblockEnabled ? defaultShutter : '',
    }
}

const normalizeSelectors = (
    selectors?: ParametricConfigSnapshot['selectors'] | null,
): ParametricConfigSnapshot['selectors'] => ({
    families: selectors?.families ?? [],
    series: selectors?.series ?? [],
    materials: selectors?.materials ?? [],
    colors: selectors?.colors ?? [],
    glass: selectors?.glass ?? [],
    widths: selectors?.widths ?? [],
    heights: selectors?.heights ?? [],
    shutterMaterials: selectors?.shutterMaterials ?? [],
    hasMosquiteroOption: Boolean(selectors?.hasMosquiteroOption),
    hasMonoblockOption: Boolean(selectors?.hasMonoblockOption),
})

const normalizeCompatibility = (
    compatibility?: ParametricConfigSnapshot['compatibility'] | null,
): ParametricConfigSnapshot['compatibility'] => ({
    glassBySeries: compatibility?.glassBySeries ?? {},
    monoblockBySeries: compatibility?.monoblockBySeries ?? {},
    sizeLimits: compatibility?.sizeLimits ?? {},
})

const normalizeSelectorInput = (value?: string | null): string => (value ?? '').toString().trim()

const hasManualConfigSelectors = (manual?: ParametricManualConfigDraft | null): boolean => {
    if (!manual) {
        return false
    }
    return Boolean(
        normalizeSelectorInput(manual.familyId) ||
            normalizeSelectorInput(manual.serie) ||
            normalizeSelectorInput(manual.color) ||
            normalizeSelectorInput(manual.vidrio) ||
            normalizeSelectorInput(manual.widthMm) ||
            normalizeSelectorInput(manual.heightMm),
    )
}

const mapManualConfigToQuoteState = (
    manual: ParametricManualConfigDraft,
    snapshot: ParametricConfigSnapshot,
    current?: QuoteState | null,
): QuoteState => {
    const base = current ?? createDefaultState(snapshot)
    const manualFamily = normalizeSelectorInput(manual.familyId)
    const manualSerie = normalizeSelectorInput(manual.serie)
    const manualColor = normalizeSelectorInput(manual.color)
    const manualGlass = normalizeSelectorInput(manual.vidrio)
    const manualWidth = normalizeSelectorInput(manual.widthMm)
    const manualHeight = normalizeSelectorInput(manual.heightMm)
    return {
        ...base,
        familyId: manualFamily || base.familyId,
        serie: manualSerie || base.serie,
        color: manualColor || base.color,
        vidrio: manualGlass || base.vidrio,
        widthMm: manualWidth || base.widthMm,
        heightMm: manualHeight || base.heightMm,
        hasMosquitero: manual.hasMosquitero ?? base.hasMosquitero,
        hasShutterMonoblock: manual.hasMonoblock ?? base.hasShutterMonoblock,
        shutterMaterial: manual.hasMonoblock ? base.shutterMaterial : '',
    }
}

const quoteStateMatchesManualConfig = (
    quoteState: QuoteState | null,
    manual?: ParametricManualConfigDraft | null,
): boolean => {
    if (!quoteState || !manual) {
        return false
    }
    const manualFamily = normalizeSelectorInput(manual.familyId)
    const manualSerie = normalizeSelectorInput(manual.serie)
    const manualColor = normalizeSelectorInput(manual.color)
    const manualGlass = normalizeSelectorInput(manual.vidrio)
    const manualWidth = normalizeSelectorInput(manual.widthMm)
    const manualHeight = normalizeSelectorInput(manual.heightMm)
    return (
        manualFamily === normalizeSelectorInput(quoteState.familyId) &&
        manualSerie === normalizeSelectorInput(quoteState.serie) &&
        manualColor === normalizeSelectorInput(quoteState.color) &&
        manualGlass === normalizeSelectorInput(quoteState.vidrio) &&
        manualWidth === normalizeSelectorInput(quoteState.widthMm) &&
        manualHeight === normalizeSelectorInput(quoteState.heightMm) &&
        Boolean(manual.hasMosquitero) === Boolean(quoteState.hasMosquitero) &&
        Boolean(manual.hasMonoblock) === Boolean(quoteState.hasShutterMonoblock)
    )
}

type ParametricConfiguratorProps = {
    productId?: number | null
    currency: string
    draft?: ParametricConfiguratorDraft | null
    onDraftChange?: (draft: ParametricConfiguratorDraft | null) => void
}

const ParametricConfigurator = ({ productId, currency, draft, onDraftChange }: ParametricConfiguratorProps) => {
    const { t } = useTranslation()
    const isUrucortinas = clientConfig.slug === 'urucortinas'

    const userAuthority = useAppSelector((state) => state.auth.user?.authority ?? [])
    const isSuperAdmin = userAuthority.includes(SUPERADMIN)

    const numericProductId = Number(productId ?? 0)
    const hasProductId = Number.isFinite(numericProductId) && numericProductId > 0
    const isDraftMode = !hasProductId
    const [loadingConfig, setLoadingConfig] = useState(false)
    const [configSnapshot, setConfigSnapshot] = useState<ParametricConfigSnapshot | null>(null)
    const [quoteState, setQuoteState] = useState<QuoteState | null>(null)
    const [quoteStateReady, setQuoteStateReady] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importSummary, setImportSummary] = useState<ParametricImportSummary | null>(null)
    const [configError, setConfigError] = useState<string | null>(null)
    const [draftInfo, setDraftInfo] = useState<ParametricConfiguratorDraft>(() => draft ?? {})
    const [showAdminTools, setShowAdminTools] = useState(false)
    const [selectorSummary, setSelectorSummary] = useState<AberturasSelectorSummary | null>(null)
    const [manualLoading, setManualLoading] = useState(false)
    const lastSyncedDraftRef = useRef<ParametricConfiguratorDraft | null>(draft ?? null)
    const manualConfig = useMemo(
        () => draftInfo.manualConfig ?? createEmptyManualConfigDraft(),
        [draftInfo.manualConfig],
    )

    const updateManualConfig = useCallback(
        (updater: (current: ParametricManualConfigDraft) => ParametricManualConfigDraft) => {
            setDraftInfo((prev) => {
                const currentConfig = prev.manualConfig ?? createEmptyManualConfigDraft()
                const nextConfig = updater(currentConfig)
                if (nextConfig === currentConfig) {
                    return prev
                }
                return { ...prev, manualConfig: nextConfig }
            })
        },
        [],
    )

    useEffect(() => {
        if (draft) {
            if (draft.manualConfig) {
                setDraftInfo(draft)
            } else {
                setDraftInfo({ ...draft, manualConfig: createEmptyManualConfigDraft() })
            }
        } else {
            setDraftInfo({ manualConfig: createEmptyManualConfigDraft() })
        }
        lastSyncedDraftRef.current = draft ?? null
    }, [draft])

    useEffect(() => {
        if (!hasProductId) {
            setManualLoading(false)
            return
        }
        let cancelled = false
        const fetchManualConfig = async () => {
            if (isSuperAdmin) {
                setManualLoading(true)
            }
            try {
                const response = await apiGetParametricManualConfig<ParametricManualConfigResponse | null>(
                    numericProductId,
                )
                if (cancelled) {
                    return
                }
                const snapshot = (response?.data ?? response ?? null) as ParametricManualConfigResponse | null
                setDraftInfo((prev) => {
                    const manualDraft = snapshot ? mapManualConfigResponseToDraft(snapshot) : createEmptyManualConfigDraft()
                    return { ...prev, manualConfig: manualDraft }
                })
            } catch (error) {
                if (!cancelled) {
                    console.error('[parametric] manual config fetch failed', error)
                }
            } finally {
                if (!cancelled && isSuperAdmin) {
                    setManualLoading(false)
                }
            }
        }
        fetchManualConfig()
        return () => {
            cancelled = true
        }
    }, [hasProductId, isSuperAdmin, numericProductId])

    useEffect(() => {
        if (!isSuperAdmin) {
            setShowAdminTools(false)
        }
    }, [isSuperAdmin])

    useEffect(() => {
        if (!quoteState || !quoteStateReady) {
            return
        }
        updateManualConfig((current) => {
            const patch: ParametricManualConfigDraft = {
                ...current,
                familyId: quoteState.familyId,
                serie: quoteState.serie,
                color: quoteState.color,
                vidrio: quoteState.vidrio,
                widthMm: quoteState.widthMm,
                heightMm: quoteState.heightMm,
                hasMosquitero: quoteState.hasMosquitero,
                hasMonoblock: quoteState.hasShutterMonoblock,
            }
            const differs =
                current.familyId !== patch.familyId ||
                current.serie !== patch.serie ||
                current.color !== patch.color ||
                current.vidrio !== patch.vidrio ||
                current.widthMm !== patch.widthMm ||
                current.heightMm !== patch.heightMm ||
                current.hasMosquitero !== patch.hasMosquitero ||
                current.hasMonoblock !== patch.hasMonoblock
            return differs ? patch : current
        })
    }, [quoteState, quoteStateReady, updateManualConfig])

    const matrixReferenceInfo = useMemo(() => {
        const latest = configSnapshot?.stats?.newestReferenceDate
        if (!latest) {
            return null
        }
        const latestDate = new Date(latest)
        if (Number.isNaN(latestDate.getTime())) {
            return null
        }
        const oldestRaw = configSnapshot?.stats?.oldestReferenceDate
        let oldestFormatted: string | null = null
        if (oldestRaw) {
            const parsed = new Date(oldestRaw)
            if (!Number.isNaN(parsed.getTime())) {
                oldestFormatted = parsed.toLocaleDateString()
            }
        }
        return {
            newest: latestDate.toLocaleDateString(),
            oldest: oldestFormatted,
        }
    }, [configSnapshot?.stats?.newestReferenceDate, configSnapshot?.stats?.oldestReferenceDate])

    const fetchAberturasSelectors = useCallback(async (): Promise<AberturasSelectorSummary | null> => {
        try {
            const response = await apiGetAberturasSelectors<AberturasSelectorSummary>()
            const summary = (response?.data ?? response ?? null) as AberturasSelectorSummary | null
            if (summary) {
                setSelectorSummary(summary)
            }
            return summary
        } catch (error) {
            console.error('[aberturas] failed to load selectors', error)
            return null
        }
    }, [])

    const applySummaryToSnapshot = useCallback(
        (snapshot: ParametricConfigSnapshot, summary?: AberturasSelectorSummary | null) => {
            const normalizedSelectors = normalizeSelectors(snapshot?.selectors)
            const normalizedCompatibility = normalizeCompatibility(snapshot?.compatibility)
            const selectorsWithSummary = summary
                ? {
                      ...normalizedSelectors,
                      families: mergeSelectorValues(normalizedSelectors.families, summary.families),
                      series: mergeSelectorValues(normalizedSelectors.series, summary.series),
                      colors: mergeSelectorValues(normalizedSelectors.colors, summary.colors),
                      glass: mergeSelectorValues(normalizedSelectors.glass, summary.glass),
                  }
                : normalizedSelectors
            return {
                ...snapshot,
                selectors: selectorsWithSummary,
                compatibility: normalizedCompatibility,
            }
        },
        [],
    )

    const buildSnapshotFromSummary = useCallback(
        (summary: AberturasSelectorSummary): ParametricConfigSnapshot => {
            const selectorsSnapshot: ParametricConfigSnapshot['selectors'] = {
                families: summary.families,
                series: summary.series,
                materials: ['ALUMINIO'],
                colors: summary.colors,
                glass: summary.glass,
                widths: [],
                heights: [],
                shutterMaterials: ['PVC', 'ALUMINIO'],
                hasMosquiteroOption: true,
                hasMonoblockOption: true,
            }
            const compatibility: ParametricConfigSnapshot['compatibility'] = {
                glassBySeries: summary.series.reduce<Record<string, string[]>>((acc, serie) => {
                    acc[serie] = summary.glass.length ? summary.glass : selectorsSnapshot.glass
                    return acc
                }, {}),
                monoblockBySeries: summary.series.reduce<Record<string, boolean>>((acc, serie) => {
                    acc[serie] = true
                    return acc
                }, {}),
            }
            return {
                selectors: selectorsSnapshot,
                stats: {
                    rowCount: 0,
                    minimumPrice: undefined,
                    currency: undefined,
                    newestReferenceDate: null,
                    oldestReferenceDate: null,
                },
                compatibility,
            }
        },
        [],
    )

    useEffect(() => {
        if (!isUrucortinas || selectorSummary) {
            return
        }
        fetchAberturasSelectors()
    }, [fetchAberturasSelectors, isUrucortinas, selectorSummary])

    const fetchConfig = useCallback(async () => {
        if (!hasProductId) {
            return
        }
        setLoadingConfig(true)
        setConfigError(null)
        try {
            const response = await apiGetParametricConfig<ParametricConfigSnapshot>(numericProductId)
            const snapshot = response as unknown as ParametricConfigSnapshot
            const summary = selectorSummary ?? (await fetchAberturasSelectors())
            const enriched = applySummaryToSnapshot(snapshot, summary)
            setConfigSnapshot(enriched)
            setQuoteStateReady(false)
            setQuoteState((prev) => prev ?? createDefaultState(enriched))
        } catch (error) {
            console.error('[parametric] failed to load configuration', error)
            setConfigError(
                t('sales.productForm.parametric.configLoadError', {
                    defaultValue: 'Unable to load parametric configuration for this product.',
                }),
            )
            setConfigSnapshot(null)
            setQuoteState(null)
            setQuoteStateReady(false)
        } finally {
            setLoadingConfig(false)
        }
    }, [applySummaryToSnapshot, fetchAberturasSelectors, hasProductId, numericProductId, selectorSummary, t])

    useEffect(() => {
        if (!isUrucortinas || !isDraftMode || draftInfo.matrixFile) {
            return
        }
        const file = createUrucortinasDefaultMatrixFile()
        if (!file) {
            return
        }
        setDraftInfo((prev) => {
            if (prev.matrixFile) {
                return prev
            }
            const payload = { ...prev, matrixFile: file }
            return payload
        })
    }, [draftInfo.matrixFile, isDraftMode, isUrucortinas])

    useEffect(() => {
        if (!isUrucortinas || hasProductId) {
            return
        }
        let mounted = true
        const initializeDefaults = async () => {
            setLoadingConfig(true)
            const summary = selectorSummary ?? (await fetchAberturasSelectors())
            const snapshot = summary ? buildSnapshotFromSummary(summary) : getUrucortinasDefaultSnapshot()
            if (!mounted) {
                return
            }
            setConfigSnapshot(snapshot)
            setQuoteStateReady(false)
            setQuoteState((prev) => prev ?? createDefaultState(snapshot))
            setLoadingConfig(false)
        }
        initializeDefaults()
        return () => {
            mounted = false
        }
    }, [buildSnapshotFromSummary, fetchAberturasSelectors, hasProductId, isUrucortinas, selectorSummary])

    useEffect(() => {
        if (!onDraftChange) {
            return
        }
        if (isEqual(lastSyncedDraftRef.current, draftInfo)) {
            return
        }
        lastSyncedDraftRef.current = draftInfo
        onDraftChange(draftInfo)
    }, [draftInfo, onDraftChange])

    useEffect(() => {
        if (!configSnapshot) {
            return
        }
        const manual = draftInfo.manualConfig
        if (hasManualConfigSelectors(manual)) {
            if (!quoteState || !quoteStateMatchesManualConfig(quoteState, manual)) {
                setQuoteStateReady(false)
                setQuoteState((prev) => mapManualConfigToQuoteState(manual, configSnapshot, prev))
            } else if (!quoteStateReady) {
                setQuoteStateReady(true)
            }
            return
        }
        if (!quoteState) {
            setQuoteState((prev) => prev ?? createDefaultState(configSnapshot))
            return
        }
        if (!quoteStateReady) {
            setQuoteStateReady(true)
        }
    }, [configSnapshot, draftInfo.manualConfig, quoteState, quoteStateReady])

    const selectors = configSnapshot?.selectors

    const defaultShutterMaterial = useMemo(
        () => selectors?.shutterMaterials?.find((value) => value) ?? '',
        [selectors?.shutterMaterials],
    )

    const monoblockAllowed = useMemo(() => {
        if (!selectors?.hasMonoblockOption) {
            return false
        }
        if (!quoteState) {
            return true
        }
        const compatibilityFlag = configSnapshot?.compatibility.monoblockBySeries?.[quoteState.serie]
        if (compatibilityFlag === false) {
            return false
        }
        return true
    }, [configSnapshot, quoteState, selectors?.hasMonoblockOption])

    const mosquitoToggleDisabled = !(selectors?.hasMosquiteroOption ?? false)

    useEffect(() => {
        if (!hasProductId) {
            return
        }
        fetchConfig()
    }, [fetchConfig, hasProductId])

    useEffect(() => {
        if (!quoteState || !configSnapshot) {
            return
        }
        const allowedGlass = configSnapshot.compatibility.glassBySeries?.[quoteState.serie]
        if (allowedGlass && allowedGlass.length && !allowedGlass.includes(quoteState.vidrio)) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          vidrio: allowedGlass[0],
                      }
                    : prev,
            )
        }
    }, [configSnapshot, quoteState])

    useEffect(() => {
        if (!quoteState || !configSnapshot?.selectors) {
            return
        }
        if (!configSnapshot.selectors.hasMonoblockOption && quoteState.hasShutterMonoblock) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          hasShutterMonoblock: false,
                          shutterMaterial: '',
                      }
                    : prev,
            )
            return
        }
        const allowedBySeries = configSnapshot.compatibility.monoblockBySeries?.[quoteState.serie]
        if (allowedBySeries === false && quoteState.hasShutterMonoblock) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          hasShutterMonoblock: false,
                          shutterMaterial: '',
                      }
                    : prev,
            )
        }
    }, [configSnapshot, quoteState])

    useEffect(() => {
        if (!quoteState || !configSnapshot?.selectors) {
            return
        }
        if (!configSnapshot.selectors.hasMosquiteroOption && quoteState.hasMosquitero) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          hasMosquitero: false,
                      }
                    : prev,
            )
        }
    }, [configSnapshot, quoteState])

    useEffect(() => {
        if (!quoteState) {
            return
        }
        if (!monoblockAllowed && quoteState.hasShutterMonoblock) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          hasShutterMonoblock: false,
                          shutterMaterial: '',
                      }
                    : prev,
            )
            return
        }
        if (quoteState.hasShutterMonoblock && !quoteState.shutterMaterial && defaultShutterMaterial) {
            setQuoteState((prev) =>
                prev
                    ? {
                          ...prev,
                          shutterMaterial: defaultShutterMaterial,
                      }
                    : prev,
            )
        }
    }, [defaultShutterMaterial, monoblockAllowed, quoteState])

    const handleSelectChange = (field: keyof QuoteState) => (value: string) => {
        setQuoteState((prev) => (prev ? { ...prev, [field]: value } : prev))
    }

    const handleToggleChange = (field: keyof QuoteState) => (checked: boolean) => {
        setQuoteState((prev) => (prev ? { ...prev, [field]: checked } : prev))
    }

    const handleMonoblockToggle = useCallback(
        (checked: boolean) => {
            if (!monoblockAllowed && checked) {
                return
            }
            setQuoteState((prev) =>
                prev
                    ? checked
                        ? {
                              ...prev,
                              hasShutterMonoblock: true,
                              shutterMaterial: prev.shutterMaterial || defaultShutterMaterial || '',
                          }
                        : {
                              ...prev,
                              hasShutterMonoblock: false,
                              shutterMaterial: '',
                          }
                    : prev,
            )
        },
        [defaultShutterMaterial, monoblockAllowed],
    )


    const handleFileUpload = useCallback(
        async (files: File[]) => {
            if (!files.length) {
                return
            }
            const file = files[0]
            if (!hasProductId) {
                const draftPayload: ParametricConfiguratorDraft = {
                    ...draftInfo,
                    matrixFile: file,
                    manualConfig,
                }
                setDraftInfo(draftPayload)
                setImportSummary(null)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.importQueued', {
                            defaultValue: 'Matriz pendiente',
                        })}
                        type="info"
                    >
                        {t('sales.productForm.parametric.importQueuedDescription', {
                            defaultValue: 'Se importará automáticamente después de guardar el producto.',
                        })}
                    </Notification>,
                )
                return
            }
            const formData = new FormData()
            formData.append('file', file)
            setImporting(true)
            try {
                const response = await apiImportParametricReferences<ParametricImportSummary>(numericProductId, formData)
                const summary = (response?.data ?? response) as ParametricImportSummary
                setImportSummary(summary)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.importSuccess', {
                            defaultValue: 'Matrix imported successfully',
                        })}
                        type="success"
                    >
                        {t('sales.productForm.parametric.importSummary', {
                            defaultValue: 'Processed {{inserted}} new · {{updated}} updated.',
                            inserted: summary.rowsInserted,
                            updated: summary.rowsUpdated,
                        })}
                    </Notification>,
                )
                await fetchConfig()
            } catch (error) {
                console.error('[parametric] import failed', error)
                setImportSummary(null)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.importError', { defaultValue: 'Import failed' })}
                        type="danger"
                    >
                        {t('sales.productForm.parametric.importErrorDescription', {
                            defaultValue: 'Please verify the file format and try again.',
                        })}
                    </Notification>,
                )
            } finally {
                setImporting(false)
            }
        },
        [fetchConfig, hasProductId, numericProductId, t],
    )

    const handleExport = useCallback(async () => {
        if (!hasProductId) {
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.exportUnavailable', {
                        defaultValue: 'Exportación no disponible',
                    })}
                    type="warning"
                >
                    {t('sales.productForm.parametric.exportUnavailableDescription', {
                        defaultValue: 'Guardá el producto y cargá una matriz antes de exportar.',
                    })}
                </Notification>,
            )
            return
        }
        try {
            const response = await apiExportParametricMatrix(numericProductId)
            const data = response?.data ?? response
            const blob =
                data instanceof Blob
                    ? data
                    : new Blob([data], {
                          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `parametric-matrix-${numericProductId}.xlsx`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('[parametric] export failed', error)
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.exportError', { defaultValue: 'Export failed' })}
                    type="danger"
                >
                    {t('sales.productForm.parametric.exportErrorDescription', {
                        defaultValue: 'We could not export the current matrix. Please try again later.',
                    })}
                </Notification>,
            )
        }
    }, [hasProductId, numericProductId, t])

    const selectorOptionGroups = useMemo(() => {
        const baseGroups = mapSelectorsToOptions(selectors, t)
        const ensureOption = (list: SelectorOption[], value?: string | null) => {
            if (!value) {
                return list
            }
            const normalized = normalizeSelectorInput(value)
            if (!normalized) {
                return list
            }
            if (list.some((option) => option.value === normalized)) {
                return list
            }
            return [...list, toSelectorOption(normalized, value)]
        }
        const manual = draftInfo.manualConfig
        let families = baseGroups.families
        let series = baseGroups.series
        let colors = baseGroups.colors
        let glass = baseGroups.glass
        const familyCandidates = [manual?.familyId, quoteState?.familyId]
        const seriesCandidates = [manual?.serie, quoteState?.serie]
        const colorCandidates = [manual?.color, quoteState?.color]
        const glassCandidates = [manual?.vidrio, quoteState?.vidrio]
        familyCandidates.forEach((value) => {
            families = ensureOption(families, value)
        })
        seriesCandidates.forEach((value) => {
            series = ensureOption(series, value)
        })
        colorCandidates.forEach((value) => {
            colors = ensureOption(colors, value)
        })
        glassCandidates.forEach((value) => {
            glass = ensureOption(glass, value)
        })
        return {
            families,
            series,
            colors,
            glass,
            shutterMaterials: baseGroups.shutterMaterials,
        }
    }, [
        draftInfo.manualConfig,
        quoteState?.color,
        quoteState?.familyId,
        quoteState?.serie,
        quoteState?.vidrio,
        selectors,
        t,
    ])

    const glassOptions = useMemo(() => {
        if (!selectors || !quoteState) return []
        const allowed = configSnapshot?.compatibility.glassBySeries?.[quoteState.serie]
        let list = selectors.glass.filter((item) => !allowed || !allowed.length || allowed.includes(item))
        if (quoteState.vidrio && !list.includes(quoteState.vidrio)) {
            list = [...list, quoteState.vidrio]
        }
        return list.map((value) => toSelectorOption(value))
    }, [configSnapshot, quoteState, selectors])

    const familyOptions = selectorOptionGroups.families
    const serieOptions = selectorOptionGroups.series
    const colorOptions = selectorOptionGroups.colors
    const shutterMaterialOptions = selectorOptionGroups.shutterMaterials

    const selectedFamilyOption = useMemo(
        () => familyOptions.find((option) => option.value === normalizeSelectorInput(quoteState?.familyId)) ?? null,
        [familyOptions, quoteState?.familyId],
    )
    const selectedSerieOption = useMemo(
        () => serieOptions.find((option) => option.value === normalizeSelectorInput(quoteState?.serie)) ?? null,
        [quoteState?.serie, serieOptions],
    )
    const selectedColorOption = useMemo(
        () => colorOptions.find((option) => option.value === normalizeSelectorInput(quoteState?.color)) ?? null,
        [colorOptions, quoteState?.color],
    )
    const selectedGlassOption = useMemo(
        () => glassOptions.find((option) => option.value === normalizeSelectorInput(quoteState?.vidrio)) ?? null,
        [glassOptions, quoteState?.vidrio],
    )
    const selectedShutterMaterial = useMemo(
        () =>
            shutterMaterialOptions.find(
                (option) => option.value === normalizeSelectorInput(quoteState?.shutterMaterial),
            ) ?? null,
        [quoteState?.shutterMaterial, shutterMaterialOptions],
    )
    const manualPriceFields = useMemo(
        () => [
            {
                key: 'priceBase' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.baseLabel', {
                    defaultValue: 'Base cost (no mosquito net / shutter)',
                }),
                description: t('sales.productForm.parametric.manualPrice.baseDescription', {
                    defaultValue: 'Total cost without mosquito net or shutters.',
                }),
            },
            {
                key: 'priceMosquitero' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.mosquiteroLabel', {
                    defaultValue: 'Cost with mosquito net',
                }),
                description: t('sales.productForm.parametric.manualPrice.mosquiteroDescription', {
                    defaultValue: 'Cost of the same opening adding only the mosquito net.',
                }),
            },
            {
                key: 'pricePvcShutter' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.pvcLabel', {
                    defaultValue: 'Cost with PVC shutter',
                }),
                description: t('sales.productForm.parametric.manualPrice.pvcDescription', {
                    defaultValue: 'Mosquito net disabled. Includes the PVC shutter.',
                }),
            },
            {
                key: 'pricePvcShutterMosq' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.pvcMosqLabel', {
                    defaultValue: 'Cost with PVC shutter + mosquito net',
                }),
                description: t('sales.productForm.parametric.manualPrice.pvcMosqDescription', {
                    defaultValue: 'Full combo: PVC shutter plus mosquito net.',
                }),
            },
            {
                key: 'priceAluminioShutter' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.aluLabel', {
                    defaultValue: 'Cost with aluminium shutter',
                }),
                description: t('sales.productForm.parametric.manualPrice.aluDescription', {
                    defaultValue: 'Mosquito net disabled. Includes the aluminium shutter.',
                }),
            },
            {
                key: 'priceAluminioShutterMosq' as ManualPriceFieldKey,
                label: t('sales.productForm.parametric.manualPrice.aluMosqLabel', {
                    defaultValue: 'Cost with aluminium shutter + mosquito net',
                }),
                description: t('sales.productForm.parametric.manualPrice.aluMosqDescription', {
                    defaultValue: 'Full combo: aluminium shutter plus mosquito net.',
                }),
            },
        ],
        [t],
    )
    const hasManualValues = hasManualConfigValues(draftInfo.manualConfig)
    const manualCurrency = currency || 'USD'
    const manualPayloadPreview = useMemo(
        () => mapDraftToManualPayload(manualConfig, manualCurrency),
        [manualConfig, manualCurrency],
    )
    const manualInputsDisabled = manualLoading
    const handleManualPriceChange = useCallback(
        (field: ManualPriceFieldKey, value: string) => {
            updateManualConfig((current) => {
                if (current[field] === value) {
                    return current
                }
                return { ...current, [field]: value }
            })
        },
        [updateManualConfig],
    )

    if (!isUrucortinas) {
        return (
            <AdaptableCard className="mb-4">
                <Alert type="info" showIcon>
                    {t('sales.productForm.parametric.notAvailableForClient', {
                        defaultValue: 'La configuración paramétrica está disponible solo para Urucortinas.',
                    })}
                </Alert>
            </AdaptableCard>
        )
    }

    return (
        <AdaptableCard className="mb-4">
            <div className="flex flex-col gap-4">
                {isSuperAdmin && (
                    <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/40 flex flex-col gap-3">
                        <div>
                            <h5 className="mb-1 font-semibold">
                                {t('sales.productForm.parametric.adminPanelTitle', {
                                    defaultValue: 'Parametric tools',
                                })}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t('sales.productForm.parametric.adminPanelDescription', {
                                    defaultValue:
                                        'Manage the openings price matrix and its defaults. Only super-admins can edit these settings.',
                                })}
                            </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-700 dark:text-gray-200">
                                {t('sales.productForm.parametric.adminToggleLabel', {
                                    defaultValue: 'Show advanced tools',
                                })}
                            </span>
                            <Switcher checked={showAdminTools} onChange={(checked) => setShowAdminTools(checked)} />
                        </div>
                    </div>
                )}

                {isSuperAdmin && showAdminTools && (
                    <>
                        <div>
                            <h5 className="mb-1 flex items-center gap-2">
                                {t('sales.productForm.parametric.title', { defaultValue: 'Parametric pricing' })}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t('sales.productForm.parametric.subtitle', {
                                    defaultValue: 'Upload a price matrix and simulate quotes for configurable products.',
                                })}
                            </p>
                            {isDraftMode && !draftInfo.matrixFile && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                    {t('sales.productForm.parametric.requiresProductDetail', {
                                        defaultValue:
                                            'Save the product first to import price matrices or run simulations.',
                                    })}
                                </p>
                            )}
                            {isDraftMode && draftInfo.matrixFile && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                                    {t('sales.productForm.parametric.pendingDraft', {
                                        defaultValue: 'Archivo listo para importar: {{name}}',
                                        name:
                                            draftInfo.matrixFile instanceof File
                                                ? draftInfo.matrixFile.name
                                                : 'parametric-matrix.csv',
                                    })}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-md px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                            <div>
                                {hasProductId && configSnapshot ? (
                                    <>
                                        <h6 className="text-sm font-semibold">
                                            {t('sales.productForm.parametric.matrixSummary', { defaultValue: 'Matrix summary' })}
                                        </h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            {t('sales.productForm.parametric.matrixStats', {
                                                defaultValue: '{{rows}} rows · From {{price}} {{currency}}',
                                                rows: configSnapshot.stats.rowCount,
                                                price:
                                                    configSnapshot.stats.minimumPrice !== undefined
                                                        ? configSnapshot.stats.minimumPrice.toFixed(2)
                                                        : '—',
                                                currency: configSnapshot.stats.currency ?? currency,
                                            })}
                                        </p>
                                        {matrixReferenceInfo && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {matrixReferenceInfo.oldest
                                                    ? t('sales.productForm.parametric.matrixReferenceRange', {
                                                          defaultValue: 'Reference dates between {{oldest}} and {{latest}}.',
                                                          oldest: matrixReferenceInfo.oldest,
                                                          latest: matrixReferenceInfo.newest,
                                                      })
                                                    : t('sales.productForm.parametric.matrixReferenceLatest', {
                                                          defaultValue: 'Latest price reference: {{latest}}.',
                                                          latest: matrixReferenceInfo.newest,
                                                      })}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-600 dark:text-gray-300">
                                        {t('sales.productForm.parametric.matrixEmpty', {
                                            defaultValue: 'No price matrix imported yet.',
                                        })}
                                    </p>
                                )}
                                {isDraftMode && isUrucortinas && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                        {t('sales.productForm.parametric.defaultMatrixNote', {
                                            defaultValue:
                                                'The openings matrix will be imported automatically once you save the product.',
                                        })}
                                    </p>
                                )}
                                {!configSnapshot && draftInfo.matrixFile && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                        {t('sales.productForm.parametric.matrixDraftPending', {
                                            defaultValue: 'Archivo pendiente: {{name}}',
                                            name:
                                                draftInfo.matrixFile instanceof File
                                                    ? draftInfo.matrixFile.name
                                                    : 'parametric-matrix.csv',
                                        })}
                                    </p>
                                )}
                                {importSummary && hasProductId && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                                        {t('sales.productForm.parametric.importResults', {
                                            defaultValue: 'Last import: {{inserted}} new · {{updated}} updated rows.',
                                            inserted: importSummary.rowsInserted,
                                            updated: importSummary.rowsUpdated,
                                        })}
                                    </p>
                                )}
                            </div>
                            {hasProductId && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="plain"
                                        size="sm"
                                        disabled={loadingConfig || !configSnapshot?.stats?.rowCount}
                                        onClick={handleExport}
                                    >
                                        {t('sales.productForm.parametric.export', { defaultValue: 'Export matrix' })}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-start">
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    {t('sales.productForm.parametric.uploadLabel', { defaultValue: 'Matrix file' })}
                                </span>
                                <Upload
                                    accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    multiple={false}
                                    uploadLimit={1}
                                    showList={false}
                                    disabled={loadingConfig || importing}
                                    onChange={handleFileUpload}
                                    onFileRemove={() => {
                                        if (!hasProductId) {
                                            setDraftInfo((prev) => {
                                                if (!prev.matrixFile) {
                                                    return prev
                                                }
                                                const nextDraft: ParametricConfiguratorDraft = {
                                                    ...prev,
                                                }
                                                delete nextDraft.matrixFile
                                                return nextDraft
                                            })
                                        }
                                    }}
                                >
                                    <Button size="sm" variant="solid" loading={importing} disabled={loadingConfig || importing}>
                                        {t('sales.productForm.parametric.import', {
                                            defaultValue: hasProductId ? 'Import matrix' : 'Attach matrix',
                                        })}
                                    </Button>
                                </Upload>
                            </div>
                        </div>
                    </>
                )}

                {configError && (
                    <Alert type="danger" showIcon>
                        {configError}
                    </Alert>
                )}

                {quoteState && selectors && (
                    <div className="flex flex-col gap-4">
                        <h6 className="font-semibold text-sm">
                            {t('sales.productForm.parametric.configuration', { defaultValue: 'Configuration' })}
                        </h6>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            <Select
                                options={familyOptions}
                                value={selectedFamilyOption}
                                placeholder={t('sales.productForm.parametric.family', { defaultValue: 'Family' })}
                                onChange={(option) =>
                                    handleSelectChange('familyId')((option as SelectorOption | null)?.value ?? '')
                                }
                                isDisabled={(!hasProductId && !isUrucortinas) || !familyOptions.length}
                            />
                            <Select
                                options={serieOptions}
                                value={selectedSerieOption}
                                placeholder={t('sales.productForm.parametric.series', { defaultValue: 'Series' })}
                                onChange={(option) =>
                                    handleSelectChange('serie')((option as SelectorOption | null)?.value ?? '')
                                }
                                isDisabled={(!hasProductId && !isUrucortinas) || !serieOptions.length}
                            />
                            <Select
                                options={colorOptions}
                                value={selectedColorOption}
                                placeholder={t('sales.productForm.parametric.color', { defaultValue: 'Color' })}
                                onChange={(option) =>
                                    handleSelectChange('color')((option as SelectorOption | null)?.value ?? '')
                                }
                                isDisabled={(!hasProductId && !isUrucortinas) || !colorOptions.length}
                            />
                            <Select
                                options={glassOptions}
                                value={selectedGlassOption}
                                placeholder={t('sales.productForm.parametric.glass', { defaultValue: 'Glass' })}
                                onChange={(option) =>
                                    handleSelectChange('vidrio')((option as SelectorOption | null)?.value ?? '')
                                }
                                isDisabled={(!hasProductId && !isUrucortinas) || !glassOptions.length}
                            />
                            <Input
                                type="number"
                                value={quoteState.widthMm}
                                placeholder={t('sales.productForm.parametric.width', { defaultValue: 'Width (mm)' })}
                                onChange={(event) => handleSelectChange('widthMm')(event.target.value)}
                                disabled={!hasProductId && !isUrucortinas}
                            />
                            <Input
                                type="number"
                                value={quoteState.heightMm}
                                placeholder={t('sales.productForm.parametric.height', { defaultValue: 'Height (mm)' })}
                                onChange={(event) => handleSelectChange('heightMm')(event.target.value)}
                                disabled={!hasProductId && !isUrucortinas}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="border rounded-md p-3 flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {t('sales.productForm.parametric.mosquitoNet', {
                                        defaultValue: 'Mosquito net',
                                    })}
                                </span>
                                <Switcher
                                    checked={quoteState.hasMosquitero}
                                    onChange={(checked) => handleToggleChange('hasMosquitero')(checked)}
                                    disabled={(!hasProductId && !isUrucortinas) || mosquitoToggleDisabled}
                                />
                            </div>
                            <div className="border rounded-md p-3 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                        {t('sales.productForm.parametric.monoblock', { defaultValue: 'Monoblock' })}
                                    </span>
                                    <Switcher
                                        checked={quoteState.hasShutterMonoblock}
                                        onChange={handleMonoblockToggle}
                                        disabled={(!hasProductId && !isUrucortinas) || !monoblockAllowed}
                                    />
                                </div>
                                {quoteState.hasShutterMonoblock && (
                                    <Select
                                        options={shutterMaterialOptions}
                                        value={selectedShutterMaterial}
                                        placeholder={t('sales.productForm.parametric.shutterMaterial', {
                                            defaultValue: 'Shutter material',
                                        })}
                                        onChange={(option) =>
                                            handleSelectChange('shutterMaterial')(
                                                (option as SelectorOption | null)?.value ?? '',
                                            )
                                        }
                                        isDisabled={(!hasProductId && !isUrucortinas) || !shutterMaterialOptions.length}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="border rounded-md p-4 space-y-3 bg-white dark:bg-transparent">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-col gap-1">
                                        <h6 className="text-sm font-semibold">
                                            {t('sales.productForm.parametric.manualSection.title', {
                                                defaultValue: 'Manual pricing',
                                            })}
                                        </h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            {t('sales.productForm.parametric.manualSection.description', {
                                                defaultValue:
                                                    'Use these costs to replicate the CSV matrix for this product without uploading a file.',
                                            })}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('sales.productForm.parametric.manualSection.note', {
                                                defaultValue:
                                                    'Values are stored as costs in {{currency}}. The global margin is applied to calculate the sale price.',
                                                currency: manualCurrency,
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {draftInfo.matrixFile && (
                                <Alert type="warning" showIcon>
                                    {t('sales.productForm.parametric.manualSection.uploadWarning', {
                                        defaultValue:
                                            'If you attach or import a matrix file, these manual values will be ignored.',
                                    })}
                                </Alert>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {manualPriceFields.map((field) => (
                                    <div key={field.key} className="flex flex-col gap-2">
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                            {field.label}
                                        </div>
                                        <InputGroup>
                                            <InputGroup.Addon className="font-semibold text-xs uppercase">
                                                {manualCurrency}
                                            </InputGroup.Addon>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={manualConfig[field.key]}
                                                placeholder="0.00"
                                                disabled={manualInputsDisabled}
                                                onChange={(event) => handleManualPriceChange(field.key, event.target.value)}
                                            />
                                        </InputGroup>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {hasManualValues
                                    ? t('sales.productForm.parametric.manualSection.summary', {
                                          defaultValue: 'Manual costs ready to import.',
                                      })
                                    : t('sales.productForm.parametric.manualSection.empty', {
                                          defaultValue: 'Add the costs for this configuration to build the parametric matrix.',
                                      })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdaptableCard>
    )
}

export default ParametricConfigurator
