import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import Upload from '@/components/ui/Upload'
import Notification from '@/components/ui/Notification'
import { toast } from '@/components/ui/toast'
import {
    apiGetParametricConfig,
    apiImportParametricReferences,
    apiQuoteParametricProduct,
} from '@/services/SalesService'

const DEFAULT_FORM_STATE = {
    width: '1.00',
    height: '1.00',
    series: 'GALA',
    color: 'NATURAL',
    glass: '4MM',
    mosquitoNet: false,
    monoblockEnabled: false,
    monoblockMaterial: 'PVC',
    monoblockColor: 'WHITE',
}

const sanitizeNumberInput = (value: string) => value.replace(/[^0-9.,]/g, '')

const parseConfigOptions = (config: Record<string, any> | null | undefined) => {
    if (!config || typeof config !== 'object') {
        return {
            series: ['20', '25', '30', 'GALA', 'PROBBA', 'SUMMA'],
            colors: ['NATURAL', 'WHITE', 'BLACK', 'BROWN', 'ANOLOC'],
            glass: ['3MM', '4MM', '5MM', '6MM', 'DVH'],
        }
    }
    const series =
        config?.inputs?.series?.options && Array.isArray(config.inputs.series.options)
            ? config.inputs.series.options
            : ['20', '25', '30', 'GALA', 'PROBBA', 'SUMMA']
    const colors =
        config?.inputs?.color?.options && Array.isArray(config.inputs.color.options)
            ? config.inputs.color.options
            : ['NATURAL', 'WHITE', 'BLACK', 'BROWN', 'ANOLOC']
    const glass =
        config?.inputs?.glass?.options && Array.isArray(config.inputs.glass.options)
            ? config.inputs.glass.options
            : ['3MM', '4MM', '5MM', '6MM', 'DVH']
    return {
        series,
        colors,
        glass,
    }
}

const buildQuotePayload = (
    productId: number,
    state: typeof DEFAULT_FORM_STATE,
) => ({
    productId,
    width: Number(state.width.replace(',', '.')),
    height: Number(state.height.replace(',', '.')),
    series: state.series,
    color: state.color,
    glass: state.glass,
    mosquitoNet: state.mosquitoNet,
    monoblock: state.monoblockEnabled
        ? {
              enabled: true,
              material: state.monoblockMaterial,
              color: state.monoblockColor,
          }
        : { enabled: false },
})

type ParametricConfiguratorProps = {
    productId?: number | null
    currency: string
}

const ParametricConfigurator = ({ productId, currency }: ParametricConfiguratorProps) => {
    const { t } = useTranslation()
    const [loadingConfig, setLoadingConfig] = useState(false)
    const [config, setConfig] = useState<Record<string, any> | null>(null)
    const [quoteState, setQuoteState] = useState(DEFAULT_FORM_STATE)
    const [quoting, setQuoting] = useState(false)
    const [quoteResult, setQuoteResult] = useState<null | {
        total: number
        currency: string
        breakdown: Record<string, number>
        referenceDate: string
        dataVersion: string
    }>(null)
    const [importing, setImporting] = useState(false)

    const options = useMemo(() => parseConfigOptions(config), [config])
    const numericProductId = Number(productId ?? 0)
    const isReadOnly = !Number.isFinite(numericProductId) || numericProductId <= 0

    useEffect(() => {
        if (!numericProductId || numericProductId <= 0) {
            setConfig(null)
            return
        }
        let mounted = true
        setLoadingConfig(true)
        ;(async () => {
            try {
                const response = await apiGetParametricConfig<{ data: Record<string, any> }>(numericProductId)
                if (!mounted) return
                setConfig((response as any)?.data ?? (response as any))
            } catch (error) {
                console.error('[parametric] config load failed', error)
                if (mounted) {
                    setConfig(null)
                }
            } finally {
                if (mounted) {
                    setLoadingConfig(false)
                }
            }
        })()
        return () => {
            mounted = false
        }
    }, [numericProductId])

    const handleFieldChange = useCallback(
        (field: keyof typeof DEFAULT_FORM_STATE) => (value: string | boolean) => {
            setQuoteState((prev) => ({
                ...prev,
                [field]: typeof value === 'string' ? value : value,
            }))
        },
        [],
    )

    const handleFileUpload = useCallback(
        async (files: File[]) => {
            if (!files.length) {
                return
            }
            if (isReadOnly) {
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.requiresProduct', {
                            defaultValue: 'Save the product to configure parametric pricing.',
                        })}
                        type="info"
                    />,
                    { placement: 'top-center' },
                )
                return
            }
            const file = files[0]
            const formData = new FormData()
            formData.append('file', file)
            setImporting(true)
            try {
                const response = await apiImportParametricReferences<{ data: any }>(numericProductId, formData)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.importSuccess', { defaultValue: 'Import completed' })}
                        type="success"
                    >
                        {t('sales.productForm.parametric.importSummary', {
                            defaultValue: 'Processed {{rows}} rows. Created {{references}} references and {{modifiers}} modifiers.',
                            rows: (response as any)?.rowsProcessed ?? 0,
                            references: (response as any)?.referencesInserted ?? 0,
                            modifiers: (response as any)?.modifiersInserted ?? 0,
                        })}
                    </Notification>,
                )
            } catch (error) {
                console.error('[parametric] import failed', error)
                toast.push(
                    <Notification
                        title={t('sales.productForm.parametric.importError', { defaultValue: 'Import failed' })}
                        type="danger"
                    >
                        {t('sales.productForm.parametric.importErrorDescription', {
                            defaultValue: 'Please check the file format and try again.',
                        })}
                    </Notification>,
                )
            } finally {
                setImporting(false)
            }
        },
        [isReadOnly, numericProductId, t],
    )

    const handleQuote = useCallback(async () => {
        if (isReadOnly) {
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.requiresProduct', {
                        defaultValue: 'Save the product to configure parametric pricing.',
                    })}
                    type="info"
                />,
                { placement: 'top-center' },
            )
            return
        }
        setQuoting(true)
        setQuoteResult(null)
        try {
            const payload = buildQuotePayload(numericProductId, quoteState)
            const response = await apiQuoteParametricProduct<{
                total: number
                currency: string
                breakdown: Record<string, number>
                referenceDate: string
                dataVersion: string
            }>(payload)
            setQuoteResult(response as any)
        } catch (error) {
            console.error('[parametric] quote failed', error)
            toast.push(
                <Notification
                    title={t('sales.productForm.parametric.quoteError', { defaultValue: 'Unable to generate quote' })}
                    type="danger"
                >
                    {t('sales.productForm.parametric.quoteErrorDescription', {
                        defaultValue: 'Verify the parameters and try again.',
                    })}
                </Notification>,
            )
        } finally {
            setQuoting(false)
        }
    }, [isReadOnly, numericProductId, quoteState, t])

    return (
        <AdaptableCard className="mb-4">
            <div className="flex flex-col gap-4">
                <div>
                    <h5 className="mb-1 flex items-center gap-2">
                        {t('sales.productForm.parametric.title', { defaultValue: 'Parametric pricing' })}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('sales.productForm.parametric.subtitle', {
                            defaultValue: 'Import quotation history and test the price engine with real-time parameters.',
                        })}
                    </p>
                    {isReadOnly && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            {t('sales.productForm.parametric.requiresProductDetail', {
                                defaultValue:
                                    'Create and save the product first to import reference prices or run price simulations.',
                            })}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                        <h6 className="font-semibold text-sm">
                            {t('sales.productForm.parametric.testTitle', { defaultValue: 'Try calculation' })}
                        </h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                                value={quoteState.width}
                                onChange={(event) =>
                                    handleFieldChange('width')(sanitizeNumberInput(event.target.value))
                                }
                                placeholder="1.00"
                                label={t('sales.productForm.parametric.width', { defaultValue: 'Width (m)' })}
                                disabled={isReadOnly}
                            />
                            <Input
                                value={quoteState.height}
                                onChange={(event) =>
                                    handleFieldChange('height')(sanitizeNumberInput(event.target.value))
                                }
                                placeholder="1.00"
                                label={t('sales.productForm.parametric.height', { defaultValue: 'Height (m)' })}
                                disabled={isReadOnly}
                            />
                            <Select
                                options={options.series.map((value) => ({ label: value, value }))}
                                value={quoteState.series}
                                onChange={(value) => handleFieldChange('series')(value)}
                                placeholder="Serie"
                                isDisabled={isReadOnly}
                            />
                            <Select
                                options={options.colors.map((value) => ({ label: value, value }))}
                                value={quoteState.color}
                                onChange={(value) => handleFieldChange('color')(value)}
                                placeholder={t('sales.productForm.parametric.color', { defaultValue: 'Color' })}
                                isDisabled={isReadOnly}
                            />
                            <Select
                                options={options.glass.map((value) => ({ label: value, value }))}
                                value={quoteState.glass}
                                onChange={(value) => handleFieldChange('glass')(value)}
                                placeholder={t('sales.productForm.parametric.glass', { defaultValue: 'Glass' })}
                                isDisabled={isReadOnly}
                            />
                            <div className="flex items-center justify-between border rounded-md px-3 py-2">
                                <span className="text-sm font-medium">
                                    {t('sales.productForm.parametric.mosquitoNet', { defaultValue: 'Mosquito net' })}
                                </span>
                                <Switcher
                                    checked={quoteState.mosquitoNet}
                                    onChange={(checked) => handleFieldChange('mosquitoNet')(checked)}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
                        <div className="border rounded-md p-3 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {t('sales.productForm.parametric.monoblock', { defaultValue: 'Monoblock' })}
                                </span>
                                <Switcher
                                    checked={quoteState.monoblockEnabled}
                                    onChange={(checked) => handleFieldChange('monoblockEnabled')(checked)}
                                    disabled={isReadOnly}
                                />
                            </div>
                            {quoteState.monoblockEnabled && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Select
                                        options={[{ value: 'PVC', label: 'PVC' }, { value: 'ALUMINUM', label: 'ALUMINUM' }]}
                                        value={quoteState.monoblockMaterial}
                                        onChange={(value) => handleFieldChange('monoblockMaterial')(value)}
                                        placeholder="Material"
                                        isDisabled={isReadOnly}
                                    />
                                    <Select
                                        options={['WHITE', 'NATURAL', 'BLACK', 'BROWN'].map((value) => ({ label: value, value }))}
                                        value={quoteState.monoblockColor}
                                        onChange={(value) => handleFieldChange('monoblockColor')(value)}
                                        placeholder="Color"
                                        isDisabled={isReadOnly}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="solid"
                                onClick={handleQuote}
                                loading={quoting}
                                disabled={isReadOnly || quoting}
                            >
                                {t('sales.productForm.parametric.calculate', { defaultValue: 'Calculate price' })}
                            </Button>
                            {quoteResult && (
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {t('sales.productForm.parametric.lastQuote', {
                                        defaultValue: 'Last quote: {{total}} {{currency}} ({{date}})',
                                        total: quoteResult.total.toFixed(2),
                                        currency: quoteResult.currency ?? currency,
                                        date: new Date(quoteResult.referenceDate).toLocaleDateString(),
                                    })}
                                </span>
                            )}
                        </div>
                        {quoteResult && (
                            <div className="border rounded-md p-3">
                                <h6 className="font-semibold text-sm mb-2">
                                    {t('sales.productForm.parametric.breakdown', { defaultValue: 'Breakdown' })}
                                </h6>
                                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                                    <li>
                                        {t('sales.productForm.parametric.base', { defaultValue: 'Base' })}:{' '}
                                        {quoteResult.breakdown.base.toFixed(2)} {quoteResult.currency}
                                    </li>
                                    <li>
                                        {t('sales.productForm.parametric.colorModifier', { defaultValue: 'Color' })}:{' '}
                                        {quoteResult.breakdown.color.toFixed(2)} {quoteResult.currency}
                                    </li>
                                    <li>
                                        {t('sales.productForm.parametric.glassModifier', { defaultValue: 'Glass' })}:{' '}
                                        {quoteResult.breakdown.glass.toFixed(2)} {quoteResult.currency}
                                    </li>
                                    <li>
                                        {t('sales.productForm.parametric.monoblockModifier', { defaultValue: 'Monoblock' })}:{' '}
                                        {quoteResult.breakdown.monoblock.toFixed(2)} {quoteResult.currency}
                                    </li>
                                    <li>
                                        {t('sales.productForm.parametric.mosquitoModifier', { defaultValue: 'Mosquito net' })}:{' '}
                                        {quoteResult.breakdown.mosquitoNet.toFixed(2)} {quoteResult.currency}
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        <h6 className="font-semibold text-sm">
                            {t('sales.productForm.parametric.importTitle', { defaultValue: 'Bulk import' })}
                        </h6>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {t('sales.productForm.parametric.importDescription', {
                                defaultValue:
                                    'Upload an Excel or CSV file with the required columns (FECHA COTIZACION, PRODUCTO, MOSQUITERO, ANCHO, ALTO, SERIE, COLOR, VIDRIO, PRECIO, DETALLE).',
                            })}
                        </p>
                        <Upload
                            draggable
                            beforeUpload={() => true}
                            onChange={(files) => handleFileUpload(files)}
                            showList={false}
                            disabled={isReadOnly || importing}
                        >
                            <div className="border border-dashed rounded-md py-6 text-center text-sm text-gray-600 dark:text-gray-300">
                                {isReadOnly
                                    ? t('sales.productForm.parametric.requiresProduct', {
                                          defaultValue: 'Save the product to enable imports.',
                                      })
                                    : importing
                                    ? t('sales.productForm.parametric.importing', { defaultValue: 'Importing…' })
                                    : t('sales.productForm.parametric.importCta', { defaultValue: 'Drop file here or click to browse' })}
                            </div>
                        </Upload>
                        <div className="border rounded-md p-3 text-sm text-gray-600 dark:text-gray-300">
                            {isReadOnly
                                ? t('sales.productForm.parametric.configIdle', {
                                      defaultValue: 'Save the product to load parametric configuration options.',
                                  })
                                : loadingConfig
                                ? t('sales.productForm.parametric.loadingConfig', { defaultValue: 'Loading configuration…' })
                                : t('sales.productForm.parametric.configSummary', {
                                      defaultValue: 'Configured series: {{series}}. Colors: {{colors}}.',
                                      series: options.series.join(', '),
                                      colors: options.colors.join(', '),
                                  })}
                        </div>
                    </div>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default ParametricConfigurator
