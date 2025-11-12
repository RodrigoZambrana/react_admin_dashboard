import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Checkbox from '@/components/ui/Checkbox'
import Input from '@/components/ui/Input'
import Switcher from '@/components/ui/Switcher'
import Upload from '@/components/ui/Upload'
import Dialog from '@/components/ui/Dialog'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ParametricConfigurator from './ParametricConfigurator'
import type { ParametricConfiguratorDraft } from './parametricTypes'
import { HiOutlinePlus, HiOutlinePhotograph, HiOutlineTrash } from 'react-icons/hi'
import type {
    ProductMode,
    ProductAttribute,
    ProductAttributeType,
    ProductAttributeValue,
    ProductVariant,
    ProductVariantAttribute,
    ProductVariantImage,
} from './types'
import { clientConfig } from '@/configs/clientConfig'

type VariantConfiguratorProps = {
    mode: ProductMode
    attributes: ProductAttribute[]
    variants: ProductVariant[]
    basePrice: number
    baseStock: number
    currency: string
    productId: number
    onModeChange: (mode: ProductMode) => void
    onAttributesChange: (attributes: ProductAttribute[]) => void
    onVariantsChange: (variants: ProductVariant[]) => void
    parametricDraft?: ParametricConfiguratorDraft | null
    onParametricDraftChange?: (draft: ParametricConfiguratorDraft | null) => void
    allowedModes?: ProductMode[]
    modeSwitchDisabled?: boolean
}

type VariantImagesDialogProps = {
    isOpen: boolean
    images: ProductVariantImage[]
    inheritImages: boolean
    onSave: (images: ProductVariantImage[], inheritImages: boolean) => void
    onClose: () => void
}

const ATTRIBUTE_ORDER: ProductAttributeType[] = ['COLOR', 'SIZE', 'MATERIAL']

const ATTRIBUTE_METADATA: Record<
    ProductAttributeType,
    { label: string; defaultName: string; valuePlaceholder: string }
> = {
    COLOR: {
        label: 'Color',
        defaultName: 'Color',
        valuePlaceholder: 'Rojo, Azul, Verde...',
    },
    SIZE: {
        label: 'Talle',
        defaultName: 'Talle',
        valuePlaceholder: 'S, M, L, 38, 39...',
    },
    MATERIAL: {
        label: 'Material',
        defaultName: 'Material',
        valuePlaceholder: 'Algodón, Cuero...',
    },
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']
const MAX_IMAGE_FILE_SIZE = 500_000

const validateImageSelection = (
    files: FileList | null,
    invalidTypeMessage: string,
    invalidSizeMessage: string,
) => {
    if (!files) {
        return true
    }
    for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return invalidTypeMessage
        }
        if (file.size >= MAX_IMAGE_FILE_SIZE) {
            return invalidSizeMessage
        }
    }
    return true
}

const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

const toCanonical = (input: string, fallback: string): string => {
    const base = input?.trim() || fallback
    const canonical = base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return canonical || fallback.toLowerCase()
}

const sortAttributes = (attributes: ProductAttribute[]): ProductAttribute[] =>
    [...attributes].sort(
        (a, b) =>
            ATTRIBUTE_ORDER.indexOf(a.type) - ATTRIBUTE_ORDER.indexOf(b.type),
    )

const generateUniqueValueKey = (
    type: ProductAttributeType,
    existing: ProductAttributeValue[],
    label: string,
): string => {
    const prefix = type.toLowerCase()
    const baseKey = toCanonical(label, `${prefix}-value`)
    const existingKeys = new Set(existing.map((value) => value.key))
    let candidate = `${prefix}-${baseKey}`
    let counter = 1
    while (existingKeys.has(candidate)) {
        candidate = `${prefix}-${baseKey}-${counter}`
        counter += 1
    }
    return candidate
}

const buildVariantLabel = (selections: ProductVariantAttribute[]): string =>
    selections
        .map((entry) => entry.label || entry.value || entry.valueKey)
        .filter(Boolean)
        .join(' / ')

const buildVariantKey = (selections: ProductVariantAttribute[]): string => {
    const ordered = selections
        .slice()
        .sort(
            (a, b) =>
                ATTRIBUTE_ORDER.indexOf(a.attribute) -
                ATTRIBUTE_ORDER.indexOf(b.attribute),
        )
    const parts = ordered.map(
        (entry) => `${entry.attribute.toLowerCase()}-${entry.valueKey}`,
    )
    return toCanonical(parts.join('-'), `variant-${Date.now()}`)
}

const ALL_MODES: ProductMode[] = ['simple', 'variable', 'parametric']

const createDefaultAttribute = (
    type: ProductAttributeType,
    existingAttributes: ProductAttribute[],
): ProductAttribute => {
    const existing =
        existingAttributes.find((attribute) => attribute.type === type)
            ?.values ?? []
    const defaultLabel =
        type === 'COLOR'
            ? `Color ${existing.length + 1}`
            : type === 'SIZE'
            ? `Talle ${existing.length + 1}`
            : `Material ${existing.length + 1}`
    const defaultKey = generateUniqueValueKey(type, existing, defaultLabel)
    const defaultValue: ProductAttributeValue = {
        id: undefined,
        key: defaultKey,
        label: defaultLabel,
        value: type === 'SIZE' ? defaultLabel : undefined,
        colorHex: type === 'COLOR' ? '#000000' : undefined,
        imageUrl: undefined,
        imageAlt: undefined,
        sortOrder: existing.length,
    }
    return {
        id: undefined,
        type,
        name: ATTRIBUTE_METADATA[type].defaultName,
        values: [defaultValue],
    }
}

const createDefaultVariant = (
    selections: ProductVariantAttribute[],
): ProductVariant => {
    const key = buildVariantKey(selections)
    return {
        id: undefined,
        key,
        sku: undefined,
        barcode: undefined,
        label: buildVariantLabel(selections),
        salePrice: null,
        costPrice: null,
        stock: null,
        permanentStock: null,
        isActive: true,
        inheritSalePrice: true,
        inheritCostPrice: true,
        inheritStock: true,
        inheritSku: true,
        inheritImages: true,
        attributes: selections,
        images: [],
    }
}

const rebuildVariants = (
    attributes: ProductAttribute[],
    previous: ProductVariant[],
): ProductVariant[] => {
    if (!attributes.length) {
        return []
    }
    const sortedAttributes = sortAttributes(attributes)
    if (sortedAttributes.some((attribute) => attribute.values.length === 0)) {
        return []
    }

    const combinations = sortedAttributes.reduce<ProductVariantAttribute[][]>(
        (acc, attribute) => {
            const next: ProductVariantAttribute[][] = []
            attribute.values.forEach((value) => {
                const selection: ProductVariantAttribute = {
                    attribute: attribute.type,
                    valueKey: value.key,
                    label: value.label,
                    value: value.value,
                    colorHex: value.colorHex,
                    imageUrl: value.imageUrl,
                    imageAlt: value.imageAlt,
                    optionValueId: value.id,
                }
                if (!acc.length) {
                    next.push([selection])
                } else {
                    acc.forEach((combo) => {
                        next.push([...combo, selection])
                    })
                }
            })
            return next
        },
        [],
    )

    const previousMap = new Map(previous.map((variant) => [variant.key, variant]))

    return combinations.map((combo) => {
        const key = buildVariantKey(combo)
        const existing = previousMap.get(key)
        if (existing) {
            return {
                ...existing,
                attributes: combo,
                label:
                    existing.label && existing.label.trim().length > 0
                        ? existing.label
                        : buildVariantLabel(combo),
            }
        }
        return createDefaultVariant(combo)
    })
}

const VariantImagesDialog = (props: VariantImagesDialogProps) => {
    const { isOpen, images, inheritImages, onSave, onClose } = props
    const { t } = useTranslation()
    const [tempImages, setTempImages] = useState<ProductVariantImage[]>(images)
    const [useInheritedImages, setUseInheritedImages] = useState<boolean>(inheritImages)
    const [selectedImage, setSelectedImage] = useState<ProductVariantImage | null>(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const beforeUpload = (file: FileList | null) =>
        validateImageSelection(
            file,
            t('sales.productForm.images.invalidType', {
                defaultValue: 'Subí archivos JPG o PNG.',
            }),
            t('sales.productForm.images.invalidSize', {
                defaultValue: 'La imagen no puede superar los 500kb.',
            }),
        )

    const handleUpload = async (files: File[]) => {
        if (!files.length) {
            return
        }
        const dataUrls = await Promise.all(files.map((file) => fileToDataUrl(file)))
        const nextImages = files.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            img: dataUrls[index],
        }))
        setUseInheritedImages(false)
        setTempImages((prev) => [...prev, ...nextImages])
    }

    const handleDeleteImage = (image: ProductVariantImage) => {
        setSelectedImage(image)
        setDeleteConfirmOpen(true)
    }

    const confirmDeleteImage = () => {
        if (selectedImage) {
            setTempImages((prev) =>
                prev.filter((image) => image.id !== selectedImage.id),
            )
        }
        setDeleteConfirmOpen(false)
        setSelectedImage(null)
    }

    const resetState = () => {
        setTempImages(images)
        setUseInheritedImages(inheritImages)
        setSelectedImage(null)
        setDeleteConfirmOpen(false)
    }

    const handleClose = () => {
        resetState()
        onClose()
    }

    const handleSave = () => {
        onSave(tempImages, useInheritedImages)
        onClose()
    }

    return (
        <Dialog isOpen={isOpen} onClose={handleClose} onRequestClose={handleClose}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <h5>{t('sales.productForm.variants.images.title', { defaultValue: 'Imágenes de la variante' })}</h5>
                    <Checkbox
                        checked={useInheritedImages}
                        onChange={(checked) => setUseInheritedImages(checked)}
                    >
                        {t('sales.productForm.variants.images.inherit', {
                            defaultValue: 'Usar imágenes del producto',
                        })}
                    </Checkbox>
                </div>
                {!useInheritedImages && (
                    <>
                        <Upload
                            draggable
                            className="border-dashed border-2 border-gray-300 dark:border-gray-600 rounded-md p-4 text-center"
                            beforeUpload={beforeUpload}
                            onChange={(files) => handleUpload(files)}
                        >
                            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
                                <HiOutlinePhotograph />
                                <span>{t('sales.productForm.images.upload', { defaultValue: 'Subir imágenes' })}</span>
                            </div>
                        </Upload>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {tempImages.map((image) => (
                                <div
                                    key={image.id}
                                    className="relative border rounded-md overflow-hidden group"
                                >
                                    <img
                                        src={image.img}
                                        alt={image.name}
                                        className="w-full h-32 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteImage(image)}
                                        className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-gray-900/70 text-white"
                                    >
                                        <HiOutlineTrash />
                                    </button>
                                </div>
                            ))}
                            {!tempImages.length && (
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                    {t('sales.productForm.variants.images.empty', {
                                        defaultValue: 'No se cargaron imágenes para esta variante.',
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="plain" onClick={handleClose}>
                        {t('text.actions.cancel')}
                    </Button>
                    <Button type="button" variant="solid" onClick={handleSave}>
                        {t('text.actions.save')}
                    </Button>
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                type="danger"
                title={t('text.actions.remove')}
                confirmButtonColor="red-600"
                onClose={() => setDeleteConfirmOpen(false)}
                onRequestClose={() => setDeleteConfirmOpen(false)}
                onCancel={() => setDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteImage}
            >
                <p>{t('sales.productForm.images.removeConfirm')}</p>
            </ConfirmDialog>
        </Dialog>
    )
}

const VariantConfigurator = (props: VariantConfiguratorProps) => {
    const {
        mode,
        attributes,
        variants,
        basePrice,
        baseStock,
        currency,
        productId,
        onModeChange,
        onAttributesChange,
        onVariantsChange,
        parametricDraft,
        onParametricDraftChange,
        allowedModes,
        modeSwitchDisabled = false,
    } = props
    const { t } = useTranslation()

    const isUrucortinas = clientConfig.slug === 'urucortinas'

    const availableModes = useMemo(() => {
        const source = Array.isArray(allowedModes) && allowedModes.length ? allowedModes : ALL_MODES
        const unique = Array.from(new Set(source))
        const filtered = unique.filter((item): item is ProductMode => ALL_MODES.includes(item))
        if (isUrucortinas) {
            return filtered
        }
        return filtered.filter((item) => item !== 'parametric')
    }, [allowedModes, isUrucortinas])

    const currentMode = useMemo<ProductMode>(() => {
        if (availableModes.includes(mode)) {
            return mode
        }
        return availableModes[0] ?? 'simple'
    }, [availableModes, mode])

    useEffect(() => {
        if (!availableModes.includes(mode) && availableModes.length) {
            onModeChange(availableModes[0])
        }
    }, [availableModes, mode, onModeChange])

    const handleModeSelect = useCallback(
        (nextMode: ProductMode) => {
            if (modeSwitchDisabled) {
                return
            }
            if (!availableModes.includes(nextMode) || nextMode === currentMode) {
                return
            }
            onModeChange(nextMode)
        },
        [availableModes, currentMode, modeSwitchDisabled, onModeChange],
    )

    const attributeText = useMemo(
        () =>
            ATTRIBUTE_ORDER.reduce<
                Record<
                    ProductAttributeType,
                    { label: string; defaultName: string; valuePlaceholder: string }
                >
            >((acc, type) => {
                acc[type] = {
                    label: t(`sales.productForm.variants.attributes.types.${type.toLowerCase()}`, {
                        defaultValue: ATTRIBUTE_METADATA[type].label,
                    }),
                    defaultName: t(
                        `sales.productForm.variants.attributes.types.${type.toLowerCase()}`,
                        {
                            defaultValue: ATTRIBUTE_METADATA[type].defaultName,
                        },
                    ),
                    valuePlaceholder: t(
                        `sales.productForm.variants.attributes.placeholder.${type.toLowerCase()}`,
                        {
                            defaultValue: ATTRIBUTE_METADATA[type].valuePlaceholder,
                        },
                    ),
                }
                return acc
            }, {} as Record<ProductAttributeType, { label: string; defaultName: string; valuePlaceholder: string }>),
        [t],
    )

    const [imagesEditorState, setImagesEditorState] = useState<{
        open: boolean
        variantKey: string | null
    }>({ open: false, variantKey: null })

    const selectedVariantForImages = useMemo(() => {
        if (!imagesEditorState.variantKey) {
            return null
        }
        return variants.find((variant) => variant.key === imagesEditorState.variantKey) ?? null
    }, [imagesEditorState.variantKey, variants])

    const validateSwatchUpload = useCallback(
        (fileList: FileList | null) =>
            validateImageSelection(
                fileList,
                t('sales.productForm.images.invalidType', {
                    defaultValue: 'Subí archivos JPG o PNG.',
                }),
                t('sales.productForm.images.invalidSize', {
                    defaultValue: 'La imagen no puede superar los 500kb.',
                }),
            ),
        [t],
    )


    const toggleAttribute = (type: ProductAttributeType, enable: boolean) => {
        if (enable) {
            if (attributes.some((attribute) => attribute.type === type)) {
                return
            }
            const nextAttributes = sortAttributes([
                ...attributes,
                createDefaultAttribute(type, attributes),
            ])
            onAttributesChange(nextAttributes)
            onVariantsChange(rebuildVariants(nextAttributes, variants))
        } else {
            const nextAttributes = attributes.filter((attribute) => attribute.type !== type)
            onAttributesChange(nextAttributes)
            onVariantsChange(rebuildVariants(nextAttributes, variants))
        }
    }

    const updateAttributeName = (type: ProductAttributeType, name: string) => {
        const nextAttributes = attributes.map((attribute) =>
            attribute.type === type ? { ...attribute, name } : attribute,
        )
        onAttributesChange(nextAttributes)
    }

    const addAttributeValue = (type: ProductAttributeType) => {
        const nextAttributes = attributes.map((attribute) => {
            if (attribute.type !== type) {
                return attribute
            }
            const values = attribute.values ?? []
            const label =
                type === 'COLOR'
                    ? `Color ${values.length + 1}`
                    : type === 'SIZE'
                    ? `Talle ${values.length + 1}`
                    : `Material ${values.length + 1}`
            const key = generateUniqueValueKey(type, values, label)
            const nextValue: ProductAttributeValue = {
                id: undefined,
                key,
                label,
                value: type === 'SIZE' ? label : undefined,
                colorHex: type === 'COLOR' ? '#000000' : undefined,
                imageUrl: undefined,
                imageAlt: undefined,
                sortOrder: values.length,
            }
            return {
                ...attribute,
                values: [...values, nextValue],
            }
        })
        onAttributesChange(nextAttributes)
        onVariantsChange(rebuildVariants(nextAttributes, variants))
    }

    const updateAttributeValue = (
        type: ProductAttributeType,
        valueKey: string,
        patch: Partial<ProductAttributeValue>,
    ) => {
        const nextAttributes = attributes.map((attribute) => {
            if (attribute.type !== type) {
                return attribute
            }
            const nextValues = attribute.values.map((value) =>
                value.key === valueKey ? { ...value, ...patch } : value,
            )
            return {
                ...attribute,
                values: nextValues,
            }
        })
        onAttributesChange(nextAttributes)
        onVariantsChange(rebuildVariants(nextAttributes, variants))
    }

    const handleAttributeImageUpload = useCallback(
        async (type: ProductAttributeType, valueKey: string, files: File[]) => {
            if (!files.length) {
                return
            }
            const last = files[files.length - 1]
            try {
                const dataUrl = await fileToDataUrl(last)
                updateAttributeValue(type, valueKey, {
                    imageUrl: dataUrl,
                })
            } catch (error) {
                console.warn('[variant-configurator] Failed to process image upload', error)
            }
        },
        [updateAttributeValue],
    )

    const clearAttributeImage = useCallback(
        (type: ProductAttributeType, valueKey: string) => {
            updateAttributeValue(type, valueKey, {
                imageUrl: undefined,
                imageAlt: undefined,
            })
        },
        [updateAttributeValue],
    )

    const removeAttributeValue = (type: ProductAttributeType, valueKey: string) => {
        const nextAttributes = attributes
            .map((attribute) => {
                if (attribute.type !== type) {
                    return attribute
                }
                const filtered = attribute.values.filter((value) => value.key !== valueKey)
                return {
                    ...attribute,
                    values: filtered.map((value, index) => ({
                        ...value,
                        sortOrder: index,
                    })),
                }
            })
            .filter((attribute) => attribute.values.length > 0)
        onAttributesChange(nextAttributes)
        onVariantsChange(rebuildVariants(nextAttributes, variants))
    }

    const massUpdateVariants = (updater: (variant: ProductVariant) => ProductVariant) => {
        onVariantsChange(variants.map((variant) => updater(variant)))
    }

    const handleVariantToggle = (key: string, patch: Partial<ProductVariant>) => {
        onVariantsChange(
            variants.map((variant) =>
                variant.key === key
                    ? {
                          ...variant,
                          ...patch,
                      }
                    : variant,
            ),
        )
    }

    const openImagesEditor = (variantKey: string) => {
        setImagesEditorState({ variantKey, open: true })
    }

    const closeImagesEditor = () => {
        setImagesEditorState({ variantKey: null, open: false })
    }

    const applyImagesChanges = (images: ProductVariantImage[], inheritImages: boolean) => {
        if (!imagesEditorState.variantKey) {
            return
        }
        onVariantsChange(
            variants.map((variant) =>
                variant.key === imagesEditorState.variantKey
                    ? {
                          ...variant,
                          images,
                          inheritImages: inheritImages || images.length === 0,
                      }
                    : variant,
            ),
        )
    }

    const attributeSelection = ATTRIBUTE_ORDER.map((type) => ({
        type,
        checked: attributes.some((attribute) => attribute.type === type),
    }))

    const activeAttributes = sortAttributes(attributes)
    const modeLockHint = t('sales.productForm.variants.modeLockedHint', {
        defaultValue: 'Only editable while creating a product.',
    })

    const modeButtons = useMemo(
        () =>
            [
                {
                    value: 'simple' as ProductMode,
                    label: t('sales.productForm.variants.mode.simple', {
                        defaultValue: 'Producto simple',
                    }),
                },
                {
                    value: 'variable' as ProductMode,
                    label: t('sales.productForm.variants.mode.variable', {
                        defaultValue: 'Producto variable',
                    }),
                },
                {
                    value: 'parametric' as ProductMode,
                    label: t('sales.productForm.variants.mode.parametric', {
                        defaultValue: 'Producto paramétrico',
                    }),
                },
            ].filter((entry) => availableModes.includes(entry.value)),
        [availableModes, t],
    )

    const isParametricOnly = availableModes.length === 1 && availableModes[0] === 'parametric'
    const modeDescription = isParametricOnly
        ? t('sales.productForm.parametric.drawerDescription', {
              defaultValue: 'Administrá matrices de precios y compatibilidades para productos paramétricos.',
          })
        : t('sales.productForm.variants.description', {
              defaultValue:
                  'Configurá un producto variable para ofrecer combinaciones por color, talle o material.',
          })

    return (
        <AdaptableCard divider className="mb-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h5>{t('sales.productForm.variants.title', { defaultValue: 'Variantes del producto' })}</h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{modeDescription}</p>
                </div>
                {modeButtons.length > 1 && (
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            {modeButtons.map((button) => {
                                const disabled = modeSwitchDisabled && button.value !== currentMode
                                return (
                                    <Button
                                        key={button.value}
                                        type="button"
                                        variant={currentMode === button.value ? 'solid' : 'plain'}
                                        onClick={() => handleModeSelect(button.value)}
                                        size="sm"
                                        disabled={disabled}
                                        title={disabled ? modeLockHint : undefined}
                                    >
                                        {button.label}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
            {currentMode === 'variable' && (
                <div className="flex flex-col gap-6 mt-6">
                    <div className="flex flex-col gap-3">
                        <h6 className="font-semibold text-sm">
                            {t('sales.productForm.variants.attributes.title', {
                                defaultValue: 'Atributos disponibles',
                            })}
                        </h6>
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                            {attributeSelection.map(({ type, checked }) => (
                                <Checkbox
                                    key={type}
                                    checked={checked}
                                    onChange={(value) => toggleAttribute(type, value)}
                                >
                                    {attributeText[type].label}
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                    {activeAttributes.map((attribute) => (
                        <div key={attribute.type} className="border rounded-lg p-4 flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h6 className="font-semibold text-sm">
                                        {attributeText[attribute.type].label}
                                    </h6>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {attributeText[attribute.type].valuePlaceholder}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={attribute.name}
                                        onChange={(event) =>
                                            updateAttributeName(attribute.type, event.target.value)
                                        }
                                        placeholder={attributeText[attribute.type].defaultName}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        icon={<HiOutlinePlus />}
                                        onClick={() => addAttributeValue(attribute.type)}
                                    >
                                        {t('sales.productForm.variants.attributes.addValue', {
                                            defaultValue: 'Agregar valor',
                                        })}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                {attribute.values.map((value) => (
                                    <div
                                        key={value.key}
                                        className="flex flex-col md:flex-row md:items-center gap-3 border rounded-md p-3"
                                    >
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div className="md:col-span-1">
                                                <Input
                                                    value={value.label}
                                                    onChange={(event) =>
                                                        updateAttributeValue(attribute.type, value.key, {
                                                            label: event.target.value,
                                                        })
                                                    }
                                                    placeholder={attributeText[attribute.type].valuePlaceholder}
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                {attribute.type === 'COLOR' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="h-10 w-16 border rounded-md"
                                                                value={value.colorHex ?? '#000000'}
                                                                onChange={(event) =>
                                                                    updateAttributeValue(attribute.type, value.key, {
                                                                        colorHex: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <Input
                                                                value={value.colorHex ?? '#000000'}
                                                                onChange={(event) =>
                                                                    updateAttributeValue(attribute.type, value.key, {
                                                                        colorHex: event.target.value,
                                                                    })
                                                                }
                                                                placeholder="#000000"
                                                            />
                                                        </div>
                                                        <Input
                                                            value={value.value ?? ''}
                                                            onChange={(event) =>
                                                                updateAttributeValue(attribute.type, value.key, {
                                                                    value: event.target.value,
                                                                })
                                                            }
                                                            placeholder={t(
                                                                'sales.productForm.variants.attributes.colorValuePlaceholder',
                                                                {
                                                                    defaultValue: 'Descripción o código opcional',
                                                                },
                                                            )}
                                                        />
                                                    </div>
                                                ) : (
                                                    <Input
                                                        value={value.value ?? ''}
                                                        onChange={(event) =>
                                                            updateAttributeValue(attribute.type, value.key, {
                                                                value: event.target.value,
                                                            })
                                                        }
                                                        placeholder={attributeText[attribute.type].valuePlaceholder}
                                                    />
                                                )}
                                            </div>
                                            {(attribute.type === 'COLOR' || attribute.type === 'MATERIAL') && (
                                                <div className="md:col-span-2 flex flex-col gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Upload
                                                            beforeUpload={validateSwatchUpload}
                                                            showList={false}
                                                            onChange={(files) =>
                                                                handleAttributeImageUpload(
                                                                    attribute.type,
                                                                    value.key,
                                                                    files,
                                                                )
                                                            }
                                                        >
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                icon={<HiOutlinePhotograph />}
                                                            >
                                                                {value.imageUrl
                                                                    ? attribute.type === 'COLOR'
                                                                        ? t(
                                                                              'sales.productForm.variants.attributes.replaceSwatch',
                                                                              {
                                                                                  defaultValue:
                                                                                      'Reemplazar muestra',
                                                                              },
                                                                          )
                                                                        : t(
                                                                              'sales.productForm.variants.attributes.replaceMaterialImage',
                                                                              {
                                                                                  defaultValue:
                                                                                      'Reemplazar imagen',
                                                                              },
                                                                          )
                                                                    : attribute.type === 'COLOR'
                                                                    ? t(
                                                                          'sales.productForm.variants.attributes.addSwatch',
                                                                          {
                                                                              defaultValue: 'Agregar muestra',
                                                                          },
                                                                      )
                                                                    : t(
                                                                          'sales.productForm.variants.attributes.addMaterialImage',
                                                                          {
                                                                              defaultValue: 'Agregar imagen',
                                                                          },
                                                                      )}
                                                            </Button>
                                                        </Upload>
                                                        {value.imageUrl && (
                                                            <>
                                                                <img
                                                                    src={value.imageUrl}
                                                                    alt={value.imageAlt || value.label}
                                                                    className="h-12 w-12 object-cover rounded border border-gray-200 dark:border-gray-600"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="plain"
                                                                    className="text-red-600"
                                                                    onClick={() =>
                                                                        clearAttributeImage(
                                                                            attribute.type,
                                                                            value.key,
                                                                        )
                                                                    }
                                                                >
                                                                    {attribute.type === 'COLOR'
                                                                        ? t(
                                                                              'sales.productForm.variants.attributes.clearSwatch',
                                                                              {
                                                                                  defaultValue: 'Quitar muestra',
                                                                              },
                                                                          )
                                                                        : t(
                                                                              'sales.productForm.variants.attributes.clearMaterialImage',
                                                                              {
                                                                                  defaultValue: 'Quitar imagen',
                                                                              },
                                                                          )}
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                    {value.imageUrl ? (
                                                        <Input
                                                            value={value.imageAlt ?? ''}
                                                            onChange={(event) =>
                                                                updateAttributeValue(attribute.type, value.key, {
                                                                    imageAlt: event.target.value,
                                                                })
                                                            }
                                                            placeholder={t(
                                                                'sales.productForm.variants.attributes.imageAltPlaceholder',
                                                                {
                                                                    defaultValue:
                                                                        'Descripción para lectores de pantalla',
                                                                },
                                                            )}
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('sales.productForm.variants.attributes.noImage', {
                                                                defaultValue:
                                                                    'Aún no se cargó una imagen para este valor.',
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="plain"
                                            className="text-red-600"
                                            onClick={() => removeAttributeValue(attribute.type, value.key)}
                                            icon={<HiOutlineTrash />}
                                        >
                                            {t('text.actions.remove')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div>
                                <h6 className="font-semibold text-sm">
                                    {t('sales.productForm.variants.table.title', {
                                        defaultValue: 'Variantes generadas',
                                    })}
                                </h6>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('sales.productForm.variants.table.description', {
                                        defaultValue:
                                            'Editá el precio, stock, SKU e imágenes por cada variante o heredá los valores del producto.',
                                    })}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            inheritSalePrice: true,
                                            salePrice: null,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.inheritPrice', {
                                        defaultValue: 'Heredar precio',
                                    })}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            inheritSalePrice: false,
                                            salePrice: basePrice,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.applyBasePrice', {
                                        defaultValue: 'Aplicar precio base',
                                    })}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            inheritStock: true,
                                            stock: null,
                                            permanentStock: null,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.inheritStock', {
                                        defaultValue: 'Heredar stock',
                                    })}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            inheritStock: false,
                                            stock: baseStock,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.applyBaseStock', {
                                        defaultValue: 'Aplicar stock base',
                                    })}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            isActive: true,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.activateAll', {
                                        defaultValue: 'Activar todas',
                                    })}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        massUpdateVariants((variant) => ({
                                            ...variant,
                                            isActive: false,
                                        }))
                                    }
                                >
                                    {t('sales.productForm.variants.actions.deactivateAll', {
                                        defaultValue: 'Desactivar todas',
                                    })}
                                </Button>
                            </div>
                        </div>
                        {variants.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {t('sales.productForm.variants.table.empty', {
                                    defaultValue:
                                        'Seleccioná atributos y valores para generar la tabla de variantes.',
                                })}
                            </div>
                        ) : (
                            <Table>
                                <thead>
                                    <tr>
                                        {activeAttributes.map((attribute) => (
                                            <th key={attribute.type} className="text-left">
                                                {attribute.name || ATTRIBUTE_METADATA[attribute.type].label}
                                            </th>
                                        ))}
                                        <th className="text-left">
                                            {t('sales.productForm.variants.table.price', {
                                                defaultValue: 'Precio',
                                            })}
                                        </th>
                                        <th className="text-left">
                                            {t('sales.productForm.variants.table.stock', {
                                                defaultValue: 'Stock',
                                            })}
                                        </th>
                                        <th className="text-left">SKU</th>
                                        <th className="text-left">
                                            {t('sales.productForm.variants.table.images', {
                                                defaultValue: 'Imágenes',
                                            })}
                                        </th>
                                        <th className="text-left">
                                            {t('sales.productForm.variants.table.active', {
                                                defaultValue: 'Activo',
                                            })}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((variant) => (
                                        <tr key={variant.key}>
                                            {variant.attributes.map((selection) => (
                                                <td key={`${variant.key}-${selection.attribute}`}>
                                                    <div className="flex items-center gap-2">
                                                        {selection.colorHex && (
                                                            <span
                                                                className="inline-block h-4 w-4 rounded-full border"
                                                                style={{ backgroundColor: selection.colorHex }}
                                                            />
                                                        )}
                                                        <span>
                                                            {selection.label ||
                                                                selection.value ||
                                                                selection.valueKey}
                                                        </span>
                                                    </div>
                                                </td>
                                            ))}
                                            <td>
                                                <div className="flex flex-col gap-2">
                                                    <Checkbox
                                                        checked={variant.inheritSalePrice}
                                                        onChange={(checked) =>
                                                            handleVariantToggle(variant.key, {
                                                                inheritSalePrice: checked,
                                                                salePrice: checked ? null : variant.salePrice,
                                                            })
                                                        }
                                                    >
                                                        {t('sales.productForm.variants.table.inheritPrice', {
                                                            defaultValue: 'Usar precio del producto',
                                                        })}
                                                    </Checkbox>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        disabled={variant.inheritSalePrice}
                                                        value={
                                                            variant.salePrice !== null &&
                                                            variant.salePrice !== undefined
                                                                ? variant.salePrice
                                                                : ''
                                                        }
                                                        onChange={(event) =>
                                                            handleVariantToggle(variant.key, {
                                                                salePrice:
                                                                    event.target.value === ''
                                                                        ? null
                                                                        : Number(event.target.value),
                                                            })
                                                        }
                                                        placeholder={`${currency} ${basePrice.toFixed(2)}`}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col gap-2">
                                                    <Checkbox
                                                        checked={variant.inheritStock}
                                                        onChange={(checked) =>
                                                            handleVariantToggle(variant.key, {
                                                                inheritStock: checked,
                                                                stock: checked ? null : variant.stock,
                                                                permanentStock: checked
                                                                    ? null
                                                                    : variant.permanentStock ?? false,
                                                            })
                                                        }
                                                    >
                                                        {t('sales.productForm.variants.table.inheritStock', {
                                                            defaultValue: 'Usar stock del producto',
                                                        })}
                                                    </Checkbox>
                                                    <Input
                                                        type="number"
                                                        disabled={variant.inheritStock}
                                                        value={
                                                            variant.stock !== null &&
                                                            variant.stock !== undefined
                                                                ? variant.stock
                                                                : ''
                                                        }
                                                        onChange={(event) =>
                                                            handleVariantToggle(variant.key, {
                                                                stock:
                                                                    event.target.value === ''
                                                                        ? null
                                                                        : Number(event.target.value),
                                                            })
                                                        }
                                                    />
                                                    <Checkbox
                                                        disabled={variant.inheritStock}
                                                        checked={Boolean(variant.permanentStock)}
                                                        onChange={(checked) =>
                                                            handleVariantToggle(variant.key, {
                                                                permanentStock: checked,
                                                            })
                                                        }
                                                    >
                                                        {t('sales.productForm.variants.table.permanentStock', {
                                                            defaultValue: 'Stock permanente',
                                                        })}
                                                    </Checkbox>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col gap-2">
                                                    <Checkbox
                                                        checked={variant.inheritSku}
                                                        onChange={(checked) =>
                                                            handleVariantToggle(variant.key, {
                                                                inheritSku: checked,
                                                                sku: checked ? undefined : variant.sku,
                                                            })
                                                        }
                                                    >
                                                        {t('sales.productForm.variants.table.inheritSku', {
                                                            defaultValue: 'Usar código del producto',
                                                        })}
                                                    </Checkbox>
                                                    <Input
                                                        disabled={variant.inheritSku}
                                                        value={variant.sku ?? ''}
                                                        onChange={(event) =>
                                                            handleVariantToggle(variant.key, {
                                                                sku: event.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        onClick={() => openImagesEditor(variant.key)}
                                                    >
                                                        {variant.inheritImages
                                                            ? t('sales.productForm.variants.images.inheritLabel', {
                                                                  defaultValue: 'Hereda imágenes',
                                                              })
                                                            : t('sales.productForm.variants.images.count', {
                                                                  defaultValue: '{{count}} imágenes',
                                                                  count: variant.images.length,
                                                              })}
                                                    </Button>
                                                    {!variant.inheritImages && !variant.images.length && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('sales.productForm.variants.images.none', {
                                                                defaultValue: 'Sin imágenes propias',
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <Switcher
                                                    checked={variant.isActive}
                                                    onChange={(checked) =>
                                                        handleVariantToggle(variant.key, {
                                                            isActive: checked,
                                                        })
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}
                    </div>
                </div>
            )}
            {currentMode === 'parametric' && isUrucortinas && (
                <div className="mt-6">
                    <ParametricConfigurator
                        productId={productId}
                        currency={currency}
                        draft={parametricDraft}
                        onDraftChange={onParametricDraftChange}
                    />
                </div>
            )}
            {selectedVariantForImages && (
                <VariantImagesDialog
                    isOpen={imagesEditorState.open}
                    images={selectedVariantForImages.images}
                    inheritImages={selectedVariantForImages.inheritImages}
                    onSave={applyImagesChanges}
                    onClose={closeImagesEditor}
                />
            )}
        </AdaptableCard>
    )
}

export default VariantConfigurator
