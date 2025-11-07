import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Notification from '@/components/ui/Notification'
import Alert from '@/components/ui/Alert'
import Upload from '@/components/ui/Upload'
import { toast } from '@/components/ui/toast'
import { apiExportParametricMatrix, apiGetParametricConfig, apiImportParametricReferences, apiQuoteParametricProduct } from '@/services/SalesService'
import { clientConfig } from '@/configs/clientConfig'
import { useAppSelector } from '@/store'
import { SUPERADMIN } from '@/constants/roles.constant'
import {
    createUrucortinasDefaultMatrixFile,
    getUrucortinasDefaultSnapshot,
    quoteUrucortinasMatrix,
} from './urucortinasParametricDefaults'

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

type QuoteResult = {
    available: boolean
    price?: number
    currency?: string
    specifications?: string | null
    detailSnapshot?: string | null
    referenceDate?: string | null
    source?: string | null
}

export type ParametricQuoteResult = QuoteResult & {
    productId: number
    requested: {
        familyId?: string | null
        serie: string
        material: string
        color: string
        vidrio: string
        widthMm: number
        heightMm: number
        hasMosquitero: boolean
        hasShutterMonoblock: boolean
        shutterMaterial: string
    }
}

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

type Option = { value: string; label: string }

const toOption = (value: string, label?: string): Option => ({
    value,
    label: label ?? value,
})

export type ParametricConfiguratorDraft = {
    matrixFile?: File | Blob | null
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

const asNumber = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return 0
    }
    return Math.trunc(parsed)
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

    const userAuthority = useAppSelector((state) => state.auth.user?.authority ?? [])
    const isSuperAdmin = userAuthority.includes(SUPERADMIN)

    const numericProductId = Number(productId ?? 0)
    const hasProductId = Number.isFinite(numericProductId) && numericProductId > 0
    const isDraftMode = !hasProductId
    const initialSnapshot = !hasProductId && isUrucortinas ? getUrucortinasDefaultSnapshot() : null

    const [loadingConfig, setLoadingConfig] = useState(false)
    const [configSnapshot, setConfigSnapshot] = useState<ParametricConfigSnapshot | null>(initialSnapshot)
    const [quoteState, setQuoteState] = useState<QuoteState | null>(() =>
        initialSnapshot ? createDefaultState(initialSnapshot) : null,
    )
    const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null)
    const [importing, setImporting] = useState(false)
    const [importSummary, setImportSummary] = useState<ParametricImportSummary | null>(null)
    const [configError, setConfigError] = useState<string | null>(null)
    const [draftInfo, setDraftInfo] = useState<ParametricConfiguratorDraft>(() => draft ?? {})
    const [draftNoticeShown, setDraftNoticeShown] = useState(false)
    const [showAdminTools, setShowAdminTools] = useState(false)

    useEffect(() => {
        if (draft) {
            setDraftInfo(draft)
        }
    }, [draft])

    useEffect(() => {
        if (hasProductId) {
            setDraftNoticeShown(false)
        }
    }, [hasProductId])

    useEffect(() => {
        if (!isSuperAdmin) {
            setShowAdminTools(false)
        }
    }, [isSuperAdmin])

    const matrixReferenceInfo = useMemo(() => {
        const latest = configSnapshot?.stats.newestReferenceDate
        if (!latest) {
            return null
        }
        const latestDate = new Date(latest)
        if (Number.isNaN(latestDate.getTime())) {
            return null
        }
        const oldestRaw = configSnapshot?.stats.oldestReferenceDate
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
    }, [configSnapshot?.stats.newestReferenceDate, configSnapshot?.stats.oldestReferenceDate])

    const formattedQuoteReferenceDate = useMemo(() => {
        if (!quoteResult?.referenceDate) {
            return null
        }
        const parsed = new Date(quoteResult.referenceDate)
        if (Number.isNaN(parsed.getTime())) {
            return null
        }
        return parsed.toLocaleDateString()
    }, [quoteResult?.referenceDate])

    const fetchConfig = useCallback(async () => {
        if (!hasProductId) {
            if (!isUrucortinas) {
                setConfigSnapshot(null)
                setQuoteState(null)
            }
            return
        }
        setLoadingConfig(true)
        setConfigError(null)
        try {
            const response = await apiGetParametricConfig<ParametricConfigSnapshot>(numericProductId)
            const snapshot = response as unknown as ParametricConfigSnapshot
            setConfigSnapshot(snapshot)
            setQuoteState((prev) => prev ?? createDefaultState(snapshot))
        } catch (error) {
            console.error('[parametric] failed to load configuration', error)
            setConfigError(
                t('sales.productForm.parametric.configLoadError', {
                    defaultValue: 'Unable to load parametric configuration for this product.',
                }),
            )
            setConfigSnapshot(null)
            setQuoteState(null)
        } finally {
            setLoadingConfig(false)
        }
    }, [hasProductId, isUrucortinas, numericProductId, t])

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
            onDraftChange?.(payload)
            return payload
        })
    }, [draftInfo.matrixFile, isDraftMode, isUrucortinas, onDraftChange])

    useEffect(() => {
        if (!isUrucortinas || !isDraftMode || configSnapshot) {
            return
        }
        const snapshot = getUrucortinasDefaultSnapshot()
        setConfigSnapshot(snapshot)
        setQuoteState((prev) => prev ?? createDefaultState(snapshot))
    }, [configSnapshot, isDraftMode, isUrucortinas])

    useEffect(() => {
        if (isUrucortinas && isDraftMode && draftInfo.matrixFile) {
            onDraftChange?.(draftInfo)
        }
    }, [draftInfo, isDraftMode, isUrucortinas, onDraftChange])

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
        fetchConfig()
    }, [fetchConfig])

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

    const handleQuote = useCallback(async () => {
        if (!quoteState) {
            return
        }
        const widthMm = asNumber(quoteState.widthMm)
        const heightMm = asNumber(quoteState.heightMm)

        if (!hasProductId) {
            if (isUrucortinas) {
                const localQuote = quoteUrucortinasMatrix({
                    familyId: quoteState.familyId,
                    serie: quoteState.serie,
                    color: quoteState.color,
                    vidrio: quoteState.vidrio,
                    widthMm,
                    heightMm,
                    hasMosquitero: quoteState.hasMosquitero,
                    hasShutterMonoblock: quoteState.hasShutterMonoblock,
                })
                setQuoteResult(localQuote)
                if (!localQuote.available) {
                    toast.push(
                        <Notification
                            title={t('sales.productForm.parametric.quoteUnavailableTitle', {
                                defaultValue: 'Configuration not available',
                            })}
                            type="warning"
                        >
                            {t('sales.productForm.parametric.quoteUnavailableDescription', {
                                defaultValue:
                                    'There is no price registered for the selected parameters. Try a different combination.',
                            })}
                        </Notification>,
                    )
                } else {
                    toast.push(
                        <Notification
                            title={t('sales.productForm.parametric.quoteSuccessTitle', {
                                defaultValue: 'Price calculated',
                            })}
                            type="success"
                        >
                            {t('sales.productForm.parametric.quoteSuccessDescription', {
                                defaultValue: 'The price matrix returned a valid price for this configuration.',
                            })}
                        </Notification>,
                    )
                }
            } else if (!draftNoticeShown) {
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.requiresProduct', {
                            defaultValue: 'Guardá el producto para configurar precios paramétricos.',
                        })}
                        type="warning"
                    >
                        {t('sales.productForm.parametric.requiresProductDetail', {
                            defaultValue: 'Cargá la matriz y guardá el producto para poder simular precios.',
                        })}
                    </Notification>,
                )
                setDraftNoticeShown(true)
            }
            return
        }
        const materialValue = configSnapshot?.selectors.materials?.[0] ?? 'ALUMINIO'
        try {
            const payload = {
                productId: numericProductId,
                familyId: quoteState.familyId || undefined,
                serie: quoteState.serie,
                material: materialValue,
                color: quoteState.color,
                vidrio: quoteState.vidrio,
                widthMm,
                heightMm,
                hasMosquitero: quoteState.hasMosquitero,
                hasShutterMonoblock: quoteState.hasShutterMonoblock,
                shutterMaterial: quoteState.hasShutterMonoblock ? quoteState.shutterMaterial : '',
            }
            const result = await apiQuoteParametricProduct<ParametricQuoteResult>(payload)
            const parsed = result as unknown as ParametricQuoteResult
            setQuoteResult(parsed)
            if (!parsed.available) {
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.quoteUnavailableTitle', {
                            defaultValue: 'Configuration not available',
                        })}
                        type="warning"
                    >
                        {t('sales.productForm.parametric.quoteUnavailableDescription', {
                            defaultValue:
                                'There is no price registered for the selected parameters. Try a different combination.',
                        })}
                    </Notification>,
                )
            } else {
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.quoteSuccessTitle', { defaultValue: 'Price calculated' })}
                        type="success"
                    >
                        {t('sales.productForm.parametric.quoteSuccessDescription', {
                            defaultValue: 'The price matrix returned a valid price for this configuration.',
                        })}
                    </Notification>,
                )
            }
        } catch (error) {
            console.error('[parametric] quote failed', error)
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.quoteError', { defaultValue: 'Unable to generate price' })}
                    type="danger"
                >
                    {t('sales.productForm.parametric.quoteErrorDescription', {
                        defaultValue: 'Verify the entered parameters and try again.',
                    })}
                </Notification>,
            )
        }
    }, [configSnapshot, draftNoticeShown, hasProductId, isUrucortinas, numericProductId, quoteState, t])

    const handleFileUpload = useCallback(
        async (files: File[]) => {
            if (!files.length) {
                return
            }
            const file = files[0]
            if (!hasProductId) {
                const draftPayload: ParametricConfiguratorDraft = { matrixFile: file }
                setDraftInfo(draftPayload)
                onDraftChange?.(draftPayload)
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
        [fetchConfig, hasProductId, numericProductId, onDraftChange, t],
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

    const glassOptions = useMemo(() => {
        if (!selectors || !quoteState) return []
        const allowed = configSnapshot?.compatibility.glassBySeries?.[quoteState.serie]
        const list = selectors.glass.filter((item) => !allowed || !allowed.length || allowed.includes(item))
        return list.map((value) => toOption(value))
    }, [configSnapshot, quoteState, selectors])

    const serieOptions = selectors?.series.map((serie) => toOption(serie)) ?? []
    const familyOptions = selectors?.families.map((family) => toOption(family || '', family || t('sales.productForm.parametric.familyDefault', { defaultValue: 'Default' }))) ?? []
    const colorOptions = selectors?.colors.map((color) => toOption(color)) ?? []
    const shutterMaterialOptions =
        selectors?.shutterMaterials
            .filter((value) => value && value.trim().length > 0)
            .map((value) => toOption(value)) ?? []

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
                                        disabled={loadingConfig || !configSnapshot?.stats.rowCount}
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
                                            setDraftInfo({})
                                            onDraftChange?.(null)
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
                                value={quoteState.familyId}
                                placeholder={t('sales.productForm.parametric.family', { defaultValue: 'Family' })}
                                onChange={(value) => handleSelectChange('familyId')(value as string)}
                                isDisabled={(!hasProductId && !isUrucortinas) || !familyOptions.length}
                            />
                            <Select
                                options={serieOptions}
                                value={quoteState.serie}
                                placeholder={t('sales.productForm.parametric.series', { defaultValue: 'Series' })}
                                onChange={(value) => {
                                    handleSelectChange('serie')(value as string)
                                }}
                                isDisabled={(!hasProductId && !isUrucortinas) || !serieOptions.length}
                            />
                            <Select
                                options={colorOptions}
                                value={quoteState.color}
                                placeholder={t('sales.productForm.parametric.color', { defaultValue: 'Color' })}
                                onChange={(value) => handleSelectChange('color')(value as string)}
                                isDisabled={(!hasProductId && !isUrucortinas) || !colorOptions.length}
                            />
                            <Select
                                options={glassOptions}
                                value={quoteState.vidrio}
                                placeholder={t('sales.productForm.parametric.glass', { defaultValue: 'Glass' })}
                                onChange={(value) => handleSelectChange('vidrio')(value as string)}
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
                                        value={quoteState.shutterMaterial}
                                        placeholder={t('sales.productForm.parametric.shutterMaterial', {
                                            defaultValue: 'Shutter material',
                                        })}
                                        onChange={(value) => handleSelectChange('shutterMaterial')(value as string)}
                                        isDisabled={(!hasProductId && !isUrucortinas) || !shutterMaterialOptions.length}
                                    />
                                )}
                            </div>
                        </div>
                        {hasProductId && (
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="solid"
                                    onClick={handleQuote}
                                    loading={loadingConfig}
                                    disabled={(!hasProductId && !isUrucortinas) || loadingConfig}
                                >
                                    {t('sales.productForm.parametric.calculate', { defaultValue: 'Calculate price' })}
                                </Button>
                            </div>
                        )}
                        {quoteResult && (
                            <div
                                className={`border rounded-md p-3 ${
                                    quoteResult.available
                                        ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10'
                                        : 'border-amber-300 bg-amber-50 dark:bg-amber-500/10'
                                }`}
                            >
                                <h6 className="font-semibold text-sm mb-2">
                                    {quoteResult.available
                                        ? t('sales.productForm.parametric.quoteResultTitle', {
                                              defaultValue: 'Price available',
                                          })
                                        : t('sales.productForm.parametric.quoteUnavailableTitle', {
                                              defaultValue: 'Configuration not available',
                                          })}
                                </h6>
                                <p className="text-sm text-gray-700 dark:text-gray-200">
                                    {quoteResult.available && quoteResult.price !== undefined
                                        ? `${quoteResult.price.toFixed(2)} ${quoteResult.currency ?? currency}`
                                        : t('sales.productForm.parametric.quoteUnavailableDescription', {
                                              defaultValue:
                                                  'There is no price for the selected parameters. Adjust the combination and try again.',
                                          })}
                                </p>
                                {formattedQuoteReferenceDate && (
                                    <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                                        {t('sales.productForm.parametric.quoteReferenceDate', {
                                            defaultValue: 'Reference date: {{date}}.',
                                            date: formattedQuoteReferenceDate,
                                        })}
                                    </p>
                                )}
                                {quoteResult.source && (
                                    <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                                        {t('sales.productForm.parametric.quoteSource', {
                                            defaultValue: 'Source: {{source}}.',
                                            source: quoteResult.source,
                                        })}
                                    </p>
                                )}
                                {(() => {
                                    const specs = quoteResult.specifications ?? quoteResult.detailSnapshot ?? ''
                                    if (!specs) {
                                        return null
                                    }
                                    return (
                                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                                            {specs}
                                        </p>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdaptableCard>
    )
}

export default ParametricConfigurator
