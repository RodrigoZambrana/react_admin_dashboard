import { useTranslation } from 'react-i18next'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import { HiOutlineCheck, HiOutlinePencil } from 'react-icons/hi'
import classNames from 'classnames'
import { resolveTextDirection } from '@/utils/textDirection'
import {
    buildSalesUnitOptions,
    DEFAULT_SALES_UNIT,
    type SalesUnit,
} from '@/constants/product.constant'
import {
    calculateLineTotal,
    getDerivedUnitPrice,
    getEffectiveQuantity,
    resolveSalesUnit,
} from '@/utils/salesUnitCalculation'

export type EditableItem = {
    lineId?: string
    productId: string
    name: string
    price: number
    qty: number
    img?: string
    description?: string
    currency?: string
    unitPrice?: number
    unitCurrency?: string
    comments?: string
    unitOfMeasure?: SalesUnit | string
    customAttributes?: Record<string, unknown>
    specSummary?: string
    pricingMethod?: string
    specifications?: string
}

type Props = {
    items: EditableItem[]
    onQtyChange: (itemId: string, qty: number) => void
    onRemove: (itemId: string) => void
    showDescription?: boolean
    showImage?: boolean
    showComments?: boolean
    onCommentChange?: (itemId: string, comments: string) => void
    onItemChange?: (itemId: string, payload: Partial<EditableItem>) => void
    showCustomAttributes?: boolean
    showUnitColumn?: boolean
    roundAmount?: (value: number) => number
    showProductSpecifications?: boolean
}

type SpecField = 'width' | 'height' | 'length'
type SpecDrafts = Record<string, Partial<Record<SpecField, string>>>

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<EditableItem>()

const stripHtml = (html?: string) =>
    (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const resolveItemKey = (item: EditableItem): string => {
    if (typeof item.lineId === 'string' && item.lineId.length > 0) {
        return item.lineId
    }
    return item.productId
}

const MAX_MEASUREMENT_DECIMALS = 3

const sanitizeMeasurementInput = (raw: string): string => {
    if (!raw) {
        return ''
    }
    const compact = raw.replace(/\s+/g, '')
    let sanitized = ''
    let separatorSeen = false
    let decimalsCount = 0

    for (const char of compact) {
        if (/\d/.test(char)) {
            if (separatorSeen) {
                if (decimalsCount >= MAX_MEASUREMENT_DECIMALS) {
                    continue
                }
                decimalsCount += 1
            }
            sanitized += char
            continue
        }
        if ((char === ',' || char === '.') && !separatorSeen) {
            sanitized += ','
            separatorSeen = true
        }
    }

    if (sanitized.startsWith(',')) {
        sanitized = `0${sanitized}`
    }

    if (sanitized === ',') {
        sanitized = '0,'
    }

    return sanitized
}

const parseSanitizedMeasurement = (sanitized: string): number | undefined => {
    if (!sanitized) {
        return undefined
    }
    const normalized = sanitized.replace(',', '.')
    if (normalized.length === 0) {
        return undefined
    }
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric)) {
        return undefined
    }
    const precisionFactor = 10 ** MAX_MEASUREMENT_DECIMALS
    return Math.round(numeric * precisionFactor) / precisionFactor
}

const ProductCell = ({
    row,
    showDescription,
    showImage,
    showProductSpecifications,
}: {
    row: EditableItem
    showDescription?: boolean
    showImage?: boolean
    showProductSpecifications?: boolean
}) => {
    const text = stripHtml(row.description)
    const excerpt = text.length > 120 ? text.slice(0, 120) + '…' : text
    const shouldShowImage = Boolean(showImage && row.img)
    const containerClass = shouldShowImage ? 'flex' : ''
    const specs =
        typeof row.specifications === 'string'
            ? row.specifications.trim()
            : ''
    const showSpecs = Boolean(showProductSpecifications && specs.length > 0)
    return (
        <div className={containerClass}>
            {shouldShowImage && (
                <Avatar size={90} src={row.img} />
            )}
            <div className={shouldShowImage ? 'ltr:ml-3 rtl:mr-3' : ''}>
                <h6 className="mb-1 font-semibold leading-tight">{row.name}</h6>
                {showDescription && excerpt && (
                    <div className="text-sm opacity-80 leading-snug">{excerpt}</div>
                )}
                {showSpecs && (
                    <div
                        className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                        dir={resolveTextDirection(specs)}
                    >
                        {specs}
                    </div>
                )}
            </div>
        </div>
    )
}

const EditableOrderProductsTable = ({
    items,
    onQtyChange,
    onRemove,
    showDescription = true,
    showImage = true,
    showComments = false,
    onCommentChange,
    onItemChange,
    showCustomAttributes = false,
    showUnitColumn = true,
    roundAmount,
    showProductSpecifications = true,
}: Props) => {
    const { t, i18n } = useTranslation()
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
    const [specDrafts, setSpecDrafts] = useState<SpecDrafts>({})
    const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({})
    const [activeQuantityId, setActiveQuantityId] = useState<string | null>(null)
    const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
    const [activeSpecField, setActiveSpecField] = useState<{
        itemId: string
        field: SpecField
    } | null>(null)
    const specInputRefs = useRef<
        Record<string, Partial<Record<SpecField, HTMLInputElement | null>>>
    >({})
    const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const formatAmount = useCallback(
        (value: number, currency?: string) => {
            const numeric = Number(value)
            const sanitized = Number.isFinite(numeric) ? numeric : 0
            const rounded = roundAmount ? roundAmount(sanitized) : sanitized
            return formatCurrency(rounded, currency, i18n.language, {
                fallbackCurrency: defaultCurrency,
            })
        },
        [defaultCurrency, i18n.language, roundAmount],
    )
    const measurementFormatter = useMemo(
        () =>
            new Intl.NumberFormat(i18n.language, {
                minimumFractionDigits: Math.min(2, MAX_MEASUREMENT_DECIMALS),
                maximumFractionDigits: MAX_MEASUREMENT_DECIMALS,
                useGrouping: false,
            }),
        [i18n.language],
    )
    const formatMeasurementValue = useCallback(
        (value?: number) => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return ''
            }
            const precisionFactor = 10 ** MAX_MEASUREMENT_DECIMALS
            const rounded =
                Math.round(value * precisionFactor) / precisionFactor
            return measurementFormatter.format(rounded)
        },
        [measurementFormatter],
    )
    const setSpecDraftValue = useCallback(
        (itemId: string, field: SpecField, value: string) => {
            setSpecDrafts((prev) => {
                const previous = prev[itemId]
                if (previous?.[field] === value) {
                    return prev
                }
                return {
                    ...prev,
                    [itemId]: {
                        ...previous,
                        [field]: value,
                    },
                }
            })
        },
        [],
    )
    const clearSpecDraft = useCallback((itemId: string, field: SpecField) => {
        setSpecDrafts((prev) => {
            const previous = prev[itemId]
            if (!previous || !(field in previous)) {
                return prev
            }
            const nextProductDrafts = { ...previous }
            delete nextProductDrafts[field]
            if (Object.keys(nextProductDrafts).length === 0) {
                const next = { ...prev }
                delete next[itemId]
                return next
            }
            return {
                ...prev,
                [itemId]: nextProductDrafts,
            }
        })
    }, [])
    const resolveMeasurementDisplayValue = useCallback(
        (itemId: string, field: SpecField, numericValue?: number) => {
            const draftValue = specDrafts[itemId]?.[field]
            if (draftValue !== undefined) {
                return draftValue
            }
            return formatMeasurementValue(numericValue)
        },
        [formatMeasurementValue, specDrafts],
    )

    const registerSpecRef = useCallback(
        (itemId: string, field: SpecField) => {
            return (node: HTMLInputElement | null) => {
                if (!specInputRefs.current[itemId]) {
                    specInputRefs.current[itemId] = {}
                }
                specInputRefs.current[itemId][field] = node
            }
        },
        [],
    )

    const registerQuantityRef = useCallback((itemId: string) => {
        return (node: HTMLInputElement | null) => {
            if (!node) {
                delete quantityInputRefs.current[itemId]
                return
            }
            quantityInputRefs.current[itemId] = node
        }
    }, [])

    const setQuantityDraftValue = useCallback((itemId: string, value: string) => {
        setQuantityDrafts((previous) => {
            if (previous[itemId] === value) {
                return previous
            }
            return {
                ...previous,
                [itemId]: value,
            }
        })
    }, [])

    const clearQuantityDraft = useCallback((itemId: string) => {
        setQuantityDrafts((previous) => {
            if (!(itemId in previous)) {
                return previous
            }
            const next = { ...previous }
            delete next[itemId]
            return next
        })
    }, [])

    const composeSquareMeterSummary = useCallback(
        (width?: number, height?: number) => {
            if (!Number.isFinite(width) || !Number.isFinite(height)) {
                return undefined
            }
            const numericWidth = Number(width)
            const numericHeight = Number(height)
            const formattedWidth = formatMeasurementValue(numericWidth)
            const formattedHeight = formatMeasurementValue(numericHeight)
            const widthLabel = t('text.specs.width', {
                defaultValue: 'Width',
            })
            const heightLabel = t('text.specs.height', {
                defaultValue: 'Height',
            })
            return t('sales.documents.squareSummary', {
                width: formattedWidth,
                height: formattedHeight,
                defaultValue: `${widthLabel}: ${formattedWidth} m · ${heightLabel}: ${formattedHeight} m`,
            })
        },
        [formatMeasurementValue, t],
    )

    const composeLinearMeterSummary = useCallback(
        (length?: number) => {
            if (!Number.isFinite(length)) {
                return undefined
            }
            const numericLength = Number(length)
            const formattedLength = formatMeasurementValue(numericLength)
            const lengthLabel = t('text.specs.length', {
                defaultValue: 'Length',
            })
            return t('sales.documents.linearSummary', {
                length: formattedLength,
                defaultValue: `${lengthLabel}: ${formattedLength} m`,
            })
        },
        [formatMeasurementValue, t],
    )

    const salesUnitOptions = useMemo(
        () => buildSalesUnitOptions(t),
        [t],
    )

    const priceColumn = columnHelper.accessor('price', {
        header: t('text.columns.price'),
        cell: (props) => {
            const row = props.row.original
            const derivedPrice = getDerivedUnitPrice(row)
            return (
                <span>
                    {formatAmount(derivedPrice, row.currency)}
                </span>
            )
        },
    })

    const columns = [
        columnHelper.accessor('name', {
            header: t('text.columns.product'),
            cell: (props) => {
                const row = props.row.original
                return (
                    <ProductCell
                        row={row}
                        showDescription={showDescription}
                        showImage={showImage}
                        showProductSpecifications={showProductSpecifications}
                    />
                )
            },
        }),
        columnHelper.accessor('qty', {
            header: t('text.columns.quantity'),
            cell: (props) => {
                const row = props.row.original
                const unit = resolveSalesUnit(
                    row.unitOfMeasure,
                    row.pricingMethod,
                )
                const derivedQuantity = getEffectiveQuantity(row)
                const measurementSuffix =
                    unit === 'SQUARE_METER'
                        ? 'm²'
                        : unit === 'LINEAR_METER'
                        ? 'm'
                        : ''
                const formattedDerivedQuantity = Number.isFinite(derivedQuantity)
                    ? derivedQuantity.toFixed(2)
                    : undefined
                const itemKey = resolveItemKey(row)
                const quantityDraft = quantityDrafts[itemKey]
                const fallbackQuantity =
                    typeof row.qty === 'number' && Number.isFinite(row.qty)
                        ? row.qty
                        : ''
                return (
                    <div className="flex flex-col">
                        <Input
                            type="number"
                            min={1}
                            step="1"
                            value={quantityDraft ?? fallbackQuantity}
                            ref={registerQuantityRef(itemKey)}
                            autoFocus={activeQuantityId === itemKey}
                            onChange={(e) => {
                                const rawValue = e.target.value
                                if (rawValue === '') {
                                    setQuantityDraftValue(itemKey, '')
                                    return
                                }
                                if (!/^\d+$/.test(rawValue)) {
                                    return
                                }
                                setQuantityDraftValue(itemKey, rawValue)
                                const numeric = Number.parseInt(rawValue, 10)
                                if (!Number.isFinite(numeric) || numeric < 1) {
                                    return
                                }
                                onQtyChange(itemKey, numeric)
                            }}
                            onFocus={() => setActiveQuantityId(itemKey)}
                            onBlur={() => {
                                setActiveQuantityId((previous) =>
                                    previous === itemKey ? null : previous,
                                )
                                clearQuantityDraft(itemKey)
                            }}
                        />
                        {unit !== 'UNIT' && formattedDerivedQuantity !== undefined && (
                            <span className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                                {t('text.labels.estimatedQuantity', {
                                    defaultValue: 'Cantidad estimada: {{value}} {{unit}}',
                                    value: formattedDerivedQuantity,
                                    unit: measurementSuffix,
                                })}
                            </span>
                        )}
                    </div>
                )
            },
        }),
    ]

    if (showUnitColumn) {
        columns.push(
            columnHelper.display({
                id: 'unit',
                header: t('text.labels.unitOfMeasure', {
                    defaultValue: 'Unidad de venta',
                }),
                cell: (props) => {
                    if (!showCustomAttributes) {
                        return (
                            <span className="inline-block min-w-[6rem]">
                                {t(`text.salesUnit.${props.row.original.unitOfMeasure}`, {
                                    defaultValue:
                                        props.row.original.unitOfMeasure ??
                                        t('text.labels.unitOfMeasure', {
                                            defaultValue: 'Unidad',
                                        }),
                                })}
                            </span>
                        )
                    }
                    const row = props.row.original
                    const itemKey = resolveItemKey(row)
                    const unitValue =
                        salesUnitOptions.find(
                            (option) => option.value === row.unitOfMeasure,
                        ) || salesUnitOptions.find((option) => option.value === DEFAULT_SALES_UNIT)
                    return (
                        <Select
                            className="min-w-[9rem]"
                            options={salesUnitOptions}
                            value={unitValue as any}
                            isDisabled={!onItemChange}
                            onChange={(option) => {
                                if (!onItemChange) {
                                    return
                                }
                                const selected =
                                    (option as { value: SalesUnit | string } | null)?.value
                                const normalized =
                                    (selected as SalesUnit | undefined) ?? DEFAULT_SALES_UNIT
                                const nextItemState: EditableItem = {
                                    ...row,
                                    unitOfMeasure: normalized,
                                    pricingMethod: normalized,
                                }
                                const nextPrice = getDerivedUnitPrice(nextItemState)
                                onItemChange(itemKey, {
                                    unitOfMeasure: normalized,
                                    pricingMethod: normalized,
                                    price: nextPrice,
                                })
                            }}
                        />
                    )
                },
            }),
        )
    }

    columns.push(
        columnHelper.display({
            id: 'total',
            header: t('text.columns.total'),
            cell: (props) => {
                const { currency } = props.row.original
                const lineTotal = calculateLineTotal(props.row.original)
                return (
                    <span>
                        {formatAmount(lineTotal, currency)}
                    </span>
                )
            },
        }),
    )

    columns.push(
        columnHelper.display({
            id: 'actions',
            header: t('text.columns.actions'),
            cell: (props) => {
                const row = props.row.original
                const itemKey = resolveItemKey(row)
                return (
                    <div className="text-right">
                        <Button size="sm" onClick={() => onRemove(itemKey)}>
                            {t('text.actions.remove')}
                        </Button>
                    </div>
                )
            },
        }),
    )

    if (showComments) {
        const commentColumn = columnHelper.display({
            id: 'comments',
            header: t('text.columns.comments'),
            cell: (props) => {
                const row = props.row.original
                const itemKey = resolveItemKey(row)
                if (!onCommentChange) {
                    return (
                        <span
                            className="block min-h-[2.25rem] whitespace-pre-wrap"
                            dir={resolveTextDirection(row.comments)}
                        >
                            {row.comments?.trim?.() ? row.comments : '—'}
                        </span>
                    )
                }
                const isEditing = editingCommentId === itemKey
                const draftValue = commentDrafts[itemKey] ?? row.comments ?? ''
                const originalValue = row.comments ?? ''
                const hasChanges = draftValue !== originalValue
                const closeEditor = () => {
                    setEditingCommentId(null)
                    setCommentDrafts((prev) => {
                        const next = { ...prev }
                        delete next[itemKey]
                        return next
                    })
                    delete textAreaRefs.current[itemKey]
                }
                const handleSave = () => {
                    if (!hasChanges) {
                        closeEditor()
                        return
                    }
                    onCommentChange(itemKey, draftValue)
                    closeEditor()
                }
                if (!isEditing) {
                    const hasComment = Boolean(row.comments?.trim?.())
                    const displayText = hasComment
                        ? row.comments
                        : t('text.labels.notAvailable', {
                              defaultValue: 'Not available',
                          })
                    const displayDir = resolveTextDirection(row.comments)
                    const displayClass = classNames(
                        'block min-h-[2.25rem] whitespace-pre-wrap text-sm flex-1',
                        hasComment
                            ? 'text-gray-700 dark:text-gray-200'
                            : 'text-gray-400 italic',
                    )
                    return (
                        <div className="flex items-start gap-2">
                            <span className={displayClass} dir={displayDir}>
                                {displayText}
                            </span>
                            <Button
                                size="sm"
                                variant="plain"
                                shape="circle"
                                icon={<HiOutlinePencil />}
                                type="button"
                                className="shrink-0"
                            aria-label={t('text.actions.edit')}
                            title={t('text.actions.edit')}
                            onClick={() => {
                                setEditingCommentId(itemKey)
                                setCommentDrafts((prev) => ({
                                    ...prev,
                                    [itemKey]: row.comments ?? '',
                                }))
                            }}
                        />
                        </div>
                    )
                }
                return (
                    <div className="flex items-start gap-2">
                        <Textarea
                            value={draftValue}
                            className="w-full"
                            ref={(node) => {
                                textAreaRefs.current[itemKey] =
                                    (node as HTMLTextAreaElement | null) ?? null
                            }}
                            autoFocus
                            placeholder={t('text.placeholders.enterComment', {
                                defaultValue: 'Add a note for this product',
                            })}
                            onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                    ...prev,
                                    [itemKey]: e.target.value,
                                }))
                            }
                            dir={resolveTextDirection(draftValue)}
                            rows={4}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    event.preventDefault()
                                    closeEditor()
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            variant="plain"
                            shape="circle"
                            icon={<HiOutlineCheck />}
                            type="button"
                            className="shrink-0 mt-1.5"
                            aria-label={t('text.actions.save')}
                            title={t('text.actions.save')}
                            onClick={handleSave}
                        />
                    </div>
                )
            },
        })
        const insertBeforeId = showUnitColumn ? 'unit' : 'total'
        const targetIndex = columns.findIndex((column) => column.id === insertBeforeId)
        const insertionIndex = targetIndex >= 0 ? targetIndex : columns.length - 2
        columns.splice(insertionIndex, 0, commentColumn)
    }

    if (showCustomAttributes) {
        const specColumn = columnHelper.display({
            id: 'specifications',
            header: t('text.columns.specifications', {
                defaultValue: 'Especificaciones',
            }),
            cell: (props) => {
                const row = props.row.original
                const itemKey = resolveItemKey(row)
                const unit =
                    (row.unitOfMeasure ??
                        row.pricingMethod ??
                        DEFAULT_SALES_UNIT) as SalesUnit | string
                const attrs = row.customAttributes || {}
                const parseValue = (key: string) => {
                    const numeric = Number(attrs[key as keyof typeof attrs])
                    return Number.isFinite(numeric) ? numeric : undefined
                }
                const width = parseValue('width')
                const height = parseValue('height')
                const length = parseValue('length')
                const specSummaryText =
                    typeof row.specSummary === 'string'
                        ? row.specSummary.trim()
                        : ''
                const productSpecText =
                    typeof row.specifications === 'string'
                        ? row.specifications.trim()
                        : ''
                const measurementSummary =
                    unit === 'SQUARE_METER'
                        ? composeSquareMeterSummary(width, height)
                        : unit === 'LINEAR_METER'
                        ? composeLinearMeterSummary(length)
                        : undefined
                const combinedLines: string[] = []
                if (specSummaryText) {
                    combinedLines.push(specSummaryText)
                } else if (measurementSummary) {
                    combinedLines.push(measurementSummary)
                }
                if (showProductSpecifications && productSpecText) {
                    combinedLines.push(productSpecText)
                }
                const combinedSummary = combinedLines.join('\n')

                if (unit === 'SQUARE_METER') {
                    const widthValue = resolveMeasurementDisplayValue(
                        itemKey,
                        'width',
                        width,
                    )
                    const heightValue = resolveMeasurementDisplayValue(
                        itemKey,
                        'height',
                        height,
                    )
                    return (
                        <div className="flex flex-col gap-2 min-w-[14rem]">
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]{0,3}"
                                    placeholder={t('text.labels.widthMeters', {
                                        defaultValue: 'Ancho (m)',
                                    })}
                                    value={widthValue}
                                    disabled={!onItemChange}
                                    ref={registerSpecRef(itemKey, 'width')}
                                    autoFocus={
                                        activeSpecField?.itemId === itemKey &&
                                        activeSpecField.field === 'width'
                                    }
                                    onFocus={() =>
                                        setActiveSpecField((previous) => {
                                            if (
                                                previous?.itemId === itemKey &&
                                                previous.field === 'width'
                                            ) {
                                                return previous
                                            }
                                            return {
                                                itemId: itemKey,
                                                field: 'width',
                                            }
                                        })
                                    }
                                    onBlur={() => {
                                        if (
                                            activeSpecField?.itemId === itemKey &&
                                            activeSpecField.field === 'width'
                                        ) {
                                            setActiveSpecField(null)
                                        }
                                        clearSpecDraft(itemKey, 'width')
                                    }}
                                    onChange={(event) => {
                                        const sanitized = sanitizeMeasurementInput(event.target.value)
                                        setSpecDraftValue(itemKey, 'width', sanitized)
                                        if (!onItemChange) {
                                            return
                                        }
                                        const nextValue =
                                            parseSanitizedMeasurement(sanitized)
                                        const nextSummary =
                                            nextValue !== undefined && height !== undefined
                                                ? composeSquareMeterSummary(
                                                      nextValue,
                                                      height,
                                                  )
                                                : undefined
                                        const nextCustomAttributes = {
                                            ...attrs,
                                            width: nextValue,
                                        }
                                        if (nextValue === undefined) {
                                            delete nextCustomAttributes.width
                                        }
                                        const nextItemState: EditableItem = {
                                            ...row,
                                            customAttributes: nextCustomAttributes,
                                        }
                                        const nextPrice = getDerivedUnitPrice(nextItemState)
                                        onItemChange(itemKey, {
                                            customAttributes: nextCustomAttributes,
                                            specSummary: nextSummary,
                                            price: nextPrice,
                                        })
                                    }}
                                />
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]{0,3}"
                                    placeholder={t('text.labels.heightMeters', {
                                        defaultValue: 'Altura (m)',
                                    })}
                                    value={heightValue}
                                    disabled={!onItemChange}
                                    ref={registerSpecRef(itemKey, 'height')}
                                    autoFocus={
                                        activeSpecField?.itemId === itemKey &&
                                        activeSpecField.field === 'height'
                                    }
                                    onFocus={() =>
                                        setActiveSpecField((previous) => {
                                            if (
                                                previous?.itemId === itemKey &&
                                                previous.field === 'height'
                                            ) {
                                                return previous
                                            }
                                            return {
                                                itemId: itemKey,
                                                field: 'height',
                                            }
                                        })
                                    }
                                    onBlur={() => {
                                        if (
                                            activeSpecField?.itemId === itemKey &&
                                            activeSpecField.field === 'height'
                                        ) {
                                            setActiveSpecField(null)
                                        }
                                        clearSpecDraft(itemKey, 'height')
                                    }}
                                    onChange={(event) => {
                                        const sanitized = sanitizeMeasurementInput(event.target.value)
                                        setSpecDraftValue(itemKey, 'height', sanitized)
                                        if (!onItemChange) {
                                            return
                                        }
                                        const nextValue =
                                            parseSanitizedMeasurement(sanitized)
                                        const nextSummary =
                                            width !== undefined && nextValue !== undefined
                                                ? composeSquareMeterSummary(
                                                      width,
                                                      nextValue,
                                                  )
                                                : undefined
                                        const nextCustomAttributes = {
                                            ...attrs,
                                            height: nextValue,
                                        }
                                        if (nextValue === undefined) {
                                            delete nextCustomAttributes.height
                                        }
                                        const nextItemState: EditableItem = {
                                            ...row,
                                            customAttributes: nextCustomAttributes,
                                        }
                                        const nextPrice = getDerivedUnitPrice(nextItemState)
                                        onItemChange(itemKey, {
                                            customAttributes: nextCustomAttributes,
                                            specSummary: nextSummary,
                                            price: nextPrice,
                                        })
                                    }}
                                />
                            </div>
                            {combinedSummary && (
                                <div
                                    className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                                    dir={resolveTextDirection(combinedSummary)}
                                >
                                    {combinedLines.map((line, index) => (
                                        <div key={`square-${itemKey}-${index}`}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                if (unit === 'LINEAR_METER') {
                    const lengthValue = resolveMeasurementDisplayValue(
                        itemKey,
                        'length',
                        length,
                    )
                    return (
                        <div className="flex flex-col gap-2 min-w-[12rem]">
                            <Input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]{0,3}"
                                placeholder={t('text.labels.linearMeters', {
                                    defaultValue: 'Metros lineales (m)',
                                })}
                                value={lengthValue}
                                disabled={!onItemChange}
                                ref={registerSpecRef(itemKey, 'length')}
                                autoFocus={
                                    activeSpecField?.itemId === itemKey &&
                                    activeSpecField.field === 'length'
                                }
                                onFocus={() =>
                                    setActiveSpecField((previous) => {
                                        if (
                                            previous?.itemId === itemKey &&
                                            previous.field === 'length'
                                        ) {
                                            return previous
                                        }
                                        return {
                                            itemId: itemKey,
                                            field: 'length',
                                        }
                                    })
                                }
                                onBlur={() => {
                                    if (
                                        activeSpecField?.itemId === itemKey &&
                                        activeSpecField.field === 'length'
                                    ) {
                                        setActiveSpecField(null)
                                    }
                                    clearSpecDraft(itemKey, 'length')
                                }}
                                onChange={(event) => {
                                    const sanitized = sanitizeMeasurementInput(event.target.value)
                                    setSpecDraftValue(itemKey, 'length', sanitized)
                                    if (!onItemChange) {
                                        return
                                    }
                                    const nextValue =
                                        parseSanitizedMeasurement(sanitized)
                                    const nextSummary =
                                        nextValue !== undefined
                                            ? composeLinearMeterSummary(nextValue)
                                            : undefined
                                    const nextCustomAttributes = {
                                        ...attrs,
                                        length: nextValue,
                                    }
                                    if (nextValue === undefined) {
                                        delete nextCustomAttributes.length
                                    }
                                    const nextItemState: EditableItem = {
                                        ...row,
                                        customAttributes: nextCustomAttributes,
                                    }
                                    const nextPrice = getDerivedUnitPrice(nextItemState)
                                    onItemChange(itemKey, {
                                        customAttributes: nextCustomAttributes,
                                        specSummary: nextSummary,
                                        price: nextPrice,
                                    })
                                }}
                            />
                            {combinedSummary && (
                                <div
                                    className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                                    dir={resolveTextDirection(combinedSummary)}
                                >
                                    {combinedLines.map((line, index) => (
                                        <div key={`linear-${itemKey}-${index}`}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                if (combinedSummary) {
                    return (
                        <span
                            className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200"
                            dir={resolveTextDirection(combinedSummary)}
                        >
                            {combinedSummary}
                        </span>
                    )
                }

                return (
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                        {t('sales.documents.noExtraAttributes', {
                            defaultValue: 'No requiere información adicional.',
                        })}
                    </div>
                )
            },
        })

        const totalColumnIndex = columns.findIndex(
            (column) => column.id === 'total',
        )
        if (totalColumnIndex >= 0) {
            columns.splice(totalColumnIndex, 0, specColumn)
        } else {
            columns.push(specColumn)
        }
    }

    const totalIndexForPrice = columns.findIndex((column) => column.id === 'total')
    if (totalIndexForPrice >= 0) {
        columns.splice(totalIndexForPrice, 0, priceColumn)
    } else {
        columns.push(priceColumn)
    }

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    useEffect(() => {
        if (!editingCommentId) {
            return
        }
        const node = textAreaRefs.current[editingCommentId]
        if (node) {
            node.focus()
            const length = node.value.length
            node.setSelectionRange(length, length)
        }
    }, [editingCommentId, commentDrafts])

    useEffect(() => {
        if (!activeQuantityId) {
            return
        }
        const node = quantityInputRefs.current[activeQuantityId]
        if (!node) {
            const exists = items.some(
                (item) => resolveItemKey(item) === activeQuantityId,
            )
            if (!exists) {
                setActiveQuantityId(null)
            }
            return
        }
        if (document.activeElement !== node) {
            node.focus({ preventScroll: true })
            if (
                typeof node.selectionStart === 'number' &&
                typeof node.selectionEnd === 'number'
            ) {
                const length = node.value.length
                try {
                    node.setSelectionRange(length, length)
                } catch {
                    // ignore selection errors for inputs that disallow programmatic selection
                }
            }
        }
    }, [activeQuantityId, items])

    useEffect(() => {
        if (!activeSpecField) {
            return
        }
        const node =
            specInputRefs.current[activeSpecField.itemId]?.[activeSpecField.field]
        if (node && document.activeElement !== node) {
            node.focus({ preventScroll: true })
            if (
                node.type !== 'number' &&
                typeof node.selectionStart === 'number' &&
                typeof node.selectionEnd === 'number'
            ) {
                const length = node.value.length
                try {
                    node.setSelectionRange(length, length)
                } catch {
                    // ignore browsers that still block selection on this input
                }
            }
        }
    }, [activeSpecField, items])

    return (
        <Table>
            <THead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <Tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <Th key={header.id} colSpan={header.colSpan}>
                                {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                )}
                            </Th>
                        ))}
                    </Tr>
                ))}
            </THead>
            <TBody>
                {table.getRowModel().rows.map((row) => (
                    <Tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <Td key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Td>
                        ))}
                    </Tr>
                ))}
                {items.length === 0 && (
                    <Tr>
                        <Td colSpan={table.getAllColumns().length}>
                            <div className="text-center py-6 opacity-70">
                                {t('text.placeholders.searchProduct')}
                            </div>
                        </Td>
                    </Tr>
                )}
            </TBody>
        </Table>
    )
}

export default EditableOrderProductsTable
