import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { DocumentType, Prisma, ProductAttributeType, ProductMode, SalesUnit } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { UpsertProductDto, UpdateProductDto, TableQueryDto as ProductQuery } from './dto/product.dto'
import { calculateOrderLineTotals, costPriceFromSale, decimalToNumber, roundCurrency, salePriceFromCost } from './utils/pricing'
import { DashboardFilterDto } from './dto/dashboard.dto'
import type { FastifyRequest } from 'fastify'
import {
  DEFAULT_PAYMENT_METHOD_ID,
  findPaymentMethodById,
  matchPaymentMethod,
} from '../common/constants/payment-methods'
import { findOrderStatusById, matchOrderStatus } from '../common/constants/order-statuses'

type ProductSortKey =
  | 'id'
  | 'name'
  | 'productCode'
  | 'brand'
  | 'vendor'
  | 'salePrice'
  | 'costPrice'
  | 'stock'
  | 'status'
  | 'published'
  | 'category'

type ProductImageInput = {
  id: string
  name?: string
  img: string
}

type NormalizedAttributeValue = {
  key: string
  canonicalKey: string
  label: string
  value: string
  colorHex?: string
  imageUrl?: string
  imageAlt?: string
  sortOrder: number
}

type NormalizedAttribute = {
  type: ProductAttributeType
  name: string
  sortOrder: number
  values: NormalizedAttributeValue[]
}

type NormalizedVariantAttribute = {
  attribute: ProductAttributeType
  value: NormalizedAttributeValue
}

type NormalizedVariant = {
  key: string
  sku?: string
  barcode?: string
  label?: string
  salePrice?: number
  costPrice?: number
  stock?: number
  permanentStock?: boolean
  isActive: boolean
  inheritSalePrice: boolean
  inheritCostPrice: boolean
  inheritStock: boolean
  inheritSku: boolean
  inheritImages: boolean
  attributes: NormalizedVariantAttribute[]
  images: ProductImageInput[]
}

const ATTRIBUTE_DEFAULT_LABELS: Record<ProductAttributeType, string> = {
  [ProductAttributeType.COLOR]: 'Color',
  [ProductAttributeType.SIZE]: 'Talle',
  [ProductAttributeType.MATERIAL]: 'Material',
}

type AttributeInput = NonNullable<UpsertProductDto['attributes']>[number]
type VariantInput = NonNullable<UpsertProductDto['variants']>[number]

type ParametricPricingSummary = {
  currency?: string
  basePrice?: number | null
  mosquiteroPrice?: number | null
  shutterOptions: Record<
    string,
    {
      price?: number | null
      priceMosq?: number | null
    }
  >
}

type ParametricSummary = {
  colors: Set<string>
  glasses: Set<string>
  series: Set<string>
  families: Set<string>
  widths: Set<number>
  heights: Set<number>
  mosquitero: boolean
  monoblock: boolean
  shutterMaterials: Set<string>
  pricing?: ParametricPricingSummary
}

const SALES_UNIT_KEYWORDS: Record<SalesUnit, string[]> = {
  [SalesUnit.UNIT]: ['unit', 'units', 'unidad', 'unidades', 'u'],
  [SalesUnit.SQUARE_METER]: ['squaremeter', 'squaremeters', 'metroscuadrados', 'metrocuadrado', 'metroscuadrado', 'm2', 'sqm', 'mt2'],
  [SalesUnit.LINEAR_METER]: ['linearmeter', 'linearmeters', 'metrolineal', 'metroslineales', 'ml', 'lm'],
}

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private prisma: PrismaService) {}

  private async getTaxRate() {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } })
    const val = Number(cfg?.value ?? '22')
    return Number.isNaN(val) ? 22 : val
  }

  private deriveInventoryStatus(stock?: number | null, permanent?: boolean | null): 0 | 1 | 2 {
    const numericStock = Number(stock ?? 0)
    const normalizedStock = Number.isNaN(numericStock) ? 0 : numericStock
    const isPermanent = Boolean(permanent)
    if (isPermanent) {
      return 0
    }
    if (normalizedStock <= 0) {
      return 2
    }
    if (normalizedStock < 5) {
      return 1
    }
    return 0
  }

  private safeTrim(value?: string | null): string {
    if (typeof value !== 'string') return ''
    return value.trim()
  }

  private toCanonicalKey(raw: string | undefined, fallback: string): string {
    const base = this.safeTrim(raw) || fallback
    const canonical = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return canonical || fallback.toLowerCase()
  }

  private normalizeProductMode(mode?: ProductMode | string): ProductMode {
    if (!mode) {
      return ProductMode.SIMPLE
    }
    if (typeof mode === 'string') {
      const normalized = mode.trim().toUpperCase()
      if (normalized === 'VARIABLE') {
        return ProductMode.VARIABLE
      }
      if (normalized === 'SIMPLE') {
        return ProductMode.SIMPLE
      }
      if (normalized === 'PARAMETRIC') {
        return ProductMode.PARAMETRIC
      }
      return ProductMode.SIMPLE
    }
    return mode
  }

  private buildAttributeValueKey(attributeType: ProductAttributeType, canonicalKey: string): string {
    return `${attributeType}:${canonicalKey}`
  }

  private normalizeAttributesInput(input?: AttributeInput[] | null): NormalizedAttribute[] {
    if (!input || !input.length) {
      return []
    }

    const seenTypes = new Set<ProductAttributeType>()
    const normalized = input.map((attribute, attributeIndex) => {
      if (!attribute) {
        throw new BadRequestException('Invalid attribute definition.')
      }
      const { type } = attribute
      if (!type) {
        throw new BadRequestException('Attribute type is required.')
      }
      if (seenTypes.has(type)) {
        throw new BadRequestException(`Duplicate attribute definition for ${type}.`)
      }
      seenTypes.add(type)

      const name = this.safeTrim(attribute.name) || ATTRIBUTE_DEFAULT_LABELS[type] || type
      const valuesInput = Array.isArray(attribute.values) ? attribute.values : []
      if (!valuesInput.length) {
        throw new BadRequestException(`Attribute "${name}" must define at least one value.`)
      }
      const seenKeys = new Set<string>()
      const normalizedValues = valuesInput.map((value, valueIndex) => {
        if (!value) {
          throw new BadRequestException(`Attribute "${name}" has an invalid value definition.`)
        }
        const fallbackKey = `value-${attributeIndex + 1}-${valueIndex + 1}`
        const canonicalKey = this.toCanonicalKey(value.key, fallbackKey)
        if (seenKeys.has(canonicalKey)) {
          throw new BadRequestException(`Attribute "${name}" has duplicated value key "${canonicalKey}".`)
        }
        seenKeys.add(canonicalKey)

        const labelCandidate = this.safeTrim(value.label) || this.safeTrim(value.value)
        const label = labelCandidate || `Opción ${valueIndex + 1}`
        const storedValue = this.safeTrim(value.value) || label
        const colorHex = this.safeTrim(value.colorHex)
        const imageUrl = this.safeTrim(value.imageUrl)
        const imageAlt = this.safeTrim(value.imageAlt)
        const sortOrder =
          value.sortOrder !== undefined && value.sortOrder !== null ? Number(value.sortOrder) || 0 : valueIndex

        return {
          key: canonicalKey,
          canonicalKey,
          label,
          value: storedValue,
          colorHex: colorHex || undefined,
          imageUrl: imageUrl || undefined,
          imageAlt: imageAlt || undefined,
          sortOrder,
        }
      })

      normalizedValues.sort((a, b) => a.sortOrder - b.sortOrder)

      return {
        type,
        name,
        sortOrder:
          attribute.sortOrder !== undefined && attribute.sortOrder !== null
            ? Number(attribute.sortOrder) || attributeIndex
            : attributeIndex,
        values: normalizedValues,
      }
    })

    normalized.sort((a, b) => a.sortOrder - b.sortOrder)
    return normalized
  }

  private normalizeVariantsInput(variants: VariantInput[] | undefined, attributes: NormalizedAttribute[]): NormalizedVariant[] {
    if (!variants || !variants.length) {
      return []
    }

    const attributeOrder = new Map<ProductAttributeType, number>()
    const attributeValueLookup = new Map<ProductAttributeType, Map<string, NormalizedAttributeValue>>()
    attributes.forEach((attribute, index) => {
      attributeOrder.set(attribute.type, index)
      const valueMap = new Map<string, NormalizedAttributeValue>()
      attribute.values.forEach((value) => {
        valueMap.set(value.canonicalKey, value)
      })
      attributeValueLookup.set(attribute.type, valueMap)
    })

    const seenVariantKeys = new Set<string>()

    return variants.map((variant, variantIndex) => {
      if (!variant) {
        throw new BadRequestException('Invalid variant definition.')
      }

      const variantKey = this.toCanonicalKey(variant.key, `variant-${variantIndex + 1}`)
      if (seenVariantKeys.has(variantKey)) {
        throw new BadRequestException(`Duplicate variant key "${variantKey}".`)
      }
      seenVariantKeys.add(variantKey)

      const selectionsInput = Array.isArray(variant.attributes) ? variant.attributes : []
      if (selectionsInput.length !== attributes.length) {
        throw new BadRequestException('Each variant must include exactly one value for every attribute.')
      }

      const usedAttributes = new Set<ProductAttributeType>()
      const resolvedSelections = selectionsInput.map((selection, selectionIndex) => {
        if (!selection) {
          throw new BadRequestException(`Variant "${variantKey}" contains an invalid attribute selection.`)
        }
        const attributeType = selection.attribute
        if (!attributeOrder.has(attributeType)) {
          throw new BadRequestException(`Variant "${variantKey}" references an unknown attribute.`)
        }
        if (usedAttributes.has(attributeType)) {
          throw new BadRequestException(`Variant "${variantKey}" sets the attribute "${attributeType}" multiple times.`)
        }
        usedAttributes.add(attributeType)

        const canonicalKey = this.toCanonicalKey(selection.valueKey, `value-${variantIndex + 1}-${selectionIndex + 1}`)
        const valuesMap = attributeValueLookup.get(attributeType)
        const resolvedValue = valuesMap?.get(canonicalKey)
        if (!resolvedValue) {
          throw new BadRequestException(
            `Variant "${variantKey}" references an unknown value for attribute "${attributeType}".`,
          )
        }
        return { attribute: attributeType, value: resolvedValue }
      })

      resolvedSelections.sort(
        (a, b) => (attributeOrder.get(a.attribute) ?? 0) - (attributeOrder.get(b.attribute) ?? 0),
      )

      const sku = this.safeTrim(variant.sku)
      const barcode = this.safeTrim(variant.barcode)
      const label = this.safeTrim(variant.label)

      const hasSaleOverride = variant.salePrice !== undefined && variant.salePrice !== null
      const inheritSalePrice =
        variant.inheritSalePrice !== undefined ? Boolean(variant.inheritSalePrice) : !hasSaleOverride
      const salePriceValue = hasSaleOverride ? Number(variant.salePrice) : undefined

      const hasCostOverride = variant.costPrice !== undefined && variant.costPrice !== null
      const inheritCostPrice =
        variant.inheritCostPrice !== undefined ? Boolean(variant.inheritCostPrice) : !hasCostOverride
      const costPriceValue = hasCostOverride ? Number(variant.costPrice) : undefined

      const hasStockOverride = variant.stock !== undefined && variant.stock !== null
      const inheritStock = variant.inheritStock !== undefined ? Boolean(variant.inheritStock) : !hasStockOverride
      const stockValue = hasStockOverride ? Math.max(0, Math.round(Number(variant.stock) || 0)) : undefined
      const permanentStockValue =
        variant.permanentStock === undefined || variant.permanentStock === null
          ? false
          : Boolean(variant.permanentStock)

      const hasSkuOverride = Boolean(sku)
      const inheritSku = variant.inheritSku !== undefined ? Boolean(variant.inheritSku) : !hasSkuOverride

      const hasImageOverride = Array.isArray(variant.images) && variant.images.length > 0
      const inheritImages =
        variant.inheritImages !== undefined ? Boolean(variant.inheritImages) : !hasImageOverride
      const images: ProductImageInput[] = hasImageOverride
        ? variant.images!.map((image, imageIndex) => ({
            id: image.id ?? `variant-img-${variantIndex + 1}-${imageIndex + 1}`,
            name: this.safeTrim(image.name) || undefined,
            img: image.img,
          }))
        : []

      return {
        key: variantKey,
        sku: inheritSku ? undefined : sku || undefined,
        barcode: barcode || undefined,
        label: label || undefined,
        salePrice: inheritSalePrice ? undefined : salePriceValue,
        costPrice: inheritCostPrice ? undefined : costPriceValue,
        stock: inheritStock ? undefined : stockValue,
        permanentStock: inheritStock ? undefined : permanentStockValue,
        isActive: variant.isActive === undefined || variant.isActive === null ? true : Boolean(variant.isActive),
        inheritSalePrice,
        inheritCostPrice,
        inheritStock,
        inheritSku,
        inheritImages,
        attributes: resolvedSelections,
        images,
      }
    })
  }

  private buildVariantCombinationKey(valueIds: number[]): string {
    return valueIds
      .slice()
      .sort((a, b) => a - b)
      .join('-')
  }

  private async replaceProductImages(
    tx: Prisma.TransactionClient,
    productId: number,
    images?: ProductImageInput[] | null,
  ) {
    await tx.productImage.deleteMany({
      where: {
        productId,
        OR: [{ variantId: null }, { variantId: { equals: null } }],
      },
    })

    if (!images || !images.length) {
      return
    }

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index]
      if (!image || !image.img) {
        // Skip invalid entries but keep indexes consistent
        // eslint-disable-next-line no-continue
        continue
      }
      await tx.productImage.create({
        data: {
          productId,
          variantId: null,
          name: this.safeTrim(image.name) || null,
          img: image.img,
          sortOrder: index,
        },
      })
    }
  }

  private async replaceVariantImages(
    tx: Prisma.TransactionClient,
    productId: number,
    variantId: number,
    images?: ProductImageInput[] | null,
  ) {
    await tx.productImage.deleteMany({
      where: {
        productId,
        variantId,
      },
    })

    if (!images || !images.length) {
      return
    }

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index]
      if (!image || !image.img) {
        // eslint-disable-next-line no-continue
        continue
      }
      await tx.productImage.create({
        data: {
          productId,
          variantId,
          name: this.safeTrim(image.name) || null,
          img: image.img,
          sortOrder: index,
        },
      })
    }
  }

  private async clearVariableStructure(tx: Prisma.TransactionClient, productId: number) {
    await tx.productVariant.deleteMany({ where: { productId } })
    await tx.productOption.deleteMany({ where: { productId } })
  }

  private async applyVariableStructure(
    tx: Prisma.TransactionClient,
    product: {
      id: number
      salePrice: Prisma.Decimal | number
      costPrice: Prisma.Decimal | number
      stock: number
      permanentStock: boolean
      currency: string
    },
    attributes: NormalizedAttribute[],
    variants: NormalizedVariant[],
  ): Promise<{ stock: number; permanentStock: boolean; status: 0 | 1 | 2 }> {
    await this.clearVariableStructure(tx, product.id)

    if (!attributes.length || !variants.length) {
      const baseStock = Number(product.stock ?? 0)
      const basePermanent = Boolean(product.permanentStock)
      return {
        stock: baseStock,
        permanentStock: basePermanent,
        status: this.deriveInventoryStatus(baseStock, basePermanent),
      }
    }

    const baseSalePrice = decimalToNumber(product.salePrice)
    const baseCostPrice = decimalToNumber(product.costPrice)
    const baseStock = Number(product.stock ?? 0)
    const basePermanent = Boolean(product.permanentStock)

    const valueByKey = new Map<
      string,
      { id: number; attribute: ProductAttributeType; value: NormalizedAttributeValue }
    >()
    const combinationKeys = new Set<string>()

    for (const attribute of attributes) {
      const createdOption = await tx.productOption.create({
        data: {
          productId: product.id,
          type: attribute.type,
          name: attribute.name,
          sortOrder: attribute.sortOrder,
          values: {
            create: attribute.values.map((value, valueIndex) => ({
              code: value.canonicalKey,
              label: value.label,
              value: value.value,
              colorHex: value.colorHex,
              imageUrl: value.imageUrl,
              imageAlt: value.imageAlt,
              sortOrder: value.sortOrder ?? valueIndex,
            })),
          },
        },
        include: { values: true },
      })

      createdOption.values.forEach((createdValue, index) => {
        const normalizedValue = attribute.values[index]
        if (!normalizedValue) return
        const mapKey = this.buildAttributeValueKey(attribute.type, normalizedValue.canonicalKey)
        valueByKey.set(mapKey, {
          id: createdValue.id,
          attribute: attribute.type,
          value: normalizedValue,
        })
      })
    }

    let hasActiveVariant = false
    let aggregateStatus: 0 | 1 | 2 = 2
    let totalStockOverrides = 0
    let hasVariantStockOverride = false
    let hasVariantPermanentOverride = false

    for (const variant of variants) {
      const selectionEntries = variant.attributes.map((selection) => {
        const key = this.buildAttributeValueKey(selection.attribute, selection.value.canonicalKey)
        const record = valueByKey.get(key)
        if (!record) {
          throw new BadRequestException(
            `Variant "${variant.key}" references an unknown attribute value for "${selection.attribute}".`,
          )
        }
        return record
      })

      const combinationKey = this.buildVariantCombinationKey(selectionEntries.map((entry) => entry.id))
      if (combinationKeys.has(combinationKey)) {
        throw new BadRequestException(`Duplicate variant combination detected for key "${combinationKey}".`)
      }
      combinationKeys.add(combinationKey)

      const fallbackLabel = variant.attributes.map((selection) => selection.value.label).join(' / ')
      const resolvedLabel = this.safeTrim(variant.label) || fallbackLabel || 'Variante'

      const salePriceOverride =
        variant.inheritSalePrice || variant.salePrice === undefined || variant.salePrice === null
          ? null
          : roundCurrency(Number.isFinite(variant.salePrice) ? variant.salePrice! : baseSalePrice)
      const costPriceOverride =
        variant.inheritCostPrice || variant.costPrice === undefined || variant.costPrice === null
          ? null
          : roundCurrency(Number.isFinite(variant.costPrice) ? variant.costPrice! : baseCostPrice)

      const normalizedStock =
        variant.stock === undefined || variant.stock === null
          ? 0
          : Math.max(0, Math.round(Number(variant.stock) || 0))
      const stockOverride = variant.inheritStock ? null : normalizedStock

      const permanentOverride =
        variant.inheritStock || variant.permanentStock === undefined || variant.permanentStock === null
          ? null
          : Boolean(variant.permanentStock)

      const skuOverride = variant.inheritSku ? null : this.safeTrim(variant.sku) || null
      const barcode = this.safeTrim(variant.barcode) || null

      const attributesJson = variant.attributes.map((selection) => ({
        attribute: selection.attribute,
        key: selection.value.key,
        label: selection.value.label,
        value: selection.value.value,
        colorHex: selection.value.colorHex ?? null,
        imageUrl: selection.value.imageUrl ?? null,
        imageAlt: selection.value.imageAlt ?? null,
      }))

      const createdVariant = await tx.productVariant.create({
        data: {
          productId: product.id,
          key: variant.key,
          sku: skuOverride,
          barcode,
          label: resolvedLabel,
          salePrice: salePriceOverride,
          costPrice: costPriceOverride,
          stock: stockOverride,
          permanentStock: permanentOverride,
          isActive: variant.isActive,
          inheritSalePrice: variant.inheritSalePrice,
          inheritCostPrice: variant.inheritCostPrice,
          inheritStock: variant.inheritStock,
          inheritSku: variant.inheritSku,
          inheritImages: variant.inheritImages,
          attributes: attributesJson,
          combinationKey,
          selections: {
            create: selectionEntries.map((entry) => ({
              optionValueId: entry.id,
            })),
          },
        },
      })

      if (!variant.inheritImages || (variant.images && variant.images.length > 0)) {
        await this.replaceVariantImages(tx, product.id, createdVariant.id, variant.images)
      }

      if (variant.isActive) {
        hasActiveVariant = true
        const effectiveStock = variant.inheritStock ? baseStock : stockOverride ?? 0
        const effectivePermanent = variant.inheritStock ? basePermanent : Boolean(permanentOverride)
        const status = this.deriveInventoryStatus(effectiveStock, effectivePermanent)
        const nextStatus = Math.min(aggregateStatus, status as 0 | 1 | 2) as 0 | 1 | 2
        aggregateStatus = nextStatus
        if (!variant.inheritStock) {
          hasVariantStockOverride = true
          totalStockOverrides += stockOverride ?? 0
          if (permanentOverride) {
            hasVariantPermanentOverride = true
          }
        }
      }
    }

    if (!hasActiveVariant) {
      aggregateStatus = this.deriveInventoryStatus(baseStock, basePermanent)
    } else if (!hasVariantStockOverride) {
      const fallbackStatus = this.deriveInventoryStatus(baseStock, basePermanent) as 0 | 1 | 2
      aggregateStatus = Math.min(aggregateStatus, fallbackStatus) as 0 | 1 | 2
    }

    const finalStock = hasVariantStockOverride ? totalStockOverrides : baseStock
    const finalPermanent = hasVariantStockOverride ? hasVariantPermanentOverride : basePermanent

    return {
      stock: finalStock,
      permanentStock: finalPermanent,
      status: aggregateStatus,
    }
  }

  private startOfDay(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private dayKey(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private formatCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    const str = String(value)
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  private buildCsv(rows: unknown[][]): string {
    return rows.map((row) => row.map((cell) => this.formatCsvValue(cell)).join(',')).join('\n')
  }

  private buildSummaryField(set?: Set<string>) {
    if (!set || set.size === 0) {
      return ''
    }
    return Array.from(set).join(', ')
  }

  private buildDimensionSummary(set?: Set<number>) {
    if (!set || set.size === 0) {
      return ''
    }
    const values = Array.from(set)
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
    if (!values.length) {
      return ''
    }
    const formatValue = (value: number) => `${Math.round(value)}`
    if (values.length === 1 || values[0] === values[values.length - 1]) {
      return formatValue(values[0])
    }
    if (values.length <= 4) {
      return values.map(formatValue).join(', ')
    }
    return `${formatValue(values[0])} - ${formatValue(values[values.length - 1])}`
  }

  private buildProductSpecifications(summary?: ParametricSummary) {
    if (!summary) {
      return null
    }
    const serie = this.buildSummaryField(summary.series) || '-'
    const vidrio = this.buildSummaryField(summary.glasses) || '-'
    const color = this.buildSummaryField(summary.colors) || '-'
    const mosq = summary.mosquitero ? 'Sí' : 'No'
    const monoblockLabel = (() => {
      if (!summary.monoblock) {
        return 'No'
      }
      const materials = this.buildSummaryField(summary.shutterMaterials)
      return materials ? `Sí (${materials})` : 'Sí'
    })()
    return `Serie: ${serie} • Vidrio: ${vidrio} • Color: ${color} • Mosquitero: ${mosq} • Monoblock: ${monoblockLabel}`
  }

  private pickFirstFromSet<T>(set?: Set<T>): T | undefined {
    if (!set || set.size === 0) {
      return undefined
    }
    const iterator = set.values().next()
    return iterator.value
  }

  private resolveDimensionValue(set?: Set<number>) {
    const value = this.pickFirstFromSet(set)
    if (value === undefined || value === null) {
      return undefined
    }
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return undefined
    }
    return Math.round(numeric)
  }

  private normalizeSkuToken(value?: string | null) {
    const trimmed = this.safeTrim(value)
    if (!trimmed) {
      return ''
    }
    return trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '')
      .toUpperCase()
  }

  private buildProductTypeCode(familyId?: string) {
    if (!familyId) {
      return ''
    }
    const ascii = familyId
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_ ]+/g, ' ')
    const parts = ascii
      .split(/[_\s]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
    if (!parts.length) {
      return ''
    }
    const candidate = parts.length > 1 ? parts[1] : parts[0]
    const normalized = this.normalizeSkuToken(candidate)
    return normalized.length <= 4 ? normalized : normalized.substring(0, 4)
  }

  private buildParametricSku(productName: string, productCode?: string | null, summary?: ParametricSummary) {
    const typeCode = this.buildProductTypeCode(this.pickFirstFromSet(summary?.families))
    const width = this.resolveDimensionValue(summary?.widths)
    const height = this.resolveDimensionValue(summary?.heights)
    const cleanedName = productName.replace(/\(.*?\)/g, ' ')
    const base =
      this.normalizeSkuToken(productCode) ||
      this.normalizeSkuToken(this.pickFirstFromSet(summary?.series)) ||
      this.normalizeSkuToken(cleanedName)
    if (!base) {
      if (width && height) {
        const sizeOnly = `${width}x${height}`
        return [typeCode, sizeOnly].filter(Boolean).join('-')
      }
      return typeCode
    }
    if (!width || !height) {
      return [typeCode, base].filter(Boolean).join('-')
    }
    const sizePart = `${width}x${height}`
    return [typeCode, base, sizePart].filter(Boolean).join('-')
  }

  private async collectParametricSummaries(productIds: number[]) {
    const summaryMap = new Map<number, ParametricSummary>()
    if (!productIds || productIds.length === 0) {
      return summaryMap
    }
    const matrixRows = await this.prisma.dimensionPriceMatrix.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        familyId: true,
        serie: true,
        color: true,
        vidrio: true,
        widthMm: true,
        heightMm: true,
        hasMosquitero: true,
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
        hasShutterMonoblock: true,
        shutterSystem: true,
        price: true,
        priceBase: true,
        priceMosquitero: true,
        priceMonoblock: true,
        priceMonoblockMosquitero: true,
        currency: true,
      },
    })
    for (const row of matrixRows) {
      const entry =
        summaryMap.get(row.productId) ??
        {
          colors: new Set<string>(),
          glasses: new Set<string>(),
          series: new Set<string>(),
          families: new Set<string>(),
          widths: new Set<number>(),
          heights: new Set<number>(),
          mosquitero: false,
          monoblock: false,
          shutterMaterials: new Set<string>(),
          pricing: undefined,
        }
      const family = this.safeTrim(row.familyId)
      const serie = this.safeTrim(row.serie)
      const color = this.safeTrim(row.color)
      const vidrio = this.safeTrim(row.vidrio)
      const width = Number(row.widthMm)
      const height = Number(row.heightMm)
      if (family) {
        entry.families.add(family)
      }
      if (serie) {
        entry.series.add(serie)
      }
      if (color) {
        entry.colors.add(color)
      }
      if (vidrio) {
        entry.glasses.add(vidrio)
      }
      if (Number.isFinite(width) && width > 0) {
        entry.widths.add(width)
      }
      if (Number.isFinite(height) && height > 0) {
        entry.heights.add(height)
      }
      if (row.hasMosquitero || row.hasMosquiteroOption) {
        entry.mosquitero = true
      }
      const priceBase =
        !row.hasShutterMonoblock && !row.hasMosquitero
          ? decimalToNumber(row.priceBase ?? row.price)
          : 0
      const priceMosq =
        row.hasMosquitero && !row.hasShutterMonoblock
          ? decimalToNumber(row.priceMosquitero)
          : 0
      const priceMonoblock = decimalToNumber(row.priceMonoblock)
      const priceMonoblockMosq = decimalToNumber(row.priceMonoblockMosquitero)
      if (!entry.pricing) {
        entry.pricing = {
          currency: row.currency || 'USD',
          basePrice: priceBase > 0 ? priceBase : undefined,
          mosquiteroPrice: priceMosq > 0 ? priceMosq : undefined,
          shutterOptions: {},
        }
      } else {
        if (!entry.pricing.currency && row.currency) {
          entry.pricing.currency = row.currency
        }
        if (priceBase > 0) {
          entry.pricing.basePrice = priceBase
        }
        if (priceMosq > 0) {
          entry.pricing.mosquiteroPrice = priceMosq
        }
      }
      if (row.hasMonoblockOption) {
        entry.monoblock = true
      }
      const shutter = this.safeTrim(row.shutterSystem) || 'GENERIC'
      const shouldRegisterShutter =
        (row.hasShutterMonoblock || row.hasMonoblockOption) &&
        (priceMonoblock > 0 || priceMonoblockMosq > 0)
      if (shouldRegisterShutter) {
        if (shutter) {
          entry.shutterMaterials.add(shutter)
        }
        entry.pricing = entry.pricing ?? {
          currency: row.currency || 'USD',
          basePrice: priceBase > 0 ? priceBase : undefined,
          mosquiteroPrice: priceMosq > 0 ? priceMosq : undefined,
          shutterOptions: {},
        }
        entry.pricing.shutterOptions[shutter || 'GENERIC'] = {
          price: priceMonoblock > 0 ? priceMonoblock : null,
          priceMosq: priceMonoblockMosq > 0 ? priceMonoblockMosq : null,
        }
      }
      summaryMap.set(row.productId, entry)
    }
    return summaryMap
  }

  private normalizeProductSortKey(raw?: string | null): ProductSortKey | undefined {
    const key = raw?.toString()?.trim()
    if (!key) return undefined
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    switch (normalized) {
      case 'id':
        return 'id'
      case 'name':
        return 'name'
      case 'productcode':
        return 'productCode'
      case 'brand':
        return 'brand'
      case 'vendor':
        return 'vendor'
      case 'price':
      case 'saleprice':
      case 'precioventa':
        return 'salePrice'
      case 'costprice':
      case 'preciocosto':
      case 'costperitem':
        return 'costPrice'
      case 'stock':
        return 'stock'
      case 'status':
        return 'status'
      case 'published':
        return 'published'
      case 'category':
        return 'category'
      default:
        return undefined
    }
  }

  private normalizeSortDirection(raw?: string | null): 'asc' | 'desc' | undefined {
    const direction = raw?.toString()?.toLowerCase?.() ?? ''
    if (direction === 'asc' || direction === 'ascending' || direction === 'ascend') return 'asc'
    if (direction === 'desc' || direction === 'descending' || direction === 'descend') return 'desc'
    return undefined
  }

  private buildProductOrderBy(sort?: { key?: string; order?: 'asc' | 'desc' | '' }): Prisma.ProductOrderByWithRelationInput[] {
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
    const key = this.normalizeProductSortKey(sort?.key)
    const order = this.normalizeSortDirection(sort?.order ?? '')
    if (key && order) {
      switch (key) {
        case 'id':
          orderBy.push({ id: order })
          break
        case 'name':
          orderBy.push({ name: order })
          break
        case 'productCode':
          orderBy.push({ productCode: order })
          break
        case 'brand':
          orderBy.push({ brand: order })
          break
        case 'vendor':
          orderBy.push({ vendor: order })
          break
        case 'salePrice':
          orderBy.push({ salePrice: order })
          break
        case 'costPrice':
          orderBy.push({ costPrice: order })
          break
        case 'stock':
          orderBy.push({ stock: order })
          break
        case 'status':
          orderBy.push({ status: order })
          break
        case 'published':
          orderBy.push({ published: order })
          break
        case 'category':
          orderBy.push({ category: { name: order } })
          break
      }
    }
    // Ensure deterministic fallback order
    orderBy.push({ id: 'desc' })
    return orderBy
  }

  private buildProductWhere(dto: ProductQuery): Prisma.ProductWhereInput {
    const andConditions: Prisma.ProductWhereInput[] = []

    const parseFilterData = (input: unknown): Record<string, unknown> | undefined => {
      if (!input) return undefined
      if (typeof input === 'string') {
        try {
          const parsed = JSON.parse(input)
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
        } catch {
          return undefined
        }
      }
      if (typeof input === 'object') {
        return input as Record<string, unknown>
      }
      return undefined
    }

    const appendSearch = (value?: string | null) => {
      const term = value?.toString()?.trim()
      if (!term) return
      andConditions.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { productCode: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
          { vendor: { contains: term, mode: 'insensitive' } },
        ],
      })
    }

    appendSearch(dto.query)
    const filterData = parseFilterData((dto as any)?.filterData)
    const filterName = filterData?.name
    if (typeof filterName === 'string') {
      appendSearch(filterName)
    }

    const currencySelection = filterData?.currency
    const currencyList: string[] = []
    const pushCurrency = (value: unknown) => {
      if (typeof value !== 'string' && typeof value !== 'number') return
      const normalized = String(value).trim().toUpperCase()
      if (!normalized || !/^[A-Z]{3,5}$/.test(normalized)) return
      if (!currencyList.includes(normalized)) {
        currencyList.push(normalized)
      }
    }
    if (Array.isArray(currencySelection)) {
      for (const item of currencySelection) {
        pushCurrency(item)
      }
    } else if (currencySelection !== undefined && currencySelection !== null) {
      pushCurrency(currencySelection)
    }
    if (currencyList.length) {
      andConditions.push({
        currency: { in: currencyList },
      })
    }

    const modeSelection = filterData?.mode
    const modeList: ProductMode[] = []
    const pushMode = (value: unknown) => {
      if (typeof value !== 'string') return
      const normalized = value.trim().toUpperCase()
      switch (normalized) {
        case 'SIMPLE':
          if (!modeList.includes(ProductMode.SIMPLE)) {
            modeList.push(ProductMode.SIMPLE)
          }
          break
        case 'VARIABLE':
          if (!modeList.includes(ProductMode.VARIABLE)) {
            modeList.push(ProductMode.VARIABLE)
          }
          break
        case 'PARAMETRIC':
          if (!modeList.includes(ProductMode.PARAMETRIC)) {
            modeList.push(ProductMode.PARAMETRIC)
          }
          break
        default:
          break
      }
    }
    if (Array.isArray(modeSelection)) {
      for (const item of modeSelection) {
        pushMode(item)
      }
    } else if (modeSelection !== undefined && modeSelection !== null) {
      pushMode(modeSelection)
    }
    if (modeList.length === 1) {
      andConditions.push({ mode: modeList[0] })
    } else if (modeList.length > 1) {
      andConditions.push({ mode: { in: modeList } })
    }

    if (!andConditions.length) return {}
    return { AND: andConditions }
  }

  private normalizeHeaderKey(key: string | undefined | null): string {
    if (!key) return ''
    return key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private parseCsv(content: string): string[][] {
    const normalized = content.replace(/^\uFEFF/, '')
    const lines = normalized.split(/\r?\n/)
    const rows: string[][] = []
    for (const rawLine of lines) {
      if (!rawLine || !rawLine.trim()) continue
      const cells: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < rawLine.length; i += 1) {
        const ch = rawLine[i]
        if (ch === '"') {
          if (inQuotes && rawLine[i + 1] === '"') {
            current += '"'
            i += 1
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(current)
          current = ''
        } else {
          current += ch
        }
      }
      cells.push(current)
      rows.push(cells.map((cell) => cell.trim()))
    }
    return rows
  }

  private getCell(row: string[], columnIndex: Map<string, number>, key: string, aliases: string[] = []): string {
    const keys = [key, ...aliases]
    for (const candidate of keys) {
      const normalized = this.normalizeHeaderKey(candidate)
      if (!normalized) continue
      const idx = columnIndex.get(normalized)
      if (idx !== undefined) {
        return (row[idx] ?? '').trim()
      }
    }
    return ''
  }

  private parseNumber(value?: string | number | null): number {
    if (value === null || value === undefined) return 0
    const raw = typeof value === 'number' ? value.toString() : value
    const trimmed = raw.trim()
    if (!trimmed) return 0
    const numericLike = trimmed.replace(/\s+/g, '')
    const dotNormalized =
      numericLike.includes(',') && !numericLike.includes('.')
        ? numericLike.replace(/,/g, '.')
        : numericLike.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '')
    const direct = Number(dotNormalized)
    if (!Number.isNaN(direct)) return direct
    const fallback = Number(dotNormalized.replace(/[^0-9.\-]/g, ''))
    return Number.isNaN(fallback) ? 0 : fallback
  }

  private parseDate(value?: string | number | null): Date | undefined {
    if (value === null || value === undefined) return undefined
    const raw = typeof value === 'number' ? value.toString() : value
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    const num = Number(trimmed)
    if (!Number.isNaN(num) && trimmed.length <= 13) {
      const millis = trimmed.length <= 10 ? num * 1000 : num
      const dateFromNum = new Date(millis)
      if (!Number.isNaN(dateFromNum.getTime())) return dateFromNum
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed
    return undefined
  }

  private parseOptionalBoolean(raw: unknown): boolean | undefined {
    if (raw === null || raw === undefined) return undefined
    if (typeof raw === 'boolean') return raw
    const str = raw.toString().trim()
    if (!str) return undefined
    const normalized = str.toLowerCase()
    if (['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
    return undefined
  }

  private parseSalesUnit(raw: unknown): SalesUnit | undefined {
    if (raw === null || raw === undefined) return undefined
    const str = raw.toString().trim()
    if (!str) return undefined
    const upper = str.toUpperCase()
    if ((Object.values(SalesUnit) as string[]).includes(upper)) {
      return upper as SalesUnit
    }
    const normalized = str
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w]+/g, '')

    for (const [unit, keywords] of Object.entries(SALES_UNIT_KEYWORDS) as [SalesUnit, string[]][]) {
      if (keywords.includes(normalized)) {
        return unit
      }
    }

    return undefined
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    const trimmed = value?.toString?.().trim?.()
    return trimmed ? trimmed : undefined
  }

  private splitTags(value?: string | null): string[] | undefined {
    const normalized = this.normalizeOptionalString(value)
    if (!normalized) return undefined
    const items = normalized
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
    return items.length ? items : undefined
  }

  private async resolveCategoryId(
    name: string | undefined,
    cache: Map<string, number>,
  ): Promise<number | undefined> {
    const normalized = this.normalizeOptionalString(name)
    if (!normalized) return undefined
    const key = normalized.toLowerCase()
    if (cache.has(key)) return cache.get(key)
    let category = await this.prisma.productCategory.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' } },
    })
    if (!category) {
      category = await this.prisma.productCategory.create({ data: { name: normalized } })
    }
    cache.set(key, category.id)
    return category.id
  }

  private async resolveCustomer(
    email: string,
    name: string,
    phone: string,
    cache: Map<string, any>,
  ) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) throw new Error('customerEmail is required')
    const cached = cache.get(normalizedEmail)
    if (cached) return cached

    let customer = await this.prisma.customer.findFirst({ where: { email: normalizedEmail } })
    const trimmedName = name?.trim?.() || normalizedEmail
    const phoneNumber = phone?.trim?.() || undefined

    if (!customer) {
      const parts = trimmedName.split(/\s+/).filter(Boolean)
      const firstName = parts.shift() || ''
      const lastName = parts.join(' ')
      customer = await this.prisma.customer.create({
        data: {
          email: normalizedEmail,
          name: trimmedName,
          firstName: firstName || null,
          lastName: lastName || null,
          phoneNumber: phoneNumber || null,
        },
      })
    } else {
      const updates: Prisma.CustomerUpdateInput = {}
      if (trimmedName && (!customer.name || customer.name !== trimmedName)) {
        updates.name = trimmedName
      }
      if (trimmedName && (!customer.firstName || !customer.lastName)) {
        const parts = trimmedName.split(/\s+/).filter(Boolean)
        if (!customer.firstName && parts[0]) updates.firstName = parts[0]
        if (!customer.lastName && parts.length > 1) updates.lastName = parts.slice(1).join(' ')
      }
      if (phoneNumber && !customer.phoneNumber) {
        updates.phoneNumber = phoneNumber
      }
      if (Object.keys(updates).length > 0) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: updates,
        })
      }
    }
    cache.set(normalizedEmail, customer)
    return customer
  }

  private async resolvePaymentMethod(
    methodName: string,
    cache: Map<string, number>,
  ): Promise<number | undefined> {
    const normalizedName = (methodName || '').trim()
    const key = normalizedName.toLowerCase() || 'default'
    if (cache.has(key)) return cache.get(key)

    const definition =
      matchPaymentMethod(normalizedName) ??
      matchPaymentMethod(key)

    if (definition) {
      cache.set(key, definition.id)
      return definition.id
    }

    const numeric = Number(normalizedName)
    if (normalizedName && Number.isFinite(numeric) && numeric > 0) {
      const byId = findPaymentMethodById(numeric)
      if (byId) {
        cache.set(key, byId.id)
        return byId.id
      }
    }

    cache.set(key, DEFAULT_PAYMENT_METHOD_ID)
    return DEFAULT_PAYMENT_METHOD_ID
  }

  private async resolveStatus(
    row: string[],
    columnIndex: Map<string, number>,
    byId: Map<number, number>,
    byName: Map<string, number>,
    fallbackId?: number,
  ): Promise<number | undefined> {
    const rawStatusId = this.getCell(row, columnIndex, 'statusId', ['status'])
    const numericStatus = rawStatusId ? Math.round(this.parseNumber(rawStatusId)) : 0
    if (numericStatus > 0) {
      if (byId.has(numericStatus)) return byId.get(numericStatus)
      const definition = findOrderStatusById(numericStatus)
      if (definition && definition.documentTypes.includes(DocumentType.ORDER)) {
        byId.set(definition.id, definition.id)
        if (definition.label) byName.set(definition.label.toLowerCase(), definition.id)
        return definition.id
      }
    }
    const rawStatusName = this.getCell(row, columnIndex, 'statusName')
    if (rawStatusName) {
      const normalizedName = rawStatusName.trim().toLowerCase()
      if (normalizedName && byName.has(normalizedName)) {
        return byName.get(normalizedName)
      }
      const matched = matchOrderStatus(rawStatusName, DocumentType.ORDER)
      if (matched) {
        byId.set(matched.id, matched.id)
        byName.set(normalizedName, matched.id)
        return matched.id
      }
    }
    return fallbackId
  }

  @Post('dashboard')
  async dashboard(@Body() dto: DashboardFilterDto) {
    const { startDate, endDate } = dto ?? {}
    const dateRange: Prisma.DateTimeFilter = {}
    if (typeof startDate === 'number' && !Number.isNaN(startDate)) {
      dateRange.gte = new Date(startDate * 1000)
    }
    if (typeof endDate === 'number' && !Number.isNaN(endDate)) {
      dateRange.lte = new Date(endDate * 1000)
    }

    const where: Prisma.OrderWhereInput = { documentType: DocumentType.ORDER }
    if (Object.keys(dateRange).length > 0) {
      where.date = dateRange
    }

    // Revenue and orders
    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
    })
    let revenue = 0
    let totalCost = 0

    // Report categories and series based on selected range
    const categories: number[] = []
    const revenueSeries: number[] = []
    const netIncomeSeries: number[] = []

    const revenueByDay = new Map<string, number>()
    const netIncomeByDay = new Map<string, number>()
    const revenueByMonth = new Map<string, number>()
    const netIncomeByMonth = new Map<string, number>()
    const hourlyRevenue = Array.from({ length: 24 }, () => 0)
    const hourlyNetIncome = Array.from({ length: 24 }, () => 0)
    const qtyByProduct = new Map<number, number>()
    for (const order of orders) {
      const orderDateObj = new Date(order.date)
      const date = this.startOfDay(orderDateObj)
      const key = this.dayKey(date)
      let orderSales = 0
      let orderCost = 0
      for (const item of order.items) {
        const qty = item.qty || 0
        if (item.productId) {
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty)
        }
        const { saleTotal: lineSale, costTotal: lineCost } = calculateOrderLineTotals({
          price: item.price,
          qty: item.qty,
          product: item.product ?? undefined,
        })
        orderSales += lineSale
        orderCost += lineCost
      }
      revenue += orderSales
      totalCost += orderCost
      const orderNetIncome = orderSales - orderCost
      const currentRevenue = revenueByDay.get(key) ?? 0
      revenueByDay.set(key, currentRevenue + orderSales)
      netIncomeByDay.set(key, (netIncomeByDay.get(key) ?? 0) + orderNetIncome)
      const monthKey = `${orderDateObj.getFullYear()}-${orderDateObj.getMonth()}`
      revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) ?? 0) + orderSales)
      netIncomeByMonth.set(monthKey, (netIncomeByMonth.get(monthKey) ?? 0) + orderNetIncome)
      const hour = orderDateObj.getHours()
      if (hour >= 0 && hour < 24) {
        hourlyRevenue[hour] += orderSales
        hourlyNetIncome[hour] += orderNetIncome
      }
    }

    let rangeStart = typeof startDate === 'number' ? this.startOfDay(new Date(startDate * 1000)) : undefined
    let rangeEnd = typeof endDate === 'number' ? this.startOfDay(new Date(endDate * 1000)) : undefined

    if (!rangeStart && orders.length > 0) {
      const minDate = orders.reduce((min, order) => {
        const current = this.startOfDay(new Date(order.date))
        return current < min ? current : min
      }, this.startOfDay(new Date(orders[0].date)))
      rangeStart = minDate
    }

    if (!rangeEnd && orders.length > 0) {
      const maxDate = orders.reduce((max, order) => {
        const current = this.startOfDay(new Date(order.date))
        return current > max ? current : max
      }, this.startOfDay(new Date(orders[0].date)))
      rangeEnd = maxDate
    }

    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      const today = this.startOfDay(new Date())
      rangeStart = today
      rangeEnd = today
    }

    const dayMs = 24 * 60 * 60 * 1000
    const totalSpanDays =
      rangeEnd && rangeStart
        ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / dayMs)
        : 0
    const isSingleDayRange = !rangeStart || !rangeEnd ? true : totalSpanDays <= 0
    const isFullYearRange =
      !!rangeStart &&
      !!rangeEnd &&
      rangeStart.getFullYear() === rangeEnd.getFullYear() &&
      rangeStart.getMonth() === 0 &&
      rangeStart.getDate() === 1 &&
      rangeEnd.getMonth() === 11

    const granularity: 'hour' | 'day' | 'month' = isSingleDayRange
      ? 'hour'
      : isFullYearRange
        ? 'month'
        : 'day'

    if (granularity === 'hour') {
      const base = rangeStart ?? this.startOfDay(new Date())
      for (let hour = 0; hour < 24; hour++) {
        const bucketTime = new Date(base)
        bucketTime.setHours(hour, 0, 0, 0)
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        revenueSeries.push(
          Math.round((hourlyRevenue[hour] + Number.EPSILON) * 100) / 100,
        )
        netIncomeSeries.push(
          Math.round((hourlyNetIncome[hour] + Number.EPSILON) * 100) / 100,
        )
      }
    } else if (granularity === 'month') {
      const year = rangeStart?.getFullYear() ?? new Date().getFullYear()
      for (let month = 0; month < 12; month++) {
        const bucketTime = new Date(year, month, 1)
        const monthKey = `${year}-${month}`
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        revenueSeries.push(
          Math.round(((revenueByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
        netIncomeSeries.push(
          Math.round(((netIncomeByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
      }
    } else {
      for (let ts = rangeStart.getTime(); ts <= rangeEnd.getTime(); ts += dayMs) {
        const current = new Date(ts)
        current.setHours(0, 0, 0, 0)
        const key = this.dayKey(current)
        const bucketRevenue = revenueByDay.get(key) ?? 0
        const bucketNetIncome = netIncomeByDay.get(key) ?? 0
        categories.push(Math.floor(current.getTime() / 1000))
        revenueSeries.push(
          Math.round((bucketRevenue + Number.EPSILON) * 100) / 100,
        )
        netIncomeSeries.push(
          Math.round((bucketNetIncome + Number.EPSILON) * 100) / 100,
        )
      }
    }

    // Top products by sold qty
    const products = await this.prisma.product.findMany()
    const topProducts = products
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        img: p.img || '',
        sold: qtyByProduct.get(p.id) || 0,
        specifications: (p as any).specifications ?? undefined,
      }))
      .filter((p) => p.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6)

    // Latest orders short list
    const latest = await this.prisma.order.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { customer: true },
      take: 8,
    })
    const latestOrderData = latest.map((o) => {
      const paymentMethod = findPaymentMethodById(o.paymentMethodId ?? null)
      return {
        id: String(o.id),
        date: Math.floor(new Date(o.date).getTime() / 1000),
        customer: o.customer?.name || '',
        status: o.statusId || 0,
        paymentMehod: paymentMethod?.label || '',
        paymentIdendifier: '',
        totalAmount: o.grandTotal,
      }
    })

    // Sales by categories
    const cats = await this.prisma.productCategory.findMany({ include: { products: true } })
    const categorySummary = cats
      .map((category) => {
        const label = category.name?.trim()
        const value = category.products.reduce(
          (sum, product) => sum + (qtyByProduct.get(product.id) || 0),
          0,
        )
        return { label, value }
      })
      .filter((item) => Boolean(item.label))
      .sort((a, b) => b.value - a.value)
    const categoryLabels = categorySummary.map((item) => item.label as string)
    const categoryTotals = categorySummary.map((item) => item.value)

    const netIncome = revenue - totalCost

    return {
      statisticData: {
        orders: { value: orders.length, growShrink: 0 },
        revenue: { value: Math.round(revenue * 100) / 100, growShrink: 0 },
        netIncome: { value: Math.round(netIncome * 100) / 100, growShrink: 0 },
      },
      salesReportData: {
        series: [
          { name: 'Revenue', data: revenueSeries },
          { name: 'Net Income', data: netIncomeSeries },
        ],
        categories,
        granularity,
      },
      topProductsData: topProducts,
      latestOrderData,
      salesByCategoriesData: { labels: categoryLabels, data: categoryTotals },
    }
  }

  // Products
  @Post('products')
  async listProducts(@Body() dto: ProductQuery) {
    const where = this.buildProductWhere(dto)
    const total = await this.prisma.product.count({ where })
    const pageIndex = Number(dto.pageIndex || 1)
    const pageSize = Number(dto.pageSize || 50)

    const orderBy = this.buildProductOrderBy(dto.sort)

    const rows = await this.prisma.product.findMany({
      where,
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        productCode: true,
        img: true,
        salePrice: true,
        costPrice: true,
        currency: true,
        unitOfMeasure: true,
        stock: true,
        permanentStock: true,
        status: true,
        published: true,
        tags: true,
        brand: true,
        vendor: true,
        mode: true,
        category: { select: { name: true } },
        specifications: true,
      },
    })
    const parametricSummary = await this.collectParametricSummaries(
      rows.filter((row) => row.mode === ProductMode.PARAMETRIC).map((row) => row.id),
    )

    const data = rows.map((p) => {
      const summary = parametricSummary.get(p.id)
      const derivedSku =
        p.mode === ProductMode.PARAMETRIC
          ? this.buildParametricSku(p.name, p.productCode, summary)
          : p.productCode || ''
      const productCodeValue = p.productCode || derivedSku || ''
      return {
        id: String(p.id),
        name: p.name,
        productCode: productCodeValue,
        img: p.img || '',
        category: (p as any).category?.name || '',
        salePrice: (() => {
          const raw = decimalToNumber(p.salePrice)
          return Number.isFinite(raw) ? Math.round(raw) : 0
        })(),
        costPrice: decimalToNumber(p.costPrice),
        currency: p.currency,
        unitOfMeasure: p.unitOfMeasure,
        stock: p.stock,
        permanentStock: p.permanentStock,
        status: this.deriveInventoryStatus(p.stock, p.permanentStock),
        published: p.published,
        tags: (p as any).tags || [],
        brand: p.brand || '',
        vendor: p.vendor || '',
        specifications: this.buildProductSpecifications(summary) ?? p.specifications ?? '',
        widthSummary: this.buildDimensionSummary(summary?.widths),
        heightSummary: this.buildDimensionSummary(summary?.heights),
        serieSummary: this.buildSummaryField(summary?.series),
        colorSummary: this.buildSummaryField(summary?.colors),
        glassSummary: this.buildSummaryField(summary?.glasses),
        mosquiteroAvailable: Boolean(summary?.mosquitero),
        monoblockAvailable: Boolean(summary?.monoblock),
        shutterMaterialSummary: this.buildSummaryField(summary?.shutterMaterials),
        parametricPricing: summary?.pricing ?? null,
        parametricSku: derivedSku,
        mode: p.mode,
      }
    })
    return { data, total }
  }

  @Post('products/export')
  async exportProducts(@Body() dto: ProductQuery): Promise<StreamableFile> {
    const where = this.buildProductWhere(dto)
    const orderBy = this.buildProductOrderBy(dto.sort)
    const products = await this.prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: { select: { name: true } },
      },
    })

    const statusLabel: Record<number, string> = {
      0: 'In Stock',
      1: 'Limited',
      2: 'Out of Stock',
    }

    const header: unknown[] = [
      'id',
      'name',
      'description',
      'productCode',
      'brand',
      'vendor',
      'category',
      'salePrice',
      'costPrice',
      'currency',
      'unitOfMeasure',
      'stock',
      'status',
      'statusLabel',
      'permanentStock',
      'published',
      'mode',
      'tags',
      'specifications',
      'createdAt',
      'updatedAt',
    ]

    const rows: unknown[][] = products.map((product) => {
      const statusValue = Number(product.status ?? this.deriveInventoryStatus(product.stock, product.permanentStock))
      const salePriceValue =
        product.salePrice !== null && product.salePrice !== undefined
          ? decimalToNumber(product.salePrice).toFixed(2)
          : ''
      const costPriceValue =
        product.costPrice !== null && product.costPrice !== undefined
          ? decimalToNumber(product.costPrice).toFixed(2)
          : ''
      const tags = Array.isArray(product.tags) ? product.tags.join('|') : ''
      const created =
        product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt ?? undefined)
      const updated =
        product.updatedAt instanceof Date ? product.updatedAt : new Date(product.updatedAt ?? undefined)
      return [
        product.id,
        product.name,
        product.description ?? '',
        product.productCode ?? '',
        product.brand ?? '',
        product.vendor ?? '',
        product.category?.name ?? '',
        salePriceValue,
        costPriceValue,
        product.currency ?? '',
        product.unitOfMeasure ?? SalesUnit.UNIT,
        product.stock ?? 0,
        statusValue,
        statusLabel[statusValue] ?? '',
        product.permanentStock ? 'true' : 'false',
        product.published ? 'true' : 'false',
        product.mode ?? ProductMode.SIMPLE,
        tags,
        product.specifications ?? '',
        Number.isNaN(created.getTime()) ? '' : created.toISOString(),
        Number.isNaN(updated.getTime()) ? '' : updated.toISOString(),
      ]
    })

    const csv = this.buildCsv([header, ...rows])
    const filename = `products-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    })
  }

  @Post('products/import')
  async importProducts(@Req() req: FastifyRequest) {
    const file = await (req as any)?.file?.()
    if (!file) throw new BadRequestException('sales.productList.import.fileRequired')
    const buffer = await file.toBuffer()
    if (!buffer || buffer.length === 0) throw new BadRequestException('sales.productList.import.emptyFile')

    const rows = this.parseCsv(buffer.toString('utf8'))
    if (!rows.length) throw new BadRequestException('sales.productList.import.emptyFile')

    const header = rows.shift() ?? []
    const columnIndex = new Map<string, number>()
    header.forEach((col, idx) => {
      const normalized = this.normalizeHeaderKey(col)
      if (normalized) columnIndex.set(normalized, idx)
    })

    if (!columnIndex.has(this.normalizeHeaderKey('name'))) {
      throw new BadRequestException('Missing required column: name')
    }

    const categoryCache = new Map<string, number>()
    const errors: { row: number; message: string }[] = []
    let created = 0
    let updated = 0

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const lineNumber = i + 2
      try {
        const idRaw = this.getCell(row, columnIndex, 'id')
        const id = idRaw ? Math.round(this.parseNumber(idRaw)) : undefined
        const codeRaw = this.getCell(row, columnIndex, 'productCode', ['code', 'sku'])
        const productCode = this.normalizeOptionalString(codeRaw)
        const nameRaw = this.getCell(row, columnIndex, 'name', ['productname'])
        const name = this.normalizeOptionalString(nameRaw)
        if (!name) throw new Error('Product name is required')

        const description = this.normalizeOptionalString(this.getCell(row, columnIndex, 'description', ['desc']))
        const specifications = this.normalizeOptionalString(
          this.getCell(row, columnIndex, 'specifications', ['specs', 'especificaciones', 'detalles']),
        )
        const img = this.normalizeOptionalString(this.getCell(row, columnIndex, 'img', ['image', 'imageurl']))
        const brand = this.normalizeOptionalString(this.getCell(row, columnIndex, 'brand'))
        const vendor = this.normalizeOptionalString(this.getCell(row, columnIndex, 'vendor'))
        const categoryName = this.normalizeOptionalString(this.getCell(row, columnIndex, 'category', ['categoryname']))
        const tags = this.splitTags(this.getCell(row, columnIndex, 'tags'))
        const currencyRaw = this.normalizeOptionalString(this.getCell(row, columnIndex, 'currency', ['currencycode']))
        const currency = currencyRaw ? currencyRaw.toUpperCase() : undefined
        const unitRaw = this.normalizeOptionalString(
          this.getCell(row, columnIndex, 'unitOfMeasure', ['salesUnit', 'unit', 'unitType', 'unidadVenta', 'unidad', 'unidad_de_venta'])
        )

        const salePriceRaw = this.getCell(row, columnIndex, 'salePrice', ['price', 'precioVenta', 'precioventa', 'precio_venta'])
        const stockRaw = this.getCell(row, columnIndex, 'stock')
        const taxRateRaw = this.getCell(row, columnIndex, 'taxRate', ['tax'])
        const costPriceRaw = this.getCell(row, columnIndex, 'costPrice', ['cost', 'costPerItem', 'precioCosto', 'preciocosto', 'precio_costo'])
        const bulkRaw = this.getCell(row, columnIndex, 'bulkDiscountPrice', ['bulkprice'])
        const permanentRaw = this.getCell(row, columnIndex, 'permanentStock', ['permanent'])
        const publishedRaw = this.getCell(row, columnIndex, 'published')
        const createdAtRaw = this.getCell(row, columnIndex, 'createdAt')

        const salePrice = salePriceRaw === '' ? undefined : this.parseNumber(salePriceRaw)
        const stock = stockRaw === '' ? undefined : this.parseNumber(stockRaw)
        const taxRate = taxRateRaw === '' ? undefined : this.parseNumber(taxRateRaw)
        const costPrice = costPriceRaw === '' ? undefined : this.parseNumber(costPriceRaw)
        const bulkDiscountPrice = bulkRaw === '' ? undefined : this.parseNumber(bulkRaw)
        const permanentStock = this.parseOptionalBoolean(permanentRaw)
        const published = this.parseOptionalBoolean(publishedRaw)
        const createdAt = this.parseDate(createdAtRaw)
        const unitOfMeasure = this.parseSalesUnit(unitRaw)

        const resolvedCostPrice =
          costPrice !== undefined
            ? roundCurrency(costPrice)
            : salePrice !== undefined
              ? costPriceFromSale(salePrice)
              : 0
        const resolvedSalePrice =
          salePrice !== undefined
            ? roundCurrency(salePrice)
            : salePriceFromCost(resolvedCostPrice)

        let product =
          id && id > 0
            ? await this.prisma.product.findUnique({ where: { id } })
            : null
        if (!product && productCode) {
          product = await this.prisma.product.findFirst({
            where: { productCode: productCode },
          })
        }

        const categoryId = await this.resolveCategoryId(categoryName, categoryCache)

        if (!product) {
          const fallbackTax = taxRate ?? (await this.getTaxRate())
          const normalizedStock = stock ?? 0
          const normalizedPermanent = permanentStock ?? false
          const status = this.deriveInventoryStatus(normalizedStock, normalizedPermanent)
          const createData: Prisma.ProductCreateInput = {
            name,
            productCode: productCode ?? undefined,
            description: description ?? undefined,
            specifications: specifications ?? undefined,
            img: img ?? undefined,
            salePrice: resolvedSalePrice,
            costPrice: resolvedCostPrice,
            currency: (currency ?? 'UYU').toUpperCase(),
            unitOfMeasure: unitOfMeasure ?? SalesUnit.UNIT,
            stock: Math.round(normalizedStock),
            permanentStock: normalizedPermanent,
            status,
            costPerItem: resolvedCostPrice,
            bulkDiscountPrice: bulkDiscountPrice ?? undefined,
            taxRate: fallbackTax,
            tags: tags ?? [],
            brand: brand ?? undefined,
            vendor: vendor ?? undefined,
            published: published ?? false,
          }
          if (categoryId) {
            createData.category = { connect: { id: categoryId } }
          }
          if (createdAt && !Number.isNaN(createdAt.getTime())) {
            createData.createdAt = createdAt
          }
          await this.prisma.product.create({ data: createData })
          created += 1
        } else {
          const updateData: Prisma.ProductUpdateInput = {
            name,
          }
          if (productCode !== undefined) updateData.productCode = productCode
          if (description !== undefined) updateData.description = description
          if (specifications !== undefined) updateData.specifications = specifications
          if (img !== undefined) updateData.img = img
          if (currency) updateData.currency = currency
          if (salePrice !== undefined) {
            updateData.salePrice = resolvedSalePrice
          }
          if (costPrice !== undefined) {
            updateData.costPrice = resolvedCostPrice
            updateData.costPerItem = resolvedCostPrice
          }
          if (stock !== undefined) updateData.stock = Math.round(stock)
          if (permanentStock !== undefined) updateData.permanentStock = permanentStock
          if (bulkDiscountPrice !== undefined) updateData.bulkDiscountPrice = bulkDiscountPrice
          if (taxRate !== undefined) updateData.taxRate = taxRate
          if (tags !== undefined) updateData.tags = tags
          if (brand !== undefined) updateData.brand = brand
          if (vendor !== undefined) updateData.vendor = vendor
          if (published !== undefined) updateData.published = published
          if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure
          if (categoryId) {
            updateData.category = { connect: { id: categoryId } }
          }
          const nextStock =
            stock !== undefined ? stock : product.stock ?? 0
          const nextPermanent =
            permanentStock !== undefined ? permanentStock : product.permanentStock ?? false
          updateData.status = this.deriveInventoryStatus(Number(nextStock), Boolean(nextPermanent))
          await this.prisma.product.update({
            where: { id: product.id },
            data: updateData,
          })
          updated += 1
        }
      } catch (error) {
        let message = 'Unknown import error'
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as any
          message = response?.message || error.message
        } else if (error instanceof Error) {
          message = error.message
        }
        errors.push({ row: lineNumber, message })
      }
    }

    return {
      success: errors.length === 0,
      imported: created + updated,
      created,
      updated,
      failed: errors.length,
      errors,
    }
  }

  @Get('product')
  async getProduct(@Query('id') id: string) {
    const nId = Number(id)
    const data = await this.prisma.product.findUnique({
      where: { id: nId },
      include: {
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
        options: {
          include: {
            values: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            selections: {
              include: {
                optionValue: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    })
    if (!data) return null
    const {
      options = [],
      variants: variantEntities = [],
      images = [],
      ...rest
    } = data as typeof data & {
      options: Array<
        Prisma.ProductOptionGetPayload<{
          include: { values: true }
        }>
      >
      variants: Array<
        Prisma.ProductVariantGetPayload<{
          include: {
            images: true
            selections: {
              include: { optionValue: { include: { option: true } } }
            }
          }
        }>
      >
      images: Array<Prisma.ProductImageGetPayload<{}>>
    }

    const attributes = options.map((option) => ({
      id: option.id,
      type: option.type,
      name: option.name,
      sortOrder: option.sortOrder,
      values: option.values
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((value) => ({
          id: value.id,
          key: value.code,
          label: value.label,
          value: value.value ?? '',
          colorHex: value.colorHex ?? undefined,
          imageUrl: value.imageUrl ?? undefined,
          imageAlt: value.imageAlt ?? undefined,
          sortOrder: value.sortOrder,
        })),
    }))

    const variants = variantEntities.map((variant) => {
      const attributesPayload = Array.isArray(variant.attributes)
        ? (variant.attributes as Array<Record<string, unknown>>)
        : []
      const selectionsByAttribute = new Map<ProductAttributeType, number>()
      variant.selections.forEach((selection) => {
        const attributeType = selection.optionValue.option.type
        selectionsByAttribute.set(attributeType, selection.optionValueId)
      })

      const attributeSelections = attributesPayload
        .map((entry) => {
          const attribute = entry?.attribute as ProductAttributeType | undefined
          const key = typeof entry?.key === 'string' ? entry.key : undefined
          if (!attribute || !key) {
            return null
          }
          const label = typeof entry?.label === 'string' ? entry.label : undefined
          const value = typeof entry?.value === 'string' ? entry.value : undefined
          const colorHex = typeof entry?.colorHex === 'string' ? entry.colorHex : undefined
          const imageUrl = typeof entry?.imageUrl === 'string' ? entry.imageUrl : undefined
          const imageAlt = typeof entry?.imageAlt === 'string' ? entry.imageAlt : undefined
          const optionValueId = selectionsByAttribute.get(attribute)
          return {
            attribute,
            valueKey: key,
            label,
            value,
            colorHex,
            imageUrl,
            imageAlt,
            optionValueId,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

      return {
        id: variant.id,
        key: variant.key,
        sku: variant.sku ?? undefined,
        barcode: variant.barcode ?? undefined,
        label: variant.label ?? undefined,
        salePrice: variant.salePrice ? decimalToNumber(variant.salePrice) : undefined,
        costPrice: variant.costPrice ? decimalToNumber(variant.costPrice) : undefined,
        stock: variant.stock ?? undefined,
        permanentStock: variant.permanentStock ?? undefined,
        isActive: variant.isActive,
        inheritSalePrice: variant.inheritSalePrice,
        inheritCostPrice: variant.inheritCostPrice,
        inheritStock: variant.inheritStock,
        inheritSku: variant.inheritSku,
        inheritImages: variant.inheritImages,
        attributes: attributeSelections,
        images: variant.images.map((image, index) => ({
          id: String(image.id ?? `${variant.id}-${index}`),
          name: image.name ?? undefined,
          img: image.img,
          sortOrder: image.sortOrder,
        })),
      }
    })

    const imgList = images.map((image) => ({
      id: String(image.id),
      name: image.name ?? undefined,
      img: image.img,
    }))

    return {
      ...rest,
      salePrice: decimalToNumber(data.salePrice),
      costPrice: decimalToNumber(data.costPrice),
      mode: data.mode,
      imgList,
      attributes,
      variants,
    }
  }

  @Post('products/create')
  async createProduct(@Body() dto: UpsertProductDto) {
    const mode = this.normalizeProductMode(dto.mode)
    const normalizedAttributes = mode === ProductMode.VARIABLE ? this.normalizeAttributesInput(dto.attributes) : []
    const normalizedVariants =
      mode === ProductMode.VARIABLE ? this.normalizeVariantsInput(dto.variants, normalizedAttributes) : []

    if (mode === ProductMode.VARIABLE) {
      if (!normalizedAttributes.length) {
        throw new BadRequestException('Variable products require at least one attribute.')
      }
      if (!normalizedVariants.length) {
        throw new BadRequestException('Variable products require at least one variant.')
      }
    }

    const tags = (dto.tags || []).map((t: any) => (typeof t === 'string' ? t : t.value))
    const taxRate = await this.getTaxRate()
    const permanentStock = dto.permanentStock ?? false
    const status = this.deriveInventoryStatus(dto.stock, permanentStock)
    const currency = this.safeTrim(dto.currency) || 'UYU'
    const normalizedSalePrice = roundCurrency(dto.salePrice)
    const normalizedCostPrice = roundCurrency(dto.costPrice)
    const coverImage = dto.img || dto.imgList?.[0]?.img || null

    let createdProductId: number | null = null

    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          productCode: dto.productCode,
          img: coverImage,
          description: dto.description,
          specifications: dto.specifications?.trim?.() ? dto.specifications.trim() : null,
          categoryId: dto.categoryId,
          salePrice: normalizedSalePrice,
          costPrice: normalizedCostPrice,
          currency: currency.toUpperCase(),
          unitOfMeasure: dto.unitOfMeasure ?? SalesUnit.UNIT,
          stock: dto.stock,
          permanentStock,
          status,
          mode,
          costPerItem: dto.costPerItem ?? normalizedCostPrice,
          bulkDiscountPrice: dto.bulkDiscountPrice,
          taxRate,
          tags,
          brand: dto.brand,
          vendor: dto.vendor,
          published: dto.published ?? false,
        },
      })
      createdProductId = product.id

      if (dto.imgList && dto.imgList.length) {
        await this.replaceProductImages(tx, product.id, dto.imgList)
      }

      if (mode === ProductMode.VARIABLE) {
        const result = await this.applyVariableStructure(tx, product, normalizedAttributes, normalizedVariants)
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: result.stock,
            permanentStock: result.permanentStock,
            status: result.status,
          },
        })
      } else if (!product.img && dto.imgList && dto.imgList.length) {
        await tx.product.update({
          where: { id: product.id },
          data: { img: dto.imgList[0].img },
        })
      }
    })
    return {
      ok: true,
      productId: createdProductId,
    }
  }

  @Put('products/update')
  async updateProduct(@Body() dto: UpdateProductDto) {
    if (!dto.id) return false
    const existingProduct = await this.prisma.product.findUnique({
      where: { id: dto.id },
      select: {
        id: true,
        salePrice: true,
        costPrice: true,
        stock: true,
        permanentStock: true,
        currency: true,
        mode: true,
      },
    })
    if (!existingProduct) {
      throw new BadRequestException('Product not found')
    }

    const nextMode = dto.mode ? this.normalizeProductMode(dto.mode) : existingProduct.mode
    let normalizedAttributes: NormalizedAttribute[] = []
    let normalizedVariants: NormalizedVariant[] = []
    if (nextMode === ProductMode.VARIABLE) {
      normalizedAttributes = this.normalizeAttributesInput(dto.attributes)
      normalizedVariants = this.normalizeVariantsInput(dto.variants, normalizedAttributes)
      if (!normalizedAttributes.length) {
        throw new BadRequestException('Variable products require at least one attribute.')
      }
      if (!normalizedVariants.length) {
        throw new BadRequestException('Variable products require at least one variant.')
      }
    }

    const tags =
      (dto as any).tags === undefined
        ? undefined
        : (dto.tags || []).map((t: any) => (typeof t === 'string' ? t : t.value))

    const taxRate = await this.getTaxRate()
    const normalizedSalePrice = dto.salePrice === undefined ? undefined : roundCurrency(dto.salePrice)
    const normalizedCostPrice = dto.costPrice === undefined ? undefined : roundCurrency(dto.costPrice)
    const normalizedCurrency =
      dto.currency === undefined ? undefined : (this.safeTrim(dto.currency) || 'UYU').toUpperCase()

    const updateData: Prisma.ProductUpdateInput = {
      name: dto.name,
      productCode: dto.productCode,
      img: dto.img,
      description: dto.description,
      specifications:
        dto.specifications === undefined
          ? undefined
          : dto.specifications?.trim?.()
          ? dto.specifications.trim()
          : null,
      salePrice: normalizedSalePrice,
      costPrice: normalizedCostPrice,
      stock: dto.stock,
      costPerItem:
        dto.costPerItem === undefined ? normalizedCostPrice ?? undefined : roundCurrency(dto.costPerItem),
      bulkDiscountPrice: dto.bulkDiscountPrice,
      taxRate,
      tags,
      brand: dto.brand,
      vendor: dto.vendor,
      permanentStock: dto.permanentStock === undefined ? undefined : dto.permanentStock,
      currency: normalizedCurrency,
      unitOfMeasure: dto.unitOfMeasure === undefined ? undefined : dto.unitOfMeasure,
      published: dto.published === undefined ? undefined : dto.published,
      category:
        dto.categoryId === undefined
          ? undefined
          : {
              connect: { id: dto.categoryId },
            },
      mode: nextMode,
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: dto.id },
        data: updateData,
      })

      if (dto.imgList) {
        await this.replaceProductImages(tx, updated.id, dto.imgList)
        if (!dto.img && dto.imgList.length > 0) {
          await tx.product.update({
            where: { id: updated.id },
            data: { img: dto.imgList[0].img },
          })
        }
      }

      const context = {
        id: updated.id,
        salePrice: normalizedSalePrice ?? updated.salePrice ?? existingProduct.salePrice,
        costPrice: normalizedCostPrice ?? updated.costPrice ?? existingProduct.costPrice,
        stock:
          dto.stock !== undefined && dto.stock !== null
            ? Number(dto.stock)
            : updated.stock ?? existingProduct.stock ?? 0,
        permanentStock:
          dto.permanentStock !== undefined && dto.permanentStock !== null
            ? Boolean(dto.permanentStock)
            : updated.permanentStock ?? existingProduct.permanentStock ?? false,
        currency: normalizedCurrency ?? updated.currency ?? existingProduct.currency ?? 'UYU',
      }

      let finalStock = Number(context.stock ?? 0)
      let finalPermanent = Boolean(context.permanentStock)
      let finalStatus: 0 | 1 | 2 = this.deriveInventoryStatus(finalStock, finalPermanent)

      if (nextMode === ProductMode.VARIABLE) {
        const result = await this.applyVariableStructure(tx, context, normalizedAttributes, normalizedVariants)
        finalStock = result.stock
        finalPermanent = result.permanentStock
        finalStatus = result.status
      } else {
        await this.clearVariableStructure(tx, updated.id)
        finalStatus = this.deriveInventoryStatus(finalStock, finalPermanent)
      }

      const coverImageUpdate =
        !dto.img && dto.imgList && dto.imgList.length > 0 ? { img: dto.imgList[0].img } : {}

      await tx.product.update({
        where: { id: updated.id },
        data: {
          stock: finalStock,
          permanentStock: finalPermanent,
          status: finalStatus,
          mode: nextMode,
          ...coverImageUpdate,
        },
      })
    })
    return true
  }

  @Delete('products/delete')
  async deleteProducts(@Body() body: { id: string | string[] }) {
    const ids = Array.isArray(body.id) ? body.id : [body.id]
    const numIds = ids.map((x) => Number(x)).filter(Boolean)
    await this.prisma.product.deleteMany({ where: { id: { in: numIds } } })
    return true
  }
}
