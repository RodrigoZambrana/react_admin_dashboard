import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ParametricPricingService } from '../pricing/parametric-pricing.service'

type FixedParametricMatrixRow = Prisma.DimensionPriceMatrixGetPayload<{
  select: {
    id: true
    familyId: true
    serie: true
    material: true
    color: true
    vidrio: true
    widthMm: true
    heightMm: true
    hasMosquitero: true
    hasShutterMonoblock: true
    shutterSystem: true
    currency: true
    source: true
    referenceDate: true
    detailSnapshot: true
    price: true
    priceBase: true
    priceMosquitero: true
    priceMonoblock: true
    priceMonoblockMosquitero: true
    hasMosquiteroOption: true
    hasMonoblockOption: true
  }
}>

type ParametricPricingSummary = {
  base?: { row: FixedParametricMatrixRow; amount: number }
  mosquito?: { row: FixedParametricMatrixRow; amount: number }
  shutters: Map<string, { standalone?: { row: FixedParametricMatrixRow; amount: number }; combo?: { row: FixedParametricMatrixRow; amount: number } }>
}

export type PublishedParametricVariantDefinition = {
  id: number
  key: string
  price: number
  currency: string | null
  configuration: Record<string, unknown>
  specifications: Array<{ label: string; value: string }>
  optionValues: {
    familyId: string
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

export type PublishedParametricProductDefinition = {
  defaultVariantKey: string
  configuration: Record<string, unknown>
  specifications: Array<{ label: string; value: string }>
  selectors: {
    series: string[]
    materials: string[]
    colors: string[]
    glass: string[]
    shutterMaterials: string[]
    hasMosquiteroOption: boolean
    hasMonoblockOption: boolean
  }
  variants: PublishedParametricVariantDefinition[]
}

@Injectable()
export class StorefrontPublishedProductResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametricPricing: ParametricPricingService,
  ) {}

  private normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim().toUpperCase() : ''
  }

  private normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return ['1', 'true', 'yes', 'si', 'sí', 'y'].includes(normalized)
    }
    return false
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value)
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(',', '.'))
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null
    }
    return null
  }

  async resolvePublishedParametricProduct(
    productId: number,
    fallbackCurrency?: string | null,
    preferredSalePrice?: Prisma.Decimal | number | null,
  ): Promise<PublishedParametricProductDefinition | null> {
    const [rows, markupMultiplier] = await Promise.all([
      this.prisma.dimensionPriceMatrix.findMany({
      where: { productId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        familyId: true,
        serie: true,
        material: true,
        color: true,
        vidrio: true,
        widthMm: true,
        heightMm: true,
        hasMosquitero: true,
        hasShutterMonoblock: true,
        shutterSystem: true,
        currency: true,
        source: true,
        referenceDate: true,
        detailSnapshot: true,
        price: true,
        priceBase: true,
        priceMosquitero: true,
        priceMonoblock: true,
        priceMonoblockMosquitero: true,
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
      },
      }),
      this.parametricPricing.getPublishedMarkupMultiplier(),
    ])

    if (!rows.length) {
      return null
    }

    const defaultRow = rows[0]
    const pricingSummary = this.buildPricingSummary(rows)
    const variants = this.buildPublishedVariants(defaultRow, pricingSummary, markupMultiplier, fallbackCurrency)
    const normalizedPreferredSalePrice = this.decimalToNumber(preferredSalePrice)
    const defaultVariant =
      variants.find(
        (variant) =>
          normalizedPreferredSalePrice > 0 &&
          Math.abs(variant.price - normalizedPreferredSalePrice) < 0.0001 &&
          !variant.optionValues.hasMosquitero &&
          !variant.optionValues.hasShutterMonoblock,
      ) ??
      variants.find(
        (variant) =>
          !variant.optionValues.hasMosquitero &&
          !variant.optionValues.hasShutterMonoblock,
      ) ??
      variants.find(
        (variant) =>
          normalizedPreferredSalePrice > 0 &&
          Math.abs(variant.price - normalizedPreferredSalePrice) < 0.0001,
      ) ??
      variants.find(
        (variant) =>
          variant.optionValues.hasMosquitero === defaultRow.hasMosquitero &&
          variant.optionValues.hasShutterMonoblock === defaultRow.hasShutterMonoblock &&
          this.normalizeString(variant.optionValues.shutterMaterial) ===
            this.normalizeString(defaultRow.shutterSystem ?? ''),
      ) ??
      variants[0]

    return {
      defaultVariantKey: defaultVariant.key,
      configuration: defaultVariant.configuration,
      specifications: defaultVariant.specifications,
      selectors: {
        series: this.uniqueValues(rows.map((row) => row.serie)),
        materials: this.uniqueValues(rows.map((row) => row.material)),
        colors: this.uniqueValues(rows.map((row) => row.color)),
        glass: this.uniqueValues(rows.map((row) => row.vidrio)),
        shutterMaterials: this.uniqueValues(
          variants
            .map((variant) => variant.optionValues.shutterMaterial)
            .filter((value) => value.trim() !== ''),
        ),
        hasMosquiteroOption: variants.some((variant) => variant.optionValues.hasMosquitero),
        hasMonoblockOption: variants.some((variant) => variant.optionValues.hasShutterMonoblock),
      },
      variants,
    }
  }

  async resolvePublishedParametricVariant(
    productId: number,
    rawConfiguration?: Record<string, unknown> | null,
    fallbackCurrency?: string | null,
    preferredSalePrice?: Prisma.Decimal | number | null,
  ): Promise<PublishedParametricVariantDefinition | null> {
    const definition = await this.resolvePublishedParametricProduct(
      productId,
      fallbackCurrency,
      preferredSalePrice,
    )
    if (!definition) {
      return null
    }

    if (!rawConfiguration) {
      return definition.variants.find((variant) => variant.key === definition.defaultVariantKey) ?? definition.variants[0] ?? null
    }

    const defaultConfig = definition.configuration
    const merged = {
      ...defaultConfig,
      ...rawConfiguration,
    }

    const matched = definition.variants.find((variant) => {
      const optionValues = variant.optionValues
      return (
        this.normalizeString(merged.familyId ?? merged.family_id) === this.normalizeString(optionValues.familyId) &&
        this.normalizeString(merged.serie ?? merged.series) === this.normalizeString(optionValues.serie) &&
        this.normalizeString(merged.material) === this.normalizeString(optionValues.material) &&
        this.normalizeString(merged.color) === this.normalizeString(optionValues.color) &&
        this.normalizeString(merged.vidrio ?? merged.glass) === this.normalizeString(optionValues.vidrio) &&
        this.normalizeNumber(merged.widthMm ?? merged.width_mm ?? merged.width) === optionValues.widthMm &&
        this.normalizeNumber(merged.heightMm ?? merged.height_mm ?? merged.height) === optionValues.heightMm &&
        this.normalizeBoolean(merged.hasMosquitero ?? merged.mosquitoNet ?? merged.mosquitero) ===
          optionValues.hasMosquitero &&
        this.normalizeBoolean(
          merged.hasShutterMonoblock ??
            merged.monoblock ??
            merged.has_monoblock ??
            merged.monoblockEnabled,
        ) === optionValues.hasShutterMonoblock &&
        this.normalizeString(
          merged.shutterMaterial ??
            merged.shutter_material ??
            merged.shutterSystem ??
            merged.shutter_system ??
            merged.monoblockSystem ??
            merged.monoblockMaterial,
        ) === this.normalizeString(optionValues.shutterMaterial)
      )
    })

    return matched ?? null
  }

  private uniqueValues(values: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    values.forEach((value) => {
      const trimmed = value.trim()
      if (!trimmed || seen.has(trimmed)) {
        return
      }
      seen.add(trimmed)
      result.push(trimmed)
    })
    return result
  }

  private decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0
    }
    const numeric = typeof value === 'number' ? value : value.toNumber()
    if (!Number.isFinite(numeric)) {
      return 0
    }
    return Number(numeric.toFixed(4))
  }

  private buildPricingSummary(rows: FixedParametricMatrixRow[]): ParametricPricingSummary {
    const summary: ParametricPricingSummary = { shutters: new Map() }

    rows.forEach((row) => {
      const priceBase =
        !row.hasShutterMonoblock && !row.hasMosquitero
          ? this.decimalToNumber(row.priceBase ?? row.price)
          : 0
      const priceMosquito =
        !row.hasShutterMonoblock && row.priceMosquitero !== null && row.priceMosquitero !== undefined
          ? this.decimalToNumber(row.priceMosquitero)
          : 0
      const priceShutter = this.decimalToNumber(row.priceMonoblock)
      const priceShutterMosquito = this.decimalToNumber(row.priceMonoblockMosquitero)

      if (priceBase > 0 && !summary.base) {
        summary.base = { row, amount: priceBase }
      }

      if (priceMosquito > 0 && !summary.mosquito) {
        summary.mosquito = { row, amount: priceMosquito }
      }

      if ((row.hasShutterMonoblock || row.hasMonoblockOption) && (priceShutter > 0 || priceShutterMosquito > 0)) {
        const material = row.shutterSystem?.trim() || 'GENERIC'
        const existing = summary.shutters.get(material) ?? {}
        if (priceShutter > 0 && !existing.standalone) {
          existing.standalone = { row, amount: priceShutter }
        }
        if (priceShutterMosquito > 0 && !existing.combo) {
          existing.combo = { row, amount: priceShutterMosquito }
        }
        summary.shutters.set(material, existing)
      }
    })

    return summary
  }

  private buildPublishedVariants(
    canonicalRow: FixedParametricMatrixRow,
    summary: ParametricPricingSummary,
    markupMultiplier: number,
    fallbackCurrency?: string | null,
  ): PublishedParametricVariantDefinition[] {
    const variants: PublishedParametricVariantDefinition[] = []

    const pushVariant = (params: {
      key: string
      sourceRow: FixedParametricMatrixRow
      rawPrice: number
      hasMosquitero: boolean
      hasShutterMonoblock: boolean
      shutterMaterial?: string
    }) => {
      if (!(params.rawPrice > 0)) {
        return
      }
      const salePrice = this.normalizePriceValue(params.rawPrice * markupMultiplier)
      variants.push({
        id: params.sourceRow.id,
        key: params.key,
        price: salePrice,
        currency: params.sourceRow.currency ?? fallbackCurrency ?? null,
        configuration: this.buildConfiguration(canonicalRow, fallbackCurrency, {
          hasMosquitero: params.hasMosquitero,
          hasShutterMonoblock: params.hasShutterMonoblock,
          shutterMaterial: params.shutterMaterial ?? '',
          matrixRowId: params.sourceRow.id,
        }),
        specifications: this.buildSpecifications(canonicalRow, {
          hasMosquitero: params.hasMosquitero,
          hasShutterMonoblock: params.hasShutterMonoblock,
          shutterMaterial: params.shutterMaterial ?? '',
        }),
        optionValues: {
          familyId: canonicalRow.familyId,
          serie: canonicalRow.serie,
          material: canonicalRow.material,
          color: canonicalRow.color,
          vidrio: canonicalRow.vidrio,
          widthMm: canonicalRow.widthMm,
          heightMm: canonicalRow.heightMm,
          hasMosquitero: params.hasMosquitero,
          hasShutterMonoblock: params.hasShutterMonoblock,
          shutterMaterial: params.shutterMaterial ?? '',
        },
      })
    }

    if (summary.base) {
      pushVariant({
        key: `base:${summary.base.row.id}`,
        sourceRow: summary.base.row,
        rawPrice: summary.base.amount,
        hasMosquitero: false,
        hasShutterMonoblock: false,
      })
    }

    if (summary.mosquito) {
      pushVariant({
        key: `mosquito:${summary.mosquito.row.id}`,
        sourceRow: summary.mosquito.row,
        rawPrice: summary.mosquito.amount,
        hasMosquitero: true,
        hasShutterMonoblock: false,
      })
    }

    summary.shutters.forEach((payload, material) => {
      if (payload.standalone) {
        pushVariant({
          key: `shutter:${material}:${payload.standalone.row.id}`,
          sourceRow: payload.standalone.row,
          rawPrice: payload.standalone.amount,
          hasMosquitero: false,
          hasShutterMonoblock: true,
          shutterMaterial: material === 'GENERIC' ? '' : material,
        })
      }

      if (payload.combo) {
        pushVariant({
          key: `shutter-mosquito:${material}:${payload.combo.row.id}`,
          sourceRow: payload.combo.row,
          rawPrice: payload.combo.amount,
          hasMosquitero: true,
          hasShutterMonoblock: true,
          shutterMaterial: material === 'GENERIC' ? '' : material,
        })
      }
    })

    return variants
  }

  private buildVariant(
    row: FixedParametricMatrixRow,
    markupMultiplier: number,
    fallbackCurrency?: string | null,
  ): PublishedParametricVariantDefinition {
    const salePrice = this.normalizePriceValue(Number(row.price.toFixed(4)) * markupMultiplier)
    return {
      id: row.id,
      key: String(row.id),
      price: salePrice,
      currency: row.currency ?? fallbackCurrency ?? null,
      configuration: this.buildConfiguration(row, fallbackCurrency),
      specifications: this.buildSpecifications(row),
      optionValues: {
        familyId: row.familyId,
        serie: row.serie,
        material: row.material,
        color: row.color,
        vidrio: row.vidrio,
        widthMm: row.widthMm,
        heightMm: row.heightMm,
        hasMosquitero: row.hasMosquitero,
        hasShutterMonoblock: row.hasShutterMonoblock,
        shutterMaterial: row.shutterSystem ?? '',
      },
    }
  }

  private normalizePriceValue(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0
    }
    return Number(Math.ceil(value - 1e-9).toFixed(4))
  }

  private buildConfiguration(
    row: FixedParametricMatrixRow,
    fallbackCurrency?: string | null,
    overrides?: {
      hasMosquitero?: boolean
      hasShutterMonoblock?: boolean
      shutterMaterial?: string
      matrixRowId?: number
    },
  ): Record<string, unknown> {
    return {
      familyId: row.familyId,
      serie: row.serie,
      material: row.material,
      color: row.color,
      vidrio: row.vidrio,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      hasMosquitero: overrides?.hasMosquitero ?? row.hasMosquitero,
      hasShutterMonoblock: overrides?.hasShutterMonoblock ?? row.hasShutterMonoblock,
      shutterMaterial: overrides?.shutterMaterial ?? row.shutterSystem ?? '',
      currency: row.currency ?? fallbackCurrency ?? null,
      source: row.source ?? null,
      referenceDate: row.referenceDate?.toISOString?.() ?? null,
      specifications: row.detailSnapshot ?? null,
      matrixRowId: overrides?.matrixRowId ?? row.id,
    }
  }

  private buildSpecifications(
    row: FixedParametricMatrixRow,
    overrides?: {
      hasMosquitero?: boolean
      hasShutterMonoblock?: boolean
      shutterMaterial?: string
    },
  ): Array<{ label: string; value: string }> {
    const hasMosquitero = overrides?.hasMosquitero ?? row.hasMosquitero
    const hasShutterMonoblock = overrides?.hasShutterMonoblock ?? row.hasShutterMonoblock
    const shutterMaterial = overrides?.shutterMaterial ?? row.shutterSystem ?? ''
    const specifications: Array<{ label: string; value: string }> = [
      { label: 'Serie', value: row.serie },
      { label: 'Material', value: row.material },
      { label: 'Color', value: row.color },
      { label: 'Vidrio', value: row.vidrio },
      { label: 'Ancho', value: `${row.widthMm} mm` },
      { label: 'Alto', value: `${row.heightMm} mm` },
    ]

    if (hasMosquitero) {
      specifications.push({ label: 'Mosquitero', value: 'Sí' })
    }

    if (hasShutterMonoblock) {
      specifications.push({ label: 'Monoblock', value: shutterMaterial || 'Sí' })
    }

    return specifications
  }
}
