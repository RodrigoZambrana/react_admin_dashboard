import { BadRequestException, Injectable, Inject, NotFoundException, Logger } from '@nestjs/common'
import { Prisma, ProductMode, ProductType, SalesUnit } from '@prisma/client'
import type {
  DimensionPriceMatrix,
  ParametricMatrixStaging as ParametricMatrixStagingModel,
} from '@prisma/client'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import { PrismaService } from '../prisma/prisma.service'
import { CLIENT_CONFIG_TOKEN } from '../config/client-config.constants'
import type { ClientVariantConfig } from '../config/client-config.types'
import { AberturasGlossaryService, AberturasSelectorSummary, AberturasConfig } from '../aberturas/aberturas-glossary.service'
import type {
  ParametricCompatibilityConfig,
  ParametricConfigSnapshot,
  ParametricImportSummary,
  ParametricMatrixEntry,
  ParametricMatrixMatch,
  ParametricMatrixRow,
  ParametricMatrixSearchDto,
  ParametricMatrixSearchResult,
  ParametricMatchMetadata,
  ParametricMatchAdjustment,
  ParametricShutterSnapshot,
  ParametricPriceLineage,
  ParametricPriceLineageEntry,
  ParametricPriceResolution,
  ParametricProductImportSummary,
  ParametricQuoteInput,
  ParametricQuoteResult,
  ParametricSelectors,
  ParametricManualMatrixInput,
  ParametricManualMatrixSnapshot,
} from './types'
import type { PrismaClientOrTransaction } from './types'

const BOOLEAN_TRUE_VALUES = new Set(['1', 'TRUE', 'YES', 'SI', 'SÍ', 'Y'])
const PRICE_FIELDS = ['priceBase', 'priceMosquitero', 'priceMonoblock', 'priceMonoblockMosquitero'] as const
type PriceField = (typeof PRICE_FIELDS)[number]
type NormalizedManualMatrixInput = {
  familyId: string
  serie: string
  color: string
  vidrio: string
  widthMm: number
  heightMm: number
  hasMosquitero: boolean
  hasMonoblock: boolean
  currency: string
  priceBase: number
  priceMosquitero: number
  pricePvcShutter: number
  pricePvcShutterMosq: number
  priceAluminioShutter: number
  priceAluminioShutterMosq: number
}
const PRICE_CONFLICT_THRESHOLD = 0.015
const SOURCE_PRIORITY: Record<string, number> = {
  ERP_GESTION: 400,
  ERP: 300,
  PDF_S20_2025: 200,
  PDF: 180,
  CHAT: 120,
  UPLOAD: 100,
}
const MAX_XLSX_IMPORT_BYTES = 5 * 1024 * 1024
const MAX_XLSX_IMPORT_SHEETS = 5
const MAX_XLSX_IMPORT_ROWS = 5_000
const xlsxUtils = XLSX.utils as unknown as {
  sheet_to_json<T>(worksheet: unknown, options?: Record<string, unknown>): T[]
  json_to_sheet(data: unknown[], options?: Record<string, unknown>): unknown
  book_new(): unknown
  book_append_sheet(workbook: unknown, worksheet: unknown, name?: string): unknown
}
type XlsxWorkbook = {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}

@Injectable()
export class ParametricPricingService {
  private readonly logger = new Logger(ParametricPricingService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
    private readonly aberturasGlossary: AberturasGlossaryService,
  ) {}

  private static readonly GLASS_PRIORITY = ['3MM', '4MM', '5MM', '6MM', 'DVH (4/9/5)', 'DVH (5/9/6)']

  private readWorkbookFromBuffer(buffer: Buffer): XlsxWorkbook {
    if (buffer.length > MAX_XLSX_IMPORT_BYTES) {
      throw new BadRequestException(
        `Uploaded spreadsheet exceeds the ${Math.round(MAX_XLSX_IMPORT_BYTES / (1024 * 1024))}MB limit`,
      )
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', dense: true }) as unknown as XlsxWorkbook

    if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
      throw new BadRequestException('No sheets found in the provided file')
    }

    if (workbook.SheetNames.length > MAX_XLSX_IMPORT_SHEETS) {
      throw new BadRequestException(`Too many sheets in the provided file (max ${MAX_XLSX_IMPORT_SHEETS})`)
    }

    return workbook
  }

  private readFirstWorksheetRows(workbook: XlsxWorkbook): Record<string, unknown>[] {
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    if (!worksheet) {
      throw new BadRequestException('The first worksheet could not be read from the provided file')
    }

    const rows = xlsxUtils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      blankrows: false,
      raw: false,
      cellDates: true,
    })

    if (!rows.length) {
      throw new BadRequestException('No rows detected in the provided file')
    }

    if (rows.length > MAX_XLSX_IMPORT_ROWS) {
      throw new BadRequestException(`The provided file exceeds the ${MAX_XLSX_IMPORT_ROWS} row import limit`)
    }

    return rows
  }

  private isFeatureEnabled(): boolean {
    const isUrucortinas = this.clientConfig?.slug === 'urucortinas'
    return isUrucortinas && Boolean(this.clientConfig?.featureFlags?.PARAMETRIC_PRODUCTS)
  }

  private async stageMatrixRows(
    productId: number,
    rows: ParametricMatrixRow[],
    tx: PrismaClientOrTransaction = this.prisma,
  ) {
    if (!rows.length) {
      return
    }
    const stagePayload = rows.map((row) => {
      const fingerprint = row.fingerprint ?? this.buildFingerprint(row)
      const optionState = row.optionState ?? this.buildOptionState(row)
      const specifications = row.specifications ?? row.detailSnapshot ?? null
      const sourceSystem = (row.sourceSystem ?? row.source ?? 'UPLOAD').toUpperCase()
      return {
        productId,
        fingerprint,
        optionState,
        familyId: row.familyId,
        serie: row.serie,
        material: row.material,
        color: row.color,
        vidrio: row.vidrio,
        widthMm: row.widthMm,
        heightMm: row.heightMm,
        hasMosquitero: Boolean(row.hasMosquitero),
        hasShutterMonoblock: Boolean(row.hasShutterMonoblock),
        shutterSystem: this.normalizeString(row.shutterMaterial ?? ''),
        priceBase: this.roundPrice(row.priceBase ?? null),
        priceMosquitero: this.roundPrice(row.priceMosquitero ?? null),
        priceMonoblock: this.roundPrice(row.priceMonoblock ?? null),
        priceMonoblockMosquitero: this.roundPrice(row.priceMonoblockMosquitero ?? null),
        hasMosquiteroOption: Boolean(
          (row.priceMosquitero && row.priceMosquitero > 0) ||
            (row.priceMonoblockMosquitero && row.priceMonoblockMosquitero > 0),
        ),
        hasMonoblockOption: Boolean(
          (row.priceMonoblock && row.priceMonoblock > 0) ||
            (row.priceMonoblockMosquitero && row.priceMonoblockMosquitero > 0),
        ),
        currency: row.currency || 'USD',
        specifications,
        sourceSystem,
        sourceRecordId: row.source ?? null,
        source: row.source ?? null,
        referenceDate: row.referenceDate ?? null,
        payload: this.serializeRowPayload(row),
      }
    })
    await tx.parametricMatrixStaging.createMany({ data: stagePayload })
  }

  private async mergeStagedMatrixRows(
    productId: number,
    tx: PrismaClientOrTransaction = this.prisma,
    options?: { sourceSystem?: string },
  ) {
    const stagedRows = await tx.parametricMatrixStaging.findMany({
      where: {
        productId,
        processedAt: null,
        ...(options?.sourceSystem ? { sourceSystem: options.sourceSystem } : {}),
      },
      orderBy: [{ referenceDate: 'desc' }, { ingestedAt: 'desc' }, { id: 'asc' }],
    })
    if (!stagedRows.length) {
      return { inserted: 0, updated: 0 }
    }
    await this.ensureProduct(productId, tx)
    let inserted = 0
    let updated = 0

    for (const row of stagedRows) {
      const existing = await tx.dimensionPriceMatrix.findFirst({
        where: { productId, fingerprint: row.fingerprint, optionState: row.optionState },
      })
      if (!existing) {
        await tx.dimensionPriceMatrix.create({
          data: this.buildMatrixInsertPayload(productId, row),
        })
        inserted += 1
      } else {
        const mergeResult = this.applyColumnWiseMerge(existing, row)
        if (mergeResult.changed) {
          await tx.dimensionPriceMatrix.update({
            where: { id: existing.id },
            data: mergeResult.data,
          })
          updated += 1
        }
      }
      await tx.parametricMatrixStaging.update({
        where: { id: row.id },
        data: { processedAt: new Date() },
      })
    }

    return { inserted, updated }
  }

  private buildMatrixInsertPayload(productId: number, row: ParametricMatrixStagingModel) {
    const priceValues: Record<PriceField, number | null> = {
      priceBase: this.decimalToNumber(row.priceBase),
      priceMosquitero: this.decimalToNumber(row.priceMosquitero),
      priceMonoblock: this.decimalToNumber(row.priceMonoblock),
      priceMonoblockMosquitero: this.decimalToNumber(row.priceMonoblockMosquitero),
    }
    const lineage = this.buildLineageFromRow(priceValues, row.sourceSystem, row.referenceDate)
    const detailSnapshot = row.specifications ?? null

    const lineagePayload = this.serializePriceLineage(lineage)
    const mosqAvailable = Boolean(
      (priceValues.priceMosquitero && priceValues.priceMosquitero > 0) ||
        (priceValues.priceMonoblockMosquitero && priceValues.priceMonoblockMosquitero > 0),
    )
    const monoblockAvailable = Boolean(
      (priceValues.priceMonoblock && priceValues.priceMonoblock > 0) ||
        (priceValues.priceMonoblockMosquitero && priceValues.priceMonoblockMosquitero > 0),
    )

    return {
      productId,
      fingerprint: row.fingerprint,
      optionState: row.optionState,
      familyId: row.familyId,
      serie: row.serie,
      material: row.material,
      color: row.color,
      vidrio: row.vidrio,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      hasMosquitero: row.hasMosquitero,
      hasShutterMonoblock: row.hasShutterMonoblock,
      shutterSystem: row.shutterSystem,
      price: this.computeEffectivePrice(priceValues),
      priceBase: priceValues.priceBase,
      priceMosquitero: priceValues.priceMosquitero,
      priceMonoblock: priceValues.priceMonoblock,
      priceMonoblockMosquitero: priceValues.priceMonoblockMosquitero,
      hasMosquiteroOption: mosqAvailable,
      hasMonoblockOption: monoblockAvailable,
      currency: row.currency || 'USD',
      detailSnapshot,
      source: row.source ?? row.sourceSystem ?? null,
      referenceDate: row.referenceDate ?? null,
      priceLineage: lineagePayload ?? Prisma.DbNull,
      conflictFlags: [],
    }
  }

  private applyColumnWiseMerge(existing: DimensionPriceMatrix, row: ParametricMatrixStagingModel) {
    const nextValues: Record<PriceField, number | null> = {
      priceBase: this.decimalToNumber(existing.priceBase),
      priceMosquitero: this.decimalToNumber(existing.priceMosquitero),
      priceMonoblock: this.decimalToNumber(existing.priceMonoblock),
      priceMonoblockMosquitero: this.decimalToNumber(existing.priceMonoblockMosquitero),
    }
    const incomingValues: Record<PriceField, number | null> = {
      priceBase: this.decimalToNumber(row.priceBase),
      priceMosquitero: this.decimalToNumber(row.priceMosquitero),
      priceMonoblock: this.decimalToNumber(row.priceMonoblock),
      priceMonoblockMosquitero: this.decimalToNumber(row.priceMonoblockMosquitero),
    }
    const currentLineage = this.parsePriceLineage(existing.priceLineage as Prisma.JsonValue | null)
    const nextLineage: ParametricPriceLineage = { ...currentLineage }
    const incomingMeta = this.buildLineageEntry(row.sourceSystem, row.referenceDate)
    const nextConflictFlags = Array.isArray(existing.conflictFlags) ? [...existing.conflictFlags] : []
    const updateData: Prisma.DimensionPriceMatrixUpdateInput = {}
    let changed = false

    PRICE_FIELDS.forEach((field) => {
      const lineageKey = field as keyof ParametricPriceLineage
      const result = this.evaluatePriceMerge({
        field,
        currentValue: nextValues[field],
        incomingValue: incomingValues[field],
        currentMeta: nextLineage[lineageKey],
        incomingMeta,
      })
      if (result.shouldUpdate && result.nextValue !== undefined) {
        nextValues[field] = result.nextValue
        if (incomingMeta) {
          nextLineage[lineageKey] = incomingMeta
        }
        changed = true
      } else if (result.conflictFlag && !nextConflictFlags.includes(result.conflictFlag)) {
        nextConflictFlags.push(result.conflictFlag)
      }
    })

    const nextHasMosq = Boolean(
      (nextValues.priceMosquitero && nextValues.priceMosquitero > 0) ||
        (nextValues.priceMonoblockMosquitero && nextValues.priceMonoblockMosquitero > 0),
    )
    const nextHasMonoblock = Boolean(
      (nextValues.priceMonoblock && nextValues.priceMonoblock > 0) ||
        (nextValues.priceMonoblockMosquitero && nextValues.priceMonoblockMosquitero > 0),
    )

    if (changed) {
      updateData.priceBase = nextValues.priceBase
      updateData.priceMosquitero = nextValues.priceMosquitero
      updateData.priceMonoblock = nextValues.priceMonoblock
      updateData.priceMonoblockMosquitero = nextValues.priceMonoblockMosquitero
      updateData.price = this.computeEffectivePrice(nextValues)
    }
    if (existing.hasMosquiteroOption !== nextHasMosq) {
      updateData.hasMosquiteroOption = nextHasMosq
      changed = true
    }
    if (existing.hasMonoblockOption !== nextHasMonoblock) {
      updateData.hasMonoblockOption = nextHasMonoblock
      changed = true
    }

    const lineagePayload = this.serializePriceLineage(nextLineage)
    if (JSON.stringify(lineagePayload) !== JSON.stringify(existing.priceLineage as Prisma.JsonValue | null)) {
      updateData.priceLineage = lineagePayload ?? Prisma.DbNull
      changed = true
    }

    if (row.specifications && row.specifications !== existing.detailSnapshot) {
      updateData.detailSnapshot = row.specifications
      changed = true
    }

    const resolvedSource = row.source ?? row.sourceSystem ?? null
    if (resolvedSource && resolvedSource !== existing.source) {
      updateData.source = resolvedSource
      changed = true
    }

    if (
      row.referenceDate &&
      (!existing.referenceDate || row.referenceDate > existing.referenceDate)
    ) {
      updateData.referenceDate = row.referenceDate
      changed = true
    }

    if (nextConflictFlags.sort().join('|') !== (existing.conflictFlags ?? []).sort().join('|')) {
      updateData.conflictFlags = nextConflictFlags
      changed = true
    }

    return { changed, data: updateData }
  }

  private assertFeatureEnabled() {
    if (!this.isFeatureEnabled()) {
      throw new NotFoundException('Parametric products are not enabled for this client')
    }
  }

  private normalizeString(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    return String(value).trim()
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    const text = this.normalizeString(value).toUpperCase()
    if (!text) {
      return false
    }
    return BOOLEAN_TRUE_VALUES.has(text)
  }

  private parseNumber(value: unknown, field: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value)
    }
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim()
      if (!normalized) {
        throw new BadRequestException(`Missing numeric value for ${field}`)
      }
      const parsed = Number(normalized)
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`Invalid numeric value for ${field}: ${value}`)
      }
      return Math.trunc(parsed)
    }
    throw new BadRequestException(`Invalid numeric value for ${field}`)
  }

  private mergeSelectors(primary: string[], fallback?: string[]): string[] {
    const result = new Set<string>()
    primary.filter(Boolean).forEach((value) => result.add(value))
    fallback?.filter(Boolean).forEach((value) => result.add(value))
    return Array.from(result)
  }

  private async getAberturasFallbackSelectors(): Promise<AberturasSelectorSummary | null> {
    try {
      return await this.aberturasGlossary.getSelectorSummary()
    } catch (error) {
      const err = error as Error
      this.logger.warn(`Failed to load Aberturas selector summary: ${err.message}`)
      return null
    }
  }

  private parsePrice(value: unknown, field = 'price'): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.normalizePriceValue(value)
    }
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim()
      if (!normalized) {
        return 0
      }
      const parsed = Number(normalized)
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`Invalid numeric value for ${field}: ${value}`)
      }
      return this.normalizePriceValue(parsed)
    }
    if (value === null || value === undefined) {
      return 0
    }
    throw new BadRequestException(`Invalid numeric value for ${field}`)
  }

  private normalizePriceValue(value: number): number {
    return Number(value.toFixed(2))
  }

  private roundPrice(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null
    }
    if (!Number.isFinite(value)) {
      return null
    }
    return this.normalizePriceValue(value)
  }

  private normalizeShutterMaterialLabel(value: string) {
    const normalized = this.normalizeString(value)
    if (!normalized) {
      return ''
    }
    return normalized.replace(/[\s_-]+/g, ' ').trim().toUpperCase()
  }

  private buildFingerprint(row: Pick<ParametricMatrixRow, 'familyId' | 'serie' | 'color' | 'vidrio' | 'widthMm' | 'heightMm'>) {
    const tokens = [
      this.normalizeString(row.familyId).toLowerCase(),
      this.normalizeString(row.serie).toLowerCase(),
      this.normalizeString(row.color).toLowerCase(),
      this.normalizeString(row.vidrio).toLowerCase(),
      String(Math.round(row.widthMm ?? 0)),
      String(Math.round(row.heightMm ?? 0)),
    ]
    const payload = tokens.join('|')
    return createHash('sha256').update(payload).digest('hex')
  }

  private buildOptionState(row: ParametricMatrixRow) {
    if (row.hasShutterMonoblock) {
      const material = this.normalizeShutterMaterialLabel(row.shutterMaterial) || 'GENERIC'
      return `SHUTTER_${material}`
    }
    return 'BASE'
  }

  private enrichMatrixRow(row: ParametricMatrixRow, sourceSystem: string): ParametricMatrixRow {
    const fingerprint = this.buildFingerprint(row)
    const optionState = this.buildOptionState(row)
    const normalizedSourceSystem = this.normalizeString(sourceSystem).toUpperCase() || 'UPLOAD'
    return {
      ...row,
      fingerprint,
      optionState,
      sourceSystem: normalizedSourceSystem,
    }
  }

  private resolveSourcePriority(source?: string | null): number {
    if (!source) {
      return 0
    }
    const normalized = this.normalizeString(source).toUpperCase()
    return SOURCE_PRIORITY[normalized] ?? 1
  }

  private parsePriceLineage(value?: Prisma.JsonValue | null): ParametricPriceLineage {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as ParametricPriceLineage
  }

  private serializePriceLineage(lineage: ParametricPriceLineage): Prisma.InputJsonValue | null {
    const hasEntries = PRICE_FIELDS.some((field) => {
      const key = field as keyof ParametricPriceLineage
      return Boolean(lineage[key])
    })
    return hasEntries ? (lineage as Prisma.InputJsonValue) : null
  }

  private computeEffectivePrice(row: {
    priceBase?: number | null
    priceMosquitero?: number | null
    priceMonoblock?: number | null
    priceMonoblockMosquitero?: number | null
  }): number {
    return (
      Number(row.priceBase ?? row.priceMosquitero ?? row.priceMonoblock ?? row.priceMonoblockMosquitero ?? 0) || 0
    )
  }

  private async resolveMarkupMultiplier(): Promise<number> {
    let markupPercent = 25
    try {
      const pricingConfig = await this.aberturasGlossary.getPricingConfig()
      if (pricingConfig && Number.isFinite(pricingConfig.markupPercent)) {
        markupPercent = Number(pricingConfig.markupPercent)
      }
    } catch (error) {
      this.logger.warn(
        'Failed to load aberturas pricing config, falling back to default markup (25%)',
        error as Error,
      )
    }
    return 1 + Math.max(0, markupPercent) / 100
  }

  private applyMarkupToPrice(value: number, multiplier: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0
    }
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
    const result = value * safeMultiplier
    const roundedUp = Math.ceil(result - 1e-9)
    return this.normalizePriceValue(roundedUp)
  }

  private decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null
    }
    const numeric = typeof value === 'number' ? value : (value as Prisma.Decimal).toNumber()
    return this.roundPrice(numeric)
  }

  private serializeRowPayload(row: ParametricMatrixRow): Prisma.InputJsonValue {
    return {
      ...row,
      referenceDate: row.referenceDate ? row.referenceDate.toISOString() : null,
    } as Prisma.InputJsonValue
  }

  private buildLineageEntry(
    source?: string | null,
    referenceDate?: Date | string | null,
  ): ParametricPriceLineageEntry | undefined {
    if (!source && !referenceDate) {
      return undefined
    }
    const normalizedSource = this.normalizeString(source ?? '').toUpperCase()
    let isoDate: string | null = null
    if (referenceDate instanceof Date) {
      isoDate = referenceDate.toISOString()
    } else if (typeof referenceDate === 'string' && referenceDate.trim()) {
      const parsed = Date.parse(referenceDate)
      if (!Number.isNaN(parsed)) {
        isoDate = new Date(parsed).toISOString()
      }
    }
    return {
      source: normalizedSource || null,
      referenceDate: isoDate,
    }
  }

  private buildLineageFromRow(
    values: Record<PriceField, number | null>,
    source?: string | null,
    referenceDate?: Date | null,
  ): ParametricPriceLineage {
    const lineage: ParametricPriceLineage = {}
    PRICE_FIELDS.forEach((field) => {
      const value = values[field]
      if (value && value > 0) {
        const key = field as keyof ParametricPriceLineage
        lineage[key] = this.buildLineageEntry(source, referenceDate)
      }
    })
    return lineage
  }

  private evaluatePriceMerge(params: {
    field: PriceField
    currentValue: number | null
    incomingValue: number | null
    currentMeta?: ParametricPriceLineageEntry
    incomingMeta?: ParametricPriceLineageEntry
  }): { shouldUpdate: boolean; nextValue?: number | null; conflictFlag?: string } {
    const { field, currentValue, incomingValue, currentMeta, incomingMeta } = params
    if (incomingValue === null || incomingValue === undefined || incomingValue <= 0) {
      return { shouldUpdate: false }
    }
    if (currentValue === null || currentValue === undefined || currentValue <= 0) {
      return { shouldUpdate: true, nextValue: incomingValue }
    }

    const currentDate = currentMeta?.referenceDate ? Date.parse(currentMeta.referenceDate) : null
    const incomingDate = incomingMeta?.referenceDate ? Date.parse(incomingMeta.referenceDate) : null

    if (incomingDate && (!currentDate || incomingDate > currentDate)) {
      return { shouldUpdate: true, nextValue: incomingValue }
    }
    if (incomingDate && currentDate && incomingDate < currentDate) {
      return { shouldUpdate: false }
    }

    const currentPriority = this.resolveSourcePriority(currentMeta?.source)
    const incomingPriority = this.resolveSourcePriority(incomingMeta?.source)
    if (incomingPriority > currentPriority) {
      return { shouldUpdate: true, nextValue: incomingValue }
    }
    if (incomingPriority < currentPriority) {
      return { shouldUpdate: false }
    }

    const denominator = Math.max(Math.abs(currentValue), 0.01)
    const diffPct = Math.abs(currentValue - incomingValue) / denominator
    if (diffPct > PRICE_CONFLICT_THRESHOLD) {
      return { shouldUpdate: false, conflictFlag: `PRICE_${field.toUpperCase()}_CONFLICT` }
    }

    return { shouldUpdate: false }
  }

  private collectShutterPricingOptions(
    normalizedRow: Record<string, unknown>,
    fallbackMaterial: string,
    legacyPrice: number,
    legacyMosqPrice: number,
    hasShutterLegacy: boolean,
    priceTransform?: (value: number) => number,
  ) {
    const options = new Map<string, { price?: number; priceMosq?: number }>()

    const registerOption = (token: string, price: number, isMosq: boolean) => {
      if (!Number.isFinite(price) || price <= 0) {
        return
      }
      const label = this.normalizeShutterMaterialLabel(token || fallbackMaterial || 'GENERIC') || 'GENERIC'
      const entry = options.get(label) ?? {}
      if (isMosq) {
        entry.priceMosq = price
      } else {
        entry.price = price
      }
      options.set(label, entry)
    }

    const detectShutterColumn = (key: string): { token: string; isMosq: boolean } | null => {
      if (key.startsWith('price_mb_')) {
        const isMosq = key.endsWith('_c_mosq') || key.endsWith('_cmosq') || key.endsWith('_con_mosq')
        const token = key
          .replace(/^price_mb_/, '')
          .replace(/_c_mosq$|_cmosq$|_con_mosq$/, '')
        if (!token) {
          return null
        }
        return { token, isMosq }
      }

      if (!key.startsWith('price_')) {
        return null
      }

      const mosqSuffixes = ['_shutter_mosq', '_shutter_c_mosq', '_shutter_con_mosq']
      for (const suffix of mosqSuffixes) {
        if (key.endsWith(suffix)) {
          const token = key.slice('price_'.length, key.length - suffix.length)
          if (!token) {
            return null
          }
          return { token, isMosq: true }
        }
      }

      if (key.endsWith('_shutter')) {
        const token = key.slice('price_'.length, key.length - '_shutter'.length)
        if (!token) {
          return null
        }
        return { token, isMosq: false }
      }

      return null
    }

    Object.entries(normalizedRow).forEach(([rawKey, rawValue]) => {
      const key = this.normalizeString(rawKey).toLowerCase()
      const column = detectShutterColumn(key)
      if (!column) {
        return
      }
      const parsed = this.parsePrice(rawValue)
      const adjusted = typeof priceTransform === 'function' ? priceTransform(parsed) : parsed
      registerOption(column.token, adjusted, column.isMosq)
    })

    if (!options.size && (legacyPrice > 0 || legacyMosqPrice > 0)) {
      const token = fallbackMaterial || 'GENERIC'
      if (legacyPrice > 0) {
        registerOption(token, legacyPrice, false)
      }
      if (legacyMosqPrice > 0) {
        registerOption(token, legacyMosqPrice, true)
      }
    }

    return options
  }

  private composeAggregatedMatrixRowVariants(params: {
    normalizedRow: Record<string, unknown>
    familyId: string
    serie: string
    material: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    priceBase: number
    priceMosquitero: number
    priceMonoblock: number
    priceMonoblockMosquitero: number
    hasMosquiteroLegacy: boolean
    hasShutterLegacy: boolean
    shutterMaterial: string
    currency: string
    detailSnapshot: string | null
    source: string | null
    referenceDate: Date | null
    sourceSystem: string
    priceTransform?: (value: number) => number
  }): ParametricMatrixRow[] {
    const shutterOptions = this.collectShutterPricingOptions(
      params.normalizedRow,
      params.shutterMaterial,
      params.priceMonoblock,
      params.priceMonoblockMosquitero,
      params.hasShutterLegacy,
      params.priceTransform,
    )
    const hasMosqOption = params.priceMosquitero > 0
    const rows: ParametricMatrixRow[] = []
    const basePrice = params.priceBase > 0 ? params.priceBase : 0
    if (basePrice <= 0 && !hasMosqOption && !shutterOptions.size) {
      return rows
    }
    const specifications = params.detailSnapshot ?? null
    const baseRow: ParametricMatrixRow = {
      familyId: params.familyId,
      serie: params.serie,
      material: params.material,
      color: params.color,
      vidrio: params.vidrio,
      widthMm: params.widthMm,
      heightMm: params.heightMm,
      hasMosquitero: false,
      hasShutterMonoblock: false,
      shutterMaterial: '',
      price: Number.isFinite(basePrice) ? basePrice : 0,
      priceBase: basePrice ?? null,
      priceMosquitero: hasMosqOption ? params.priceMosquitero || null : null,
      priceMonoblock: null,
      priceMonoblockMosquitero: null,
      hasMosquiteroOption: hasMosqOption,
      hasMonoblockOption: shutterOptions.size > 0,
      currency: params.currency,
      detailSnapshot: specifications,
      specifications,
      source: params.source,
      referenceDate: params.referenceDate,
    }
    rows.push(this.enrichMatrixRow(baseRow, params.sourceSystem))

    shutterOptions.forEach((option, label) => {
      const optionPrice = option.price ?? null
      const optionMosqPrice = option.priceMosq ?? null
      if (
        (optionPrice === null || optionPrice <= 0) &&
        (optionMosqPrice === null || optionMosqPrice <= 0)
      ) {
        return
      }
      const optionRow: ParametricMatrixRow = {
        ...baseRow,
        hasShutterMonoblock: true,
        shutterMaterial: label,
        price: optionPrice ?? optionMosqPrice ?? basePrice ?? params.priceMosquitero ?? 0,
        priceMonoblock: optionPrice,
        priceMonoblockMosquitero: optionMosqPrice,
        hasMonoblockOption: true,
      hasMosquiteroOption: Boolean(baseRow.hasMosquiteroOption || (optionMosqPrice && optionMosqPrice > 0)),
      hasMosquitero: Boolean(optionMosqPrice && optionMosqPrice > 0),
      }
      rows.push(this.enrichMatrixRow(optionRow, params.sourceSystem))
    })

    return rows
  }

  private normalizeManualMatrixInput(payload: ParametricManualMatrixInput, productCurrency: string): NormalizedManualMatrixInput {
    const requireString = (value: unknown, field: string) => {
      const normalized = this.normalizeString(value)
      if (!normalized) {
        throw new BadRequestException(`${field} is required`)
      }
      return normalized
    }
    const parseDimension = (value: unknown, field: string) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value))
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.round(parsed))
        }
      }
      throw new BadRequestException(`${field} must be a valid number`)
    }
    const parsePriceValue = (value: unknown): number => {
      if (value === null || value === undefined || value === '') {
        return 0
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          throw new BadRequestException('Price values must be numeric')
        }
        return this.normalizePriceValue(value)
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
          return this.normalizePriceValue(parsed)
        }
      }
      throw new BadRequestException('Price values must be numeric')
    }

    const familyId = requireString(payload.familyId, 'familyId')
    const serie = requireString(payload.serie, 'serie')
    const color = requireString(payload.color, 'color')
    const vidrio = requireString(payload.vidrio, 'vidrio')
    const widthMm = parseDimension(payload.widthMm, 'widthMm')
    const heightMm = parseDimension(payload.heightMm, 'heightMm')
    if (widthMm <= 0 || heightMm <= 0) {
      throw new BadRequestException('widthMm and heightMm must be greater than 0')
    }
    const priceBase = parsePriceValue(payload.priceBase)
    const priceMosquitero = parsePriceValue(payload.priceMosquitero)
    const pricePvcShutter = parsePriceValue(payload.pricePvcShutter)
    const pricePvcShutterMosq = parsePriceValue(payload.pricePvcShutterMosq)
    const priceAluminioShutter = parsePriceValue(payload.priceAluminioShutter)
    const priceAluminioShutterMosq = parsePriceValue(payload.priceAluminioShutterMosq)
    if (
      priceBase <= 0 &&
      priceMosquitero <= 0 &&
      pricePvcShutter <= 0 &&
      pricePvcShutterMosq <= 0 &&
      priceAluminioShutter <= 0 &&
      priceAluminioShutterMosq <= 0
    ) {
      throw new BadRequestException('At least one price value must be greater than zero')
    }
    const currency = this.normalizeString(payload.currency) || productCurrency || 'USD'
    return {
      familyId,
      serie,
      color,
      vidrio,
      widthMm,
      heightMm,
      hasMosquitero: priceMosquitero > 0,
      hasMonoblock:
        pricePvcShutter > 0 ||
        pricePvcShutterMosq > 0 ||
        priceAluminioShutter > 0 ||
        priceAluminioShutterMosq > 0,
      currency,
      priceBase,
      priceMosquitero,
      pricePvcShutter,
      pricePvcShutterMosq,
      priceAluminioShutter,
      priceAluminioShutterMosq,
    }
  }

  private detectShutterMaterialKind(label: string): 'PVC' | 'ALUMINIO' | 'GENERIC' {
    const normalized = this.normalizeShutterMaterialLabel(label)
    if (normalized.includes('PVC')) {
      return 'PVC'
    }
    if (normalized.includes('ALU')) {
      return 'ALUMINIO'
    }
    return 'GENERIC'
  }

  private buildManualConfigSnapshot(rows: DimensionPriceMatrix[]): ParametricManualMatrixSnapshot | null {
    if (!rows.length) {
      return null
    }
    const baseRow =
      rows.find((row) => !row.hasMosquitero && !row.hasShutterMonoblock) ??
      rows[0]
    if (!baseRow) {
      return null
    }
    const matchesBase = (row: DimensionPriceMatrix) =>
      row.familyId === baseRow.familyId &&
      row.serie === baseRow.serie &&
      row.color === baseRow.color &&
      row.vidrio === baseRow.vidrio &&
      row.widthMm === baseRow.widthMm &&
      row.heightMm === baseRow.heightMm

    const shutterRows = rows.filter((row) => row.hasShutterMonoblock && matchesBase(row))
    const basePriceValue = this.normalizeDecimal(baseRow.priceBase ?? baseRow.price)
    const baseMosqValue = this.normalizeDecimal(baseRow.priceMosquitero)
    const snapshot: ParametricManualMatrixSnapshot = {
      familyId: baseRow.familyId,
      serie: baseRow.serie,
      color: baseRow.color,
      vidrio: baseRow.vidrio,
      widthMm: baseRow.widthMm,
      heightMm: baseRow.heightMm,
      hasMosquitero: Boolean(baseMosqValue && baseMosqValue > 0),
      hasMonoblock: shutterRows.length > 0,
      currency: baseRow.currency || 'USD',
      priceBase: basePriceValue,
      priceMosquitero: baseMosqValue,
      pricePvcShutter: null,
      pricePvcShutterMosq: null,
      priceAluminioShutter: null,
      priceAluminioShutterMosq: null,
    }

    shutterRows.forEach((row) => {
      const kind = this.detectShutterMaterialKind(row.shutterSystem ?? '')
      const standalone = this.normalizeDecimal(row.priceMonoblock ?? row.price)
      const withMosq = this.normalizeDecimal(row.priceMonoblockMosquitero)
      if (kind === 'PVC') {
        if (standalone !== null && standalone > 0) {
          snapshot.pricePvcShutter = standalone
        }
        if (withMosq !== null && withMosq > 0) {
          snapshot.pricePvcShutterMosq = withMosq
        }
      } else {
        if (standalone !== null && standalone > 0) {
          snapshot.priceAluminioShutter = standalone
        }
        if (withMosq !== null && withMosq > 0) {
          snapshot.priceAluminioShutterMosq = withMosq
        }
      }
    })

    snapshot.hasMonoblock = Boolean(
      snapshot.pricePvcShutter ||
        snapshot.pricePvcShutterMosq ||
        snapshot.priceAluminioShutter ||
        snapshot.priceAluminioShutterMosq,
    )

    return snapshot
  }

  private parseOptionalDate(value: unknown, field: string): Date | null {
    if (value === null || value === undefined) {
      return null
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const excelEpoch = Date.UTC(1899, 11, 30)
      const milliseconds = Math.round(value * 86_400_000)
      const date = new Date(excelEpoch + milliseconds)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
      throw new BadRequestException(`Invalid date value for ${field}`)
    }
    if (typeof value === 'string') {
      const text = value.trim()
      if (!text) {
        return null
      }
      const normalized = text.replace(/\//g, '-')
      const parsed = Date.parse(normalized)
      if (!Number.isNaN(parsed)) {
        return new Date(parsed)
      }
      throw new BadRequestException(`Invalid date value for ${field}: ${value}`)
    }
    throw new BadRequestException(`Invalid date value for ${field}`)
  }

  private normalizeDecimal(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null
    }
    const numeric = typeof value === 'number' ? value : (value as Prisma.Decimal).toNumber()
    if (!Number.isFinite(numeric)) {
      return null
    }
    return Number(numeric.toFixed(4))
  }

  private async ensureProduct(productId: number, tx: PrismaClientOrTransaction = this.prisma) {
    const product = await tx.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new NotFoundException('Product not found')
    }
    if (product.mode !== ProductMode.PARAMETRIC) {
      await tx.product.update({
        where: { id: productId },
        data: { mode: ProductMode.PARAMETRIC },
      })
    }
    return product
  }

  async importFromBuffer(
    productId: number,
    buffer: Buffer,
    options?: { filename?: string | null },
  ): Promise<ParametricImportSummary> {
    this.assertFeatureEnabled()
    if (!buffer.length) {
      throw new BadRequestException('Uploaded file is empty')
    }
    const workbook = this.readWorkbookFromBuffer(buffer)
    const rows = this.readFirstWorksheetRows(workbook)
    const parsedRows: ParametricMatrixRow[] = []
    const warnings: string[] = []
    const defaultSourceLabel = this.normalizeString(options?.filename ?? '') || 'UPLOAD'

    rows.forEach((raw, index) => {
      const position = index + 2 // account for header row
      const normalizeKeyed = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [this.normalizeString(key).toLowerCase(), value]),
      )

      const familyId = this.normalizeString(
        normalizeKeyed['family_id'] ?? normalizeKeyed['familyid'] ?? normalizeKeyed['family'],
      )
      if (!familyId) {
        warnings.push(`Row ${position}: missing family_id. Row skipped.`)
        return
      }

      try {
        const serie = this.normalizeString(normalizeKeyed['serie'])
        const material = this.normalizeString(normalizeKeyed['material']) || 'ALUMINIO'
        const color = this.normalizeString(normalizeKeyed['color'])
        const vidrio = this.normalizeString(normalizeKeyed['vidrio'])
        const widthMm = this.parseNumber(normalizeKeyed['width_mm'] ?? normalizeKeyed['width'], 'width_mm')
        const heightMm = this.parseNumber(normalizeKeyed['height_mm'] ?? normalizeKeyed['height'], 'height_mm')
        const hasMosquitero = this.parseBoolean(
          normalizeKeyed['has_mosquitero'] ?? normalizeKeyed['mosquitero'] ?? normalizeKeyed['hasmosquitero'],
        )
        const hasShutterMonoblock = this.parseBoolean(
          normalizeKeyed['has_shutter_monoblock'] ??
            normalizeKeyed['monoblock'] ??
            normalizeKeyed['hasmonoblock'] ??
            normalizeKeyed['monoblock_enabled'],
        )
        const shutterMaterialRaw =
          normalizeKeyed['shutter_material'] ??
          normalizeKeyed['shutter_system_default'] ??
          normalizeKeyed['shutter_system'] ??
          normalizeKeyed['monoblock_system'] ??
          normalizeKeyed['shuttersystem']
        const shutterMaterial = this.normalizeString(shutterMaterialRaw) || ''
        const rawPriceBase = this.parsePrice(normalizeKeyed['price_base'] ?? normalizeKeyed['price'])
        const rawPriceMosquitero = this.parsePrice(
          normalizeKeyed['price_c_mosq'] ?? normalizeKeyed['price_mosquitero'],
          'price_mosquitero',
        )
        const rawPriceMonoblock = this.parsePrice(normalizeKeyed['price_mb'])
        const rawPriceMonoblockMosquitero = this.parsePrice(normalizeKeyed['price_mb_c_mosq'])
        const priceBase = rawPriceBase
        const priceMosquitero = rawPriceMosquitero
        const priceMonoblock = rawPriceMonoblock
        const priceMonoblockMosquitero = rawPriceMonoblockMosquitero
        const hasMosquiteroOption = priceMosquitero > 0 || priceMonoblockMosquitero > 0
        const hasMonoblockOption = priceMonoblock > 0 || priceMonoblockMosquitero > 0
        const currency = this.normalizeString(normalizeKeyed['currency']) || 'USD'
        const specifications = this.normalizeString(
          normalizeKeyed['detalle_snapshot'] ??
            normalizeKeyed['detalle'] ??
            normalizeKeyed['note'] ??
            normalizeKeyed['specifications'],
        )
        const sourceValue = this.normalizeString(
          normalizeKeyed['source'] ?? normalizeKeyed['fuente'] ?? normalizeKeyed['origen'],
        ) || defaultSourceLabel
        const sourceSystem =
          this.normalizeString(
            normalizeKeyed['source_system'] ?? normalizeKeyed['sourcesystem'] ?? normalizeKeyed['sourceSystem'],
          ) || sourceValue || defaultSourceLabel
        const referenceDate = this.parseOptionalDate(
          normalizeKeyed['reference_date'] ?? normalizeKeyed['referenceDate'] ?? normalizeKeyed['fecha_referencia'],
          'reference_date',
        )

        const aggregatedMode = !hasMosquitero && !hasShutterMonoblock
        if (aggregatedMode) {
          const variants = this.composeAggregatedMatrixRowVariants({
            normalizedRow: normalizeKeyed,
            familyId,
            serie,
            material,
            color,
            vidrio,
            widthMm,
            heightMm,
            priceBase,
            priceMosquitero,
            priceMonoblock,
            priceMonoblockMosquitero,
            hasMosquiteroLegacy: hasMosquitero,
            hasShutterLegacy: hasShutterMonoblock,
            shutterMaterial,
            currency,
            detailSnapshot: specifications || null,
            source: sourceValue || null,
            referenceDate,
            sourceSystem,
          })
          parsedRows.push(
            ...variants.filter((variant) => Number(variant.price ?? 0) > 0 || Number(variant.priceBase ?? 0) > 0),
          )
        } else {
          const enriched = this.enrichMatrixRow({
            familyId,
            serie,
            material,
            color,
            vidrio,
            widthMm,
            heightMm,
            hasMosquitero,
            hasShutterMonoblock,
            shutterMaterial,
            price: priceBase,
            priceBase,
            priceMosquitero,
            priceMonoblock,
            priceMonoblockMosquitero,
            hasMosquiteroOption,
            hasMonoblockOption,
            currency,
            detailSnapshot: specifications || null,
            specifications: specifications || null,
            source: sourceValue || null,
            referenceDate,
          }, sourceSystem)
          parsedRows.push(enriched)
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          warnings.push(`Row ${position}: ${error.message}`)
        } else {
          warnings.push(`Row ${position}: unexpected error parsing row`)
        }
      }
    })

    if (!parsedRows.length) {
      throw new BadRequestException('No valid rows detected in the uploaded file')
    }

    await this.stageMatrixRows(productId, parsedRows)
    const { inserted, updated } = await this.mergeStagedMatrixRows(productId)

    return {
      rowsInserted: inserted,
      rowsUpdated: updated,
      warnings,
    }
  }

  async importParametricProductsFromCsv(buffer: Buffer): Promise<ParametricProductImportSummary> {
    this.assertFeatureEnabled()
    if (!buffer.length) {
      throw new BadRequestException('Uploaded file is empty')
    }
    const workbook = this.readWorkbookFromBuffer(buffer)
    const rows = this.readFirstWorksheetRows(workbook)
    const markupMultiplier = await this.resolveMarkupMultiplier()

    type ProductGroup = {
      product: {
        name: string
        code?: string | null
        categoryId?: number | null
        categoryName?: string | null
        description?: string | null
        published: boolean
      }
      matrix: Map<
        string,
        {
          familyId: string
          serie: string
          material: string
          color: string
          vidrio: string
          widthMm: number
          heightMm: number
          shutterMaterial: string
          currency: string
          detailSnapshot?: string | null
          specifications?: string | null
          referenceDate?: Date | null
          source?: string | null
          sourceSystem?: string | null
          priceBase?: number | null
          priceMosquitero?: number | null
          priceMonoblock?: number | null
          priceMonoblockMosquitero?: number | null
          hasMosquiteroOption: boolean
          hasMonoblockOption: boolean
          hasMosquitero?: boolean
          hasShutterMonoblock?: boolean
          price?: number | null
          fingerprint?: string
          optionState?: string
        }
      >
    }

    const productGroups = new Map<string, ProductGroup>()
    const warnings: string[] = []

    rows.forEach((raw, index) => {
      const position = index + 2
      try {
        const normalizeKeyed = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [this.normalizeString(key).toLowerCase(), value]),
        )

        const productCode = this.normalizeString(normalizeKeyed['product_code']) || null
        const categoryIdRaw = this.normalizeString(normalizeKeyed['category_id'])
        let categoryId: number | null = null
        if (categoryIdRaw) {
          const numeric = Number(categoryIdRaw)
          if (Number.isFinite(numeric) && numeric > 0) {
            categoryId = numeric
          } else {
            warnings.push(`Row ${position}: invalid category_id "${categoryIdRaw}", using null`)
          }
        }
        const description = this.normalizeString(normalizeKeyed['description']) || null
        const published = normalizeKeyed.hasOwnProperty('published')
          ? this.parseBoolean(normalizeKeyed['published'])
          : false

        const familyId = this.normalizeString(normalizeKeyed['family_id'])
        const serie = this.normalizeString(normalizeKeyed['serie'])
        const material = this.normalizeString(normalizeKeyed['material']) || 'ALUMINIO'
        const color = this.normalizeString(normalizeKeyed['color'])
        const vidrio = this.normalizeString(normalizeKeyed['vidrio'])
        const widthMm = this.parseNumber(normalizeKeyed['width_mm'], 'width_mm')
        const heightMm = this.parseNumber(normalizeKeyed['height_mm'], 'height_mm')
        const hasMosquitero = this.parseBoolean(normalizeKeyed['has_mosquitero'])
        const hasShutter = this.parseBoolean(normalizeKeyed['has_shutter_monoblock'])
        const shutterSystem = this.normalizeString(normalizeKeyed['shutter_system'])
        const rawPrice = this.parsePrice(normalizeKeyed['price_base'] ?? normalizeKeyed['price'])
        const rawPriceMosquitero = this.parsePrice(
          normalizeKeyed['price_c_mosq'] ?? normalizeKeyed['price_mosquitero'],
          'price_mosquitero',
        )
        const rawPriceMonoblock = this.parsePrice(normalizeKeyed['price_mb'])
        const rawPriceMonoblockMosquitero = this.parsePrice(normalizeKeyed['price_mb_c_mosq'])
        const price = rawPrice
        const priceMosquiteroValue = rawPriceMosquitero
        const priceMonoblockValue = rawPriceMonoblock
        const priceMonoblockMosqValue = rawPriceMonoblockMosquitero
        const currency = this.normalizeString(normalizeKeyed['currency']) || 'USD'
        const detailSnapshot =
          this.normalizeString(
            normalizeKeyed['detalle_snapshot'] ??
              normalizeKeyed['detalle'] ??
              normalizeKeyed['note'] ??
              normalizeKeyed['specifications'],
          ) || null
        const sourceValue = this.normalizeString(normalizeKeyed['source']) || null
        const sourceSystem =
          this.normalizeString(
            normalizeKeyed['source_system'] ?? normalizeKeyed['sourcesystem'] ?? normalizeKeyed['sourceSystem'],
          ) || sourceValue || 'UPLOAD'
        const referenceDate = this.parseOptionalDate(
          normalizeKeyed['reference_date'] ?? normalizeKeyed['fecha_referencia'],
          'reference_date',
        )

        if (!familyId || !serie || !color || !vidrio) {
          warnings.push(`Row ${position}: missing matrix identifiers (family/serie/color/vidrio)`)
          return
        }

        const aggregatedMode = !hasMosquitero && !hasShutter
        const variantRows: ParametricMatrixRow[] = aggregatedMode
          ? this.composeAggregatedMatrixRowVariants({
              normalizedRow: normalizeKeyed,
              familyId,
              serie,
              material,
              color,
              vidrio,
              widthMm,
              heightMm,
              priceBase: price,
              priceMosquitero: priceMosquiteroValue,
              priceMonoblock: priceMonoblockValue,
              priceMonoblockMosquitero: priceMonoblockMosqValue,
              hasMosquiteroLegacy: hasMosquitero,
              hasShutterLegacy: hasShutter,
              shutterMaterial: shutterSystem,
              currency,
              detailSnapshot: detailSnapshot,
              source: sourceValue || null,
              referenceDate,
              sourceSystem,
            })
          : [
              this.enrichMatrixRow(
                {
                  familyId,
                  serie,
                  material,
                  color,
                  vidrio,
                widthMm,
                heightMm,
                  hasMosquitero,
                  hasShutterMonoblock: hasShutter,
                  shutterMaterial: shutterSystem,
                  price,
                  priceBase: !hasMosquitero && !hasShutter ? price : null,
                  priceMosquitero: hasMosquitero && !hasShutter ? price : null,
                  priceMonoblock: hasShutter && !hasMosquitero ? price : null,
                  priceMonoblockMosquitero: hasShutter && hasMosquitero ? price : null,
                  hasMosquiteroOption: hasMosquitero,
                  hasMonoblockOption: hasShutter,
                  currency,
                  detailSnapshot,
                  specifications: detailSnapshot,
                  source: sourceValue || null,
                  referenceDate,
                },
                sourceSystem,
              ),
            ]

        variantRows.forEach((variant) => {
          if (!Number.isFinite(variant.price ?? 0) || Number(variant.price ?? 0) <= 0) {
            return
          }

          const derivedName = this.buildProductName(
            variant.familyId,
            variant.serie,
            variant.color,
            variant.vidrio,
            variant.widthMm,
            variant.heightMm,
            Boolean(variant.hasMosquitero),
            variant.hasShutterMonoblock,
            variant.shutterMaterial,
          )
          if (!derivedName) {
            warnings.push(`Row ${position}: unable to infer product name`)
            return
          }

          const productKey = this.buildProductGroupingKey({
            productCode: productCode ?? undefined,
            familyId: variant.familyId,
            serie: variant.serie,
            color: variant.color,
            vidrio: variant.vidrio,
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
          })
          if (!productGroups.has(productKey)) {
            productGroups.set(productKey, {
              product: {
                name: derivedName,
                code: productCode,
                categoryId: Number.isFinite(categoryId) && categoryId ? categoryId : null,
                categoryName: Number.isFinite(categoryId) && categoryId ? null : this.prettifyLabel(variant.serie),
                description,
                published,
              },
              matrix: new Map(),
            })
          }
          const group = productGroups.get(productKey)!
          const matrixKey = [
            variant.familyId,
            variant.serie,
            variant.material,
            variant.color,
            variant.vidrio,
            variant.widthMm,
            variant.heightMm,
            variant.hasShutterMonoblock ? `shutter:1:${variant.shutterMaterial || ''}` : 'shutter:0',
          ].join('::')
          if (!group.matrix.has(matrixKey)) {
            group.matrix.set(matrixKey, {
              familyId: variant.familyId,
              serie: variant.serie,
              material: variant.material,
              color: variant.color,
              vidrio: variant.vidrio,
              widthMm: variant.widthMm,
              heightMm: variant.heightMm,
              shutterMaterial: variant.shutterMaterial,
              currency: variant.currency,
              detailSnapshot: variant.specifications ?? variant.detailSnapshot ?? null,
              specifications: variant.specifications ?? variant.detailSnapshot ?? null,
              referenceDate: variant.referenceDate,
              source: variant.source,
              hasMosquiteroOption: Boolean(variant.hasMosquiteroOption),
              hasMonoblockOption: Boolean(variant.hasMonoblockOption),
              priceBase: variant.priceBase ?? null,
              priceMosquitero: variant.priceMosquitero ?? null,
              priceMonoblock: variant.priceMonoblock ?? null,
              priceMonoblockMosquitero: variant.priceMonoblockMosquitero ?? null,
              hasMosquitero: variant.hasMosquitero,
              hasShutterMonoblock: variant.hasShutterMonoblock,
              price: variant.price ?? 0,
              fingerprint: variant.fingerprint ?? this.buildFingerprint(variant),
              optionState: variant.optionState ?? this.buildOptionState(variant),
              sourceSystem: variant.sourceSystem ?? null,
            })
          }
          const matrixRow = group.matrix.get(matrixKey)!
          if (!matrixRow.currency && variant.currency) {
            matrixRow.currency = variant.currency
          }
          if (!matrixRow.detailSnapshot && (variant.specifications || variant.detailSnapshot)) {
            const specs = variant.specifications ?? variant.detailSnapshot ?? null
            matrixRow.detailSnapshot = specs
            matrixRow.specifications = specs
          }
          if (!matrixRow.referenceDate && variant.referenceDate) {
            matrixRow.referenceDate = variant.referenceDate
          }
          if (!matrixRow.source && variant.source) {
            matrixRow.source = variant.source
          }
          if (!matrixRow.sourceSystem && variant.sourceSystem) {
            matrixRow.sourceSystem = variant.sourceSystem
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error'
        warnings.push(`Row ${position}: ${message}`)
      }
    })

    if (!productGroups.size) {
      throw new BadRequestException('No valid rows detected in the uploaded file')
    }

    let productsCreated = 0
    let productsUpdated = 0
    let matrixRows = 0

    for (const [, group] of productGroups) {
      const matrices = Array.from(group.matrix.values())
      if (!matrices.length) {
        warnings.push(`Product "${group.product.name}" does not contain matrix rows`)
        continue
      }
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const product = await this.upsertParametricProduct(tx, group.product, matrices, markupMultiplier)
          await tx.dimensionPriceMatrix.deleteMany({ where: { productId: product.id } })
          for (const row of matrices) {
            const priceValues: Record<PriceField, number | null> = {
              priceBase: row.priceBase ?? null,
              priceMosquitero: row.priceMosquitero ?? null,
              priceMonoblock: row.priceMonoblock ?? null,
              priceMonoblockMosquitero: row.priceMonoblockMosquitero ?? null,
            }
            const fingerprint = row.fingerprint ?? this.buildFingerprint(row as ParametricMatrixRow)
            const optionState = row.optionState ?? this.buildOptionState(row as ParametricMatrixRow)
            const lineage = this.buildLineageFromRow(
              priceValues,
              row.sourceSystem ?? row.source ?? null,
              row.referenceDate ?? null,
            )
            const lineagePayload = this.serializePriceLineage(lineage)
            await tx.dimensionPriceMatrix.create({
              data: {
                productId: product.id,
                fingerprint,
                optionState,
                familyId: row.familyId,
                serie: row.serie,
                material: row.material,
                color: row.color,
                vidrio: row.vidrio,
                widthMm: row.widthMm,
                heightMm: row.heightMm,
                hasMosquitero: Boolean(row.hasMosquitero),
                hasShutterMonoblock: Boolean(row.hasShutterMonoblock),
                shutterSystem: row.shutterMaterial ?? '',
                price: this.computeEffectivePrice(priceValues),
                priceBase: priceValues.priceBase,
                priceMosquitero: priceValues.priceMosquitero,
                priceMonoblock: priceValues.priceMonoblock,
                priceMonoblockMosquitero: priceValues.priceMonoblockMosquitero,
                hasMosquiteroOption: row.hasMosquiteroOption,
                hasMonoblockOption: row.hasMonoblockOption,
                currency: row.currency || 'USD',
                detailSnapshot: row.specifications ?? row.detailSnapshot ?? null,
                source: row.source ?? row.sourceSystem ?? null,
                referenceDate: row.referenceDate ?? null,
                priceLineage: lineagePayload ?? Prisma.DbNull,
                conflictFlags: [],
              },
            })
            matrixRows += 1
          }
          return product.created
        })
        if (created) {
          productsCreated += 1
        } else {
          productsUpdated += 1
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error'
        warnings.push(`Product "${group.product.name}": ${message}`)
      }
    }

    return {
      productsCreated,
      productsUpdated,
      matrixRows,
      warnings,
    }
  }

  private async upsertParametricProduct(
    tx: PrismaClientOrTransaction,
    payload: {
      name: string
      code?: string | null
      categoryId?: number | null
      categoryName?: string | null
      description?: string | null
      published: boolean
    },
    matrices: Array<{
      currency: string
      priceBase?: number | null
      priceMosquitero?: number | null
      priceMonoblock?: number | null
      priceMonoblockMosquitero?: number | null
    }>,
    markupMultiplier: number,
  ): Promise<{ id: number; created: boolean }> {
    const firstPriceCandidate = matrices.find(
      (row) => row.priceBase || row.priceMosquitero || row.priceMonoblock || row.priceMonoblockMosquitero,
    )
    const numericPrice =
      firstPriceCandidate?.priceBase ??
      firstPriceCandidate?.priceMosquitero ??
      firstPriceCandidate?.priceMonoblock ??
      firstPriceCandidate?.priceMonoblockMosquitero ??
      0
    const currency = matrices.find((row) => row.currency)?.currency ?? 'USD'
    const productCode = payload.code || null

    const effectiveMultiplier = Number.isFinite(markupMultiplier) && markupMultiplier > 0 ? markupMultiplier : 1

    let existing: { id: number } | null = null
    if (productCode) {
      existing = await tx.product.findFirst({ where: { productCode }, select: { id: true } })
    }
    if (!existing) {
      existing = await tx.product.findFirst({ where: { name: payload.name }, select: { id: true } })
    }

    let resolvedCategoryId: number | null = null
    if (payload.categoryId) {
      resolvedCategoryId = payload.categoryId
    } else {
      const parentId = await this.ensureCategory(tx, 'Aberturas', null)
      if (payload.categoryName) {
        resolvedCategoryId = await this.ensureCategory(tx, payload.categoryName, parentId)
      } else {
        resolvedCategoryId = parentId
      }
    }

    const costAmount = Number(numericPrice).toFixed(4)
    const saleAmount = this.applyMarkupToPrice(numericPrice, effectiveMultiplier).toFixed(2)

    const baseData = {
      name: payload.name,
      productCode,
      description: payload.description || null,
      categoryId: resolvedCategoryId,
      published: payload.published ?? false,
      mode: ProductMode.PARAMETRIC,
      productType: ProductType.PHYSICAL,
      currency,
      salePrice: new Prisma.Decimal(saleAmount),
      costPrice: new Prisma.Decimal(costAmount),
      unitOfMeasure: SalesUnit.UNIT,
      stock: 0,
      permanentStock: true,
      tags: [] as string[],
    }

    if (existing) {
      const updated = await tx.product.update({
        where: { id: existing.id },
        data: {
          name: baseData.name,
          productCode: baseData.productCode,
          description: baseData.description,
          categoryId: baseData.categoryId,
          published: baseData.published,
          mode: baseData.mode,
          currency: baseData.currency,
          salePrice: baseData.salePrice,
          costPrice: baseData.costPrice,
          unitOfMeasure: baseData.unitOfMeasure,
        },
      })
      return { id: updated.id, created: false }
    }

    const created = await tx.product.create({
      data: {
        ...baseData,
      },
    })
    return { id: created.id, created: true }
  }

  private prettifyLabel(value: string) {
    return value
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  private buildProductName(
    familyId: string,
    serie: string,
    color: string,
    vidrio: string,
    widthMm: number,
    heightMm: number,
    hasMosquitero: boolean,
    hasShutterMonoblock: boolean,
    shutterSystem: string,
  ) {
    const family = this.prettifyLabel(familyId)
    const serieLabel = this.prettifyLabel(serie)
    const colorLabel = this.prettifyLabel(color)
    const glassLabel = this.prettifyLabel(vidrio)
    const sizeLabel =
      Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm > 0 && heightMm > 0
        ? `${widthMm}x${heightMm}`
        : ''
    return [family, serieLabel, colorLabel, glassLabel, sizeLabel].filter(Boolean).join(' ').trim()
  }

  private buildProductGroupingKey(params: {
    productCode?: string
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
  }) {
    const normalize = (value?: string | null) => this.normalizeString(value ?? '').toLowerCase()
    const dimension = `${Math.round(Number(params.widthMm) || 0)}x${Math.round(
      Number(params.heightMm) || 0,
    )}`
    const tokens = [
      params.productCode ? normalize(params.productCode) : null,
      normalize(params.familyId) || 'family',
      normalize(params.serie) || 'serie',
      dimension,
      normalize(params.color) || 'color',
      normalize(params.vidrio) || 'glass',
    ].filter(Boolean)
    return tokens.join('::')
  }

  private async ensureCategory(tx: PrismaClientOrTransaction, name: string, parentId: number | null) {
    const existing = await tx.productCategory.findFirst({
      where: {
        name,
        parentId: parentId ?? null,
      },
      select: { id: true },
    })
    if (existing) {
      return existing.id
    }
    const created = await tx.productCategory.create({
      data: {
        name,
        parentId: parentId ?? null,
      },
      select: { id: true },
    })
    return created.id
  }

  async exportToBuffer(productId: number): Promise<{ filename: string; buffer: Buffer }> {
    this.assertFeatureEnabled()
    const rows = await this.prisma.dimensionPriceMatrix.findMany({
      where: { productId },
      orderBy: [
        { serie: 'asc' },
        { material: 'asc' },
        { color: 'asc' },
        { vidrio: 'asc' },
        { widthMm: 'asc' },
        { heightMm: 'asc' },
        { hasMosquitero: 'asc' },
        { hasShutterMonoblock: 'asc' },
        { shutterSystem: 'asc' },
      ],
    })
    if (!rows.length) {
      throw new NotFoundException('No price matrix entries found for this product')
    }
    const dataset = rows.map((row) => ({
      family_id: row.familyId,
      serie: row.serie,
      material: row.material,
      color: row.color,
      vidrio: row.vidrio,
      width_mm: row.widthMm,
      height_mm: row.heightMm,
      price_base: row.priceBase !== null && row.priceBase !== undefined ? Number(row.priceBase.toFixed(4)) : Number(row.price.toFixed(4)),
      price_c_mosq:
        row.priceMosquitero !== null && row.priceMosquitero !== undefined ? Number(row.priceMosquitero.toFixed(4)) : null,
      price_mb: row.priceMonoblock !== null && row.priceMonoblock !== undefined ? Number(row.priceMonoblock.toFixed(4)) : null,
      price_mb_c_mosq:
        row.priceMonoblockMosquitero !== null && row.priceMonoblockMosquitero !== undefined
          ? Number(row.priceMonoblockMosquitero.toFixed(4))
          : null,
      currency: row.currency,
      has_mosq_option: row.hasMosquiteroOption,
      has_mb_option: row.hasMonoblockOption,
      shutter_material: row.shutterSystem ?? '',
      source: row.source ?? '',
      reference_date: row.referenceDate ? row.referenceDate.toISOString().split('T')[0] : '',
      specifications: row.detailSnapshot ?? '',
    }))
    const worksheet = xlsxUtils.json_to_sheet(dataset)
    const workbook = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(workbook, worksheet, 'Matrix')
    const buffer = (XLSX as unknown as { write: (wb: unknown, opts: { type: string; bookType: string }) => unknown }).write(
      workbook,
      { type: 'buffer', bookType: 'xlsx' },
    ) as Buffer
    return {
      filename: `parametric-matrix-${productId}.xlsx`,
      buffer,
    }
  }

  async getProductMatrixEntries(productId: number): Promise<ParametricMatrixEntry[]> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)
    const rows = await this.prisma.dimensionPriceMatrix.findMany({
      where: { productId },
      orderBy: [
        { serie: 'asc' },
        { material: 'asc' },
        { color: 'asc' },
        { vidrio: 'asc' },
        { widthMm: 'asc' },
        { heightMm: 'asc' },
      ],
    })
    return rows.map((row) => this.mapMatrixEntry(row))
  }

  async getManualConfigSnapshot(productId: number): Promise<ParametricManualMatrixSnapshot | null> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)
    const rows = await this.prisma.dimensionPriceMatrix.findMany({
      where: { productId },
      orderBy: [
        { hasShutterMonoblock: 'asc' },
        { serie: 'asc' },
        { widthMm: 'asc' },
        { heightMm: 'asc' },
      ],
    })
    if (!rows.length) {
      return null
    }
    return this.buildManualConfigSnapshot(rows)
  }

  async saveManualConfig(productId: number, payload: ParametricManualMatrixInput): Promise<ParametricManualMatrixSnapshot | null> {
    this.assertFeatureEnabled()
    const product = await this.ensureProduct(productId)
    const normalized = this.normalizeManualMatrixInput(payload, product.currency || 'USD')
    const normalizedRowRecord: Record<string, unknown> = {
      price_base: normalized.priceBase,
      price_mosquitero: normalized.priceMosquitero,
      price_pvc_shutter: normalized.pricePvcShutter,
      price_pvc_shutter_mosq: normalized.pricePvcShutterMosq,
      price_aluminio_shutter: normalized.priceAluminioShutter,
      price_aluminio_shutter_mosq: normalized.priceAluminioShutterMosq,
    }

    const variants = this.composeAggregatedMatrixRowVariants({
      normalizedRow: normalizedRowRecord,
      familyId: normalized.familyId,
      serie: normalized.serie,
      material: 'ALUMINIO',
      color: normalized.color,
      vidrio: normalized.vidrio,
      widthMm: normalized.widthMm,
      heightMm: normalized.heightMm,
      priceBase: normalized.priceBase,
      priceMosquitero: normalized.priceMosquitero,
      priceMonoblock: 0,
      priceMonoblockMosquitero: 0,
      hasMosquiteroLegacy: normalized.hasMosquitero,
      hasShutterLegacy: normalized.hasMonoblock,
      shutterMaterial: '',
      currency: normalized.currency,
      detailSnapshot: null,
      source: 'MANUAL',
      referenceDate: new Date(),
      sourceSystem: 'MANUAL',
    })

    if (!variants.length) {
      throw new BadRequestException('Unable to build parametric matrix rows from the provided data.')
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.dimensionPriceMatrix.deleteMany({ where: { productId } })
        await tx.parametricMatrixStaging.deleteMany({
          where: { productId, processedAt: null, sourceSystem: 'MANUAL' },
        })
        await this.stageMatrixRows(productId, variants, tx)
        const mergeSummary = await this.mergeStagedMatrixRows(productId, tx, { sourceSystem: 'MANUAL' })
        if ((mergeSummary.inserted ?? 0) + (mergeSummary.updated ?? 0) === 0) {
          const warning = `[parametric-manual] No matrix rows merged for product ${productId}`
          this.logger.warn(warning)
          throw new BadRequestException('Unable to persist the manual configuration. Please review the costs and try again.')
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'unexpected error'
      if (!(error instanceof BadRequestException)) {
        this.logger.error(`[parametric-manual] Failed to save manual config for product ${productId}: ${message}`)
      }
      throw error
    }

    return this.getManualConfigSnapshot(productId)
  }

  async getProductSelectors(productId: number): Promise<ParametricSelectors> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)
    const [families, series, colors, glasses, widths, heights, shutterMaterials] = await Promise.all([
      this.getDistinctValues<string>(productId, 'familyId'),
      this.getDistinctValues<string>(productId, 'serie'),
      this.getDistinctValues<string>(productId, 'color'),
      this.getDistinctValues<string>(productId, 'vidrio'),
      this.getDistinctValues<number>(productId, 'widthMm'),
      this.getDistinctValues<number>(productId, 'heightMm'),
      this.getDistinctValues<string>(productId, 'shutterSystem'),
    ])
    return {
      families,
      series,
      colors,
      glasses,
      widths,
      heights,
      shutterMaterials,
    }
  }

  async searchMatrix(
    productId: number,
    criteria: ParametricMatrixSearchDto,
  ): Promise<ParametricMatrixSearchResult> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)

    const limit = Math.min(Math.max(criteria.limit ?? 10, 1), 50)
    const [config, marginMultiplier] = await Promise.all([
      this.aberturasGlossary.getConfig(),
      this.resolveMarkupMultiplier(),
    ])
    const mapped = await this.fetchSearchRows(criteria, { productId, nearestConfig: config.nearest })
    const request = {
      hasMosquitero: Boolean(criteria.hasMosquitero),
      hasShutterMonoblock: Boolean(criteria.hasShutterMonoblock),
      shutterMaterial: criteria.shutterMaterial?.trim() || undefined,
    }
    return this.buildSearchResult(mapped, criteria, request, limit, config.nearest, marginMultiplier)
  }

  async searchMatrixDefault(criteria: ParametricMatrixSearchDto): Promise<ParametricMatrixSearchResult> {
    this.assertFeatureEnabled()
    const limit = Math.min(Math.max(criteria.limit ?? 10, 1), 50)
    const [config, marginMultiplier] = await Promise.all([
      this.aberturasGlossary.getConfig(),
      this.resolveMarkupMultiplier(),
    ])
    const request = {
      hasMosquitero: Boolean(criteria.hasMosquitero),
      hasShutterMonoblock: Boolean(criteria.hasShutterMonoblock),
      shutterMaterial: criteria.shutterMaterial?.trim() || undefined,
    }
    let mapped = await this.fetchSearchRows(criteria, { nearestConfig: config.nearest })
    if (!mapped.length) {
      const productId = await this.resolveDefaultParametricProductId()
      mapped = await this.fetchSearchRows(criteria, { productId, nearestConfig: config.nearest })
    }
    return this.buildSearchResult(mapped, criteria, request, limit, config.nearest, marginMultiplier)
  }

  private async fetchSearchRows(
    criteria: ParametricMatrixSearchDto,
    options: { productId?: number | null; nearestConfig?: AberturasConfig['nearest'] },
  ): Promise<ParametricMatrixEntry[]> {
    const productId = typeof options.productId === 'number' ? options.productId : undefined
    const dimensionAwareWhere = this.buildMatrixWhere(productId, criteria, {
      restrictSerie: true,
      applyDimensions: true,
      nearestConfig: options.nearestConfig,
    })
    let rows = await this.queryMatrixRows(dimensionAwareWhere)

    if (!rows.length && this.hasDimensionCriteria(criteria)) {
      const relaxedSameSerie = this.buildMatrixWhere(productId, criteria, {
        restrictSerie: true,
        applyDimensions: false,
        nearestConfig: options.nearestConfig,
      })
      rows = await this.queryMatrixRows(relaxedSameSerie)
    }

    if (!rows.length && criteria.serie) {
      let fallbackWhere = this.buildMatrixWhere(productId, criteria, {
        restrictSerie: false,
        applyDimensions: true,
        nearestConfig: options.nearestConfig,
      })
      rows = await this.queryMatrixRows(fallbackWhere)
      if (!rows.length && this.hasDimensionCriteria(criteria)) {
        fallbackWhere = this.buildMatrixWhere(productId, criteria, {
          restrictSerie: false,
          applyDimensions: false,
          nearestConfig: options.nearestConfig,
        })
        rows = await this.queryMatrixRows(fallbackWhere)
      }
    }

    return rows.map((row) => this.mapMatrixEntry(row))
  }

  private buildSearchResult(
    rows: ParametricMatrixEntry[],
    criteria: ParametricMatrixSearchDto,
    request: { hasMosquitero: boolean; hasShutterMonoblock: boolean; shutterMaterial?: string },
    limit: number,
    nearestConfig: AberturasConfig['nearest'] | undefined,
    marginMultiplier: number,
  ): ParametricMatrixSearchResult {
    const rankedMatches = this.rankMatrixMatches(rows, criteria, request, undefined, marginMultiplier)
    const exactMatch = rankedMatches.find((match) => match.matchLevel === 'exact')
    const nearestPool = rankedMatches.filter((match) => !exactMatch || match.row.id !== exactMatch.row.id)
    const configuredNearestLimit = nearestConfig?.maxResults ?? 3
    const nearestLimit = Math.min(Math.max(configuredNearestLimit, 1), Math.max(limit, 1))
    const nearestMatches = nearestPool.slice(0, nearestLimit)
    const excludedIds = new Set<number>()
    if (exactMatch) {
      excludedIds.add(exactMatch.row.id)
    }
    nearestMatches.forEach((match) => excludedIds.add(match.row.id))
    const suggestions = rankedMatches.filter((match) => !excludedIds.has(match.row.id)).slice(0, limit)

    return {
      exact: exactMatch ?? undefined,
      nearest: nearestMatches,
      suggestions,
    }
  }

  private async getCompatibilityConfig(_productId: number): Promise<ParametricCompatibilityConfig> {
    // Compatibility rules are currently disabled for Urucortinas.
    // Returning an empty object keeps the rest of the service logic intact
    // without requiring additional tables/migrations.
    return {}
  }

  async updateCompatibilityConfig(productId: number, payload: ParametricCompatibilityConfig) {
    this.assertFeatureEnabled()
    await this.prisma.$transaction(async (tx) => {
      await tx.parametricCompatibilityRule.deleteMany({ where: { productId } })
      const inserts: Array<{
        productId: number
        type: string
        ruleKey: string
        ruleValue: any
      }> = []
      if (payload.glassBySeries) {
        for (const [series, values] of Object.entries(payload.glassBySeries)) {
          inserts.push({
            productId,
            type: 'glass_by_series',
            ruleKey: series,
            ruleValue: values,
          })
        }
      }
      if (payload.monoblockBySeries) {
        for (const [series, allowed] of Object.entries(payload.monoblockBySeries)) {
          inserts.push({
            productId,
            type: 'monoblock_by_series',
            ruleKey: series,
            ruleValue: Boolean(allowed),
          })
        }
      }
      if (payload.sizeLimits) {
        for (const [series, limits] of Object.entries(payload.sizeLimits)) {
          inserts.push({
            productId,
            type: 'size_limits',
            ruleKey: series,
            ruleValue: {
              minWidthMm: limits.minWidthMm ?? null,
              maxWidthMm: limits.maxWidthMm ?? null,
              minHeightMm: limits.minHeightMm ?? null,
              maxHeightMm: limits.maxHeightMm ?? null,
            },
          })
        }
      }
      if (inserts.length) {
        await tx.parametricCompatibilityRule.createMany({ data: inserts })
      }
    })
    return this.getCompatibilityConfig(productId)
  }

  private mapMatrixEntry(row: DimensionPriceMatrix): ParametricMatrixEntry {
    const shutterOptionsSnapshot: Record<string, ParametricShutterSnapshot> = {}
    const normalizedShutterMaterial = (row.shutterSystem ?? '').trim()
    if (
      (row.priceMonoblock !== null && row.priceMonoblock !== undefined) ||
      (row.priceMonoblockMosquitero !== null && row.priceMonoblockMosquitero !== undefined)
    ) {
      const key = normalizedShutterMaterial || 'GENERICA'
      shutterOptionsSnapshot[key] = {
        price: this.normalizeDecimal(row.priceMonoblock),
        priceMosq: this.normalizeDecimal(row.priceMonoblockMosquitero),
      }
    }

    return {
      id: row.id,
      familyId: row.familyId,
      serie: row.serie,
      material: row.material,
      color: row.color,
      vidrio: row.vidrio,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      price: this.normalizeDecimal(row.price) ?? 0,
      priceBase: this.normalizeDecimal(row.priceBase),
      priceMosquitero: this.normalizeDecimal(row.priceMosquitero),
      priceMonoblock: this.normalizeDecimal(row.priceMonoblock),
      priceMonoblockMosquitero: this.normalizeDecimal(row.priceMonoblockMosquitero),
      hasMosquiteroOption: Boolean(row.hasMosquiteroOption),
      hasMonoblockOption: Boolean(row.hasMonoblockOption),
      hasShutterMonoblock: Boolean(row.hasShutterMonoblock),
      shutterMaterial: row.shutterSystem ?? '',
      currency: row.currency,
      detailSnapshot: row.detailSnapshot ?? null,
      specifications: row.detailSnapshot ?? null,
      shutterOptionsSnapshot: Object.keys(shutterOptionsSnapshot).length ? shutterOptionsSnapshot : undefined,
      priceLineage: this.parsePriceLineage(row.priceLineage as Prisma.JsonValue | null),
      conflictFlags: row.conflictFlags ?? [],
      source: row.source ?? null,
      referenceDate: row.referenceDate ? row.referenceDate.toISOString() : null,
    }
  }

  private buildMatrixWhere(
    productId: number | undefined,
    criteria: ParametricMatrixSearchDto,
    options?: { restrictSerie?: boolean; applyDimensions?: boolean; nearestConfig?: AberturasConfig['nearest'] },
  ): Prisma.DimensionPriceMatrixWhereInput {
    const where: Prisma.DimensionPriceMatrixWhereInput = {}
    if (typeof productId === 'number') {
      where.productId = productId
    }
    if (criteria.familyId) {
      where.familyId = criteria.familyId
    }
    if (criteria.serie && options?.restrictSerie !== false) {
      where.serie = criteria.serie
    }
    if (options?.applyDimensions !== false) {
      const dimensionFilter = this.buildDimensionFilter(criteria, options?.nearestConfig)
      if (dimensionFilter?.widthMm) {
        where.widthMm = dimensionFilter.widthMm
      }
      if (dimensionFilter?.heightMm) {
        where.heightMm = dimensionFilter.heightMm
      }
    }
    return where
  }

  private hasDimensionCriteria(criteria: ParametricMatrixSearchDto): boolean {
    return Boolean(
      (typeof criteria.widthMm === 'number' && criteria.widthMm > 0) ||
        (typeof criteria.heightMm === 'number' && criteria.heightMm > 0),
    )
  }

  private buildDimensionFilter(
    criteria: ParametricMatrixSearchDto,
    nearestConfig?: AberturasConfig['nearest'],
  ): null | { widthMm?: Prisma.IntFilter; heightMm?: Prisma.IntFilter } {
    const bounds: { widthMm?: Prisma.IntFilter; heightMm?: Prisma.IntFilter } = {}
    const width = typeof criteria.widthMm === 'number' && criteria.widthMm > 0 ? criteria.widthMm : null
    const height = typeof criteria.heightMm === 'number' && criteria.heightMm > 0 ? criteria.heightMm : null

    const computeRange = (value: number): Prisma.IntFilter => {
      const tolerancePercent = (nearestConfig?.dimensionTolerancePercent ?? 12) / 100
      const minTolerance = nearestConfig?.dimensionMinToleranceMm ?? 40
      const tolerance = Math.max(minTolerance, value * tolerancePercent)
      const lower = Math.max(0, Math.floor(value - tolerance))
      const upper = Math.ceil(value + tolerance)
      return { gte: lower, lte: upper }
    }

    if (width) {
      bounds.widthMm = computeRange(width)
    }
    if (height) {
      bounds.heightMm = computeRange(height)
    }

    return bounds.widthMm || bounds.heightMm ? bounds : null
  }

  private async queryMatrixRows(where: Prisma.DimensionPriceMatrixWhereInput): Promise<DimensionPriceMatrix[]> {
    return this.prisma.dimensionPriceMatrix.findMany({
      where,
      orderBy: [
        { widthMm: 'asc' },
        { heightMm: 'asc' },
        { serie: 'asc' },
        { color: 'asc' },
      ],
      take: 500,
    })
  }

  private rankMatrixMatches(
    rows: ParametricMatrixEntry[],
    criteria: ParametricMatrixSearchDto,
    request: { hasMosquitero: boolean; hasShutterMonoblock: boolean; shutterMaterial?: string },
    excludeId: number | undefined,
    marginMultiplier: number,
  ): ParametricMatrixMatch[] {
    const evaluated: ParametricMatrixMatch[] = []
    for (const row of rows) {
      if (!this.hasValidPrice(row)) {
        continue
      }
      if (excludeId && row.id === excludeId) {
        continue
      }
      const match = this.evaluateMatrixRow(row, criteria, request, marginMultiplier)
      if (match) {
        evaluated.push(match)
      }
    }
    evaluated.sort((a, b) => this.compareMatches(a, b))
    return this.dedupeMatchesByCombination(evaluated)
  }

  private dedupeMatchesByCombination(matches: ParametricMatrixMatch[]): ParametricMatrixMatch[] {
    const seen = new Map<string, ParametricMatrixMatch>()
    const result: ParametricMatrixMatch[] = []
    for (const match of matches) {
      const key = this.buildCombinationKey(match.row)
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, match)
        result.push(match)
      } else {
        this.mergeMatchRows(existing.row, match.row)
        if (!existing.suggestedAdjustment && match.suggestedAdjustment) {
          existing.suggestedAdjustment = match.suggestedAdjustment
        }
        if (existing.metadata && match.metadata) {
          existing.metadata.sizeDeltaMm = existing.metadata.sizeDeltaMm ?? match.metadata.sizeDeltaMm
          if (!existing.metadata.suggestedAdjustment && match.metadata.suggestedAdjustment) {
            existing.metadata.suggestedAdjustment = match.metadata.suggestedAdjustment
          }
        }
      }
    }
    return result
  }

  private hasValidPrice(row: ParametricMatrixEntry): boolean {
    const priceCandidates = [row.priceBase, row.priceMosquitero, row.priceMonoblock, row.priceMonoblockMosquitero]
    return priceCandidates.some((value) => typeof value === 'number' && Number.isFinite(value))
  }

  private compareMatches(a: ParametricMatrixMatch, b: ParametricMatrixMatch): number {
    const metaA = a.metadata
    const metaB = b.metadata

    const serieComparison = this.compareBoolean(metaA?.attributeMatches.serie, metaB?.attributeMatches.serie)
    if (serieComparison !== 0) {
      return serieComparison
    }

    const distanceComparison = this.compareNumbers(metaA?.dimensionDistance, metaB?.dimensionDistance)
    if (distanceComparison !== 0) {
      return distanceComparison
    }

    const sizePreferenceComparison = this.compareBoolean(
      this.prefersLargerDimensions(metaA),
      this.prefersLargerDimensions(metaB),
    )
    if (sizePreferenceComparison !== 0) {
      return sizePreferenceComparison
    }

    const glassComparison = this.compareNumbers(metaA?.glassRankDelta, metaB?.glassRankDelta)
    if (glassComparison !== 0) {
      return glassComparison
    }

    const colorComparison = this.compareBoolean(metaA?.attributeMatches.color, metaB?.attributeMatches.color)
    if (colorComparison !== 0) {
      return colorComparison
    }

    const familyComparison = this.compareBoolean(metaA?.attributeMatches.family, metaB?.attributeMatches.family)
    if (familyComparison !== 0) {
      return familyComparison
    }

    const levelComparison = this.compareMatchLevel(a.matchLevel, b.matchLevel)
    if (levelComparison !== 0) {
      return levelComparison
    }

    return (a.row.id ?? 0) - (b.row.id ?? 0)
  }

  private compareBoolean(a?: boolean, b?: boolean): number {
    const av = Boolean(a)
    const bv = Boolean(b)
    if (av === bv) {
      return 0
    }
    return av ? -1 : 1
  }

  private prefersLargerDimensions(metadata?: ParametricMatchMetadata): boolean {
    if (!metadata?.sizeDeltaMm) {
      return true
    }
    const { width, height } = metadata.sizeDeltaMm
    const widthOk = typeof width !== 'number' ? true : width >= 0
    const heightOk = typeof height !== 'number' ? true : height >= 0
    return widthOk && heightOk
  }

  private compareNumbers(a?: number, b?: number): number {
    const av = typeof a === 'number' && Number.isFinite(a) ? a : Number.POSITIVE_INFINITY
    const bv = typeof b === 'number' && Number.isFinite(b) ? b : Number.POSITIVE_INFINITY
    if (av === bv) {
      return 0
    }
    return av < bv ? -1 : 1
  }

  private compareMatchLevel(a: ParametricMatrixMatch['matchLevel'], b: ParametricMatrixMatch['matchLevel']): number {
    const order: Record<ParametricMatrixMatch['matchLevel'], number> = {
      exact: 0,
      near: 1,
      none: 2,
    }
    return (order[a] ?? 99) - (order[b] ?? 99)
  }

  private buildCombinationKey(row: ParametricMatrixEntry): string {
    return [row.familyId, row.serie, row.material, row.color, row.vidrio, row.widthMm, row.heightMm]
      .map((value) => (value ?? '').toString().trim().toLowerCase())
      .join('|')
  }

  private mergeMatchRows(target: ParametricMatrixEntry, source: ParametricMatrixEntry) {
    const takeNumber = (current: number | null | undefined, incoming: number | null | undefined) => {
      if (typeof current === 'number' && current > 0) {
        return current
      }
      if (typeof incoming === 'number' && incoming > 0) {
        return incoming
      }
      return current ?? incoming ?? null
    }

    target.priceBase = takeNumber(target.priceBase, source.priceBase)
    target.priceMosquitero = takeNumber(target.priceMosquitero, source.priceMosquitero)
    target.priceMonoblock = takeNumber(target.priceMonoblock, source.priceMonoblock)
    target.priceMonoblockMosquitero = takeNumber(target.priceMonoblockMosquitero, source.priceMonoblockMosquitero)

    target.hasMosquiteroOption = target.hasMosquiteroOption || source.hasMosquiteroOption
    target.hasMonoblockOption = target.hasMonoblockOption || source.hasMonoblockOption
    target.hasShutterMonoblock = target.hasShutterMonoblock || source.hasShutterMonoblock
    if (!target.shutterMaterial && source.shutterMaterial) {
      target.shutterMaterial = source.shutterMaterial
    }

    if (!target.detailSnapshot && source.detailSnapshot) {
      target.detailSnapshot = source.detailSnapshot
    }
    if (!target.specifications && source.specifications) {
      target.specifications = source.specifications
    }
    if (!target.source && source.source) {
      target.source = source.source
    }
    if (!target.referenceDate && source.referenceDate) {
      target.referenceDate = source.referenceDate
    }

    // If the primary price was missing, ensure `price` mirrors the best available base price.
    if (!target.price || target.price <= 0) {
      const fallback = takeNumber(target.price, source.price)
      target.price = typeof fallback === 'number' ? fallback : target.price
    }

    if (source.shutterOptionsSnapshot) {
      target.shutterOptionsSnapshot = target.shutterOptionsSnapshot ?? {}
      for (const [material, snapshot] of Object.entries(source.shutterOptionsSnapshot)) {
        const existing = target.shutterOptionsSnapshot[material] ?? {}
        target.shutterOptionsSnapshot[material] = {
          price: takeNumber(existing.price ?? null, snapshot.price ?? null),
          priceMosq: takeNumber(existing.priceMosq ?? null, snapshot.priceMosq ?? null),
        }
      }
    }
  }

  private getConfiguredParametricProductId(): number | null {
    const metadataSources: Array<Record<string, unknown> | undefined> = [
      this.clientConfig?.metadata,
      this.clientConfig?.backend?.metadata,
      this.clientConfig?.shared,
    ]
    const keys = ['aberturasParametricProductId', 'parametricProductId', 'DEFAULT_PARAMETRIC_PRODUCT_ID']
    for (const source of metadataSources) {
      if (!source) {
        continue
      }
      for (const key of keys) {
        const candidate = source[key]
        const numeric = Number(candidate)
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric
        }
      }
    }
    return null
  }

  private async resolveDefaultParametricProductId(): Promise<number> {
    const configured = this.getConfiguredParametricProductId()
    if (configured) {
      return configured
    }
    const fallback = await this.prisma.dimensionPriceMatrix.findFirst({
      select: { productId: true },
      orderBy: { productId: 'asc' },
    })
    if (!fallback) {
      throw new NotFoundException('No hay matrices paramétricas disponibles.')
    }
    return fallback.productId
  }

  private evaluateMatrixRow(
    row: ParametricMatrixEntry,
    criteria: ParametricMatrixSearchDto,
    request: { hasMosquitero: boolean; hasShutterMonoblock: boolean; shutterMaterial?: string },
    marginMultiplier: number,
  ): ParametricMatrixMatch | null {
    const resolution = this.resolvePriceForRequest(row, request, marginMultiplier)
    if (!resolution.available) {
      return null
    }
    const metadata = this.computeMatchMetadata(row, criteria)
    return {
      row,
      resolution,
      similarity: metadata.similarityScore,
      metadata,
      matchLevel: metadata.matchLevel,
      suggestedAdjustment: metadata.suggestedAdjustment,
    }
  }

  private computeMatchMetadata(
    row: ParametricMatrixEntry,
    criteria: ParametricMatrixSearchDto,
  ): ParametricMatchMetadata {
    const widthRequested = typeof criteria.widthMm === 'number' ? criteria.widthMm : null
    const heightRequested = typeof criteria.heightMm === 'number' ? criteria.heightMm : null

    const widthDelta = widthRequested !== null ? row.widthMm - widthRequested : 0
    const heightDelta = heightRequested !== null ? row.heightMm - heightRequested : 0
    const dimensionDistance =
      widthRequested !== null || heightRequested !== null
        ? Math.sqrt(
            (widthRequested !== null ? widthDelta : 0) ** 2 + (heightRequested !== null ? heightDelta : 0) ** 2,
          )
        : 0

    const familyMatch = !criteria.familyId || row.familyId === criteria.familyId
    const serieMatch = !criteria.serie || row.serie === criteria.serie
    const widthMatch = widthRequested === null || row.widthMm === widthRequested
    const heightMatch = heightRequested === null || row.heightMm === heightRequested
    const vidrioMatch = !criteria.vidrio || row.vidrio === criteria.vidrio
    const colorMatch = !criteria.color || row.color === criteria.color
    const glassRankDelta = criteria.vidrio ? Math.abs(this.getGlassRank(row.vidrio) - this.getGlassRank(criteria.vidrio)) : undefined
    const similarityScore = dimensionDistance
    const attributeMatches = {
      family: familyMatch,
      serie: serieMatch,
      width: widthMatch,
      height: heightMatch,
      vidrio: vidrioMatch,
      color: colorMatch,
    }
    const matchLevel = attributeMatches.serie
      ? attributeMatches.family &&
        attributeMatches.width &&
        attributeMatches.height &&
        attributeMatches.vidrio &&
        attributeMatches.color
        ? 'exact'
        : 'near'
      : 'none'

    const suggestedAdjustment = this.buildSuggestedAdjustment(criteria, row, attributeMatches)
    const sizeDeltaMm =
      widthRequested !== null && heightRequested !== null
        ? { width: widthDelta, height: heightDelta }
        : undefined

    return {
      matchLevel,
      similarityScore,
      dimensionDistance,
      attributeMatches,
      sizeDeltaMm,
      glassRankDelta,
      suggestedAdjustment,
    }
  }

  private buildSuggestedAdjustment(
    criteria: ParametricMatrixSearchDto,
    row: ParametricMatrixEntry,
    attributeMatches: ParametricMatchMetadata['attributeMatches'],
  ): ParametricMatchAdjustment | undefined {
    const notes: string[] = []
    let minFactor = 1
    let maxFactor = 1

    if (!attributeMatches.color && criteria.color) {
      notes.push(`Color diferente: pedido ${criteria.color}, disponible ${row.color}`)
      minFactor = Math.min(minFactor, 0.92)
      maxFactor = Math.max(maxFactor, 1.15)
    }

    if (!attributeMatches.vidrio && criteria.vidrio) {
      notes.push(`Vidrio diferente: pedido ${criteria.vidrio}, disponible ${row.vidrio}`)
      minFactor = Math.min(minFactor, 0.95)
      maxFactor = Math.max(maxFactor, 1.08)
    }

    if (!notes.length) {
      return undefined
    }

    return {
      priceRangeFactor: [Number(minFactor.toFixed(2)), Number(maxFactor.toFixed(2))],
      note: notes.join(' | '),
    }
  }

  private getGlassRank(value?: string | null): number {
    if (!value) {
      return Number.MAX_SAFE_INTEGER
    }
    const normalized = value.toUpperCase()
    const index = ParametricPricingService.GLASS_PRIORITY.findIndex((entry) => entry === normalized)
    return index >= 0 ? index : ParametricPricingService.GLASS_PRIORITY.length
  }

  private resolvePriceForRequest(
    row: ParametricMatrixEntry,
    request: { hasMosquitero: boolean; hasShutterMonoblock: boolean; shutterMaterial?: string },
    marginMultiplier: number,
  ): ParametricPriceResolution {
    const base = typeof row.priceBase === 'number' ? row.priceBase : null
    if (!request.hasMosquitero && !request.hasShutterMonoblock) {
      if (base === null || base === undefined || Number.isNaN(base)) {
        return { available: false, reason: 'missing_base' }
      }
      const price = base > 0 ? this.applyMarkupToPrice(base, marginMultiplier) : 0
      return {
        available: true,
        price,
        currency: row.currency,
        estimated: false,
        components: ['base'],
      }
    }

    if (request.hasShutterMonoblock) {
      if (!row.hasMonoblockOption || !row.hasShutterMonoblock) {
        return { available: false, reason: 'mb_not_allowed' }
      }
      if (request.shutterMaterial) {
        const sameMaterial = row.shutterMaterial?.toLowerCase() === request.shutterMaterial.toLowerCase()
        if (!sameMaterial) {
          return { available: false, reason: 'shutter_material_mismatch' }
        }
      }
      if (request.hasMosquitero) {
        if (!row.priceMonoblockMosquitero || row.priceMonoblockMosquitero <= 0) {
          return { available: false, reason: 'missing_price_mbm' }
        }
        const price = this.applyMarkupToPrice(row.priceMonoblockMosquitero, marginMultiplier)
        return {
          available: true,
          price,
          currency: row.currency,
          estimated: false,
          components: ['base', 'shutter', 'mosquitero'],
        }
      }
      if (!row.priceMonoblock || row.priceMonoblock <= 0) {
        return { available: false, reason: 'missing_price_mb' }
      }
      const price = this.applyMarkupToPrice(row.priceMonoblock, marginMultiplier)
      return {
        available: true,
        price,
        currency: row.currency,
        estimated: false,
        components: ['base', 'shutter'],
      }
    }

    if (request.hasMosquitero) {
      if (!row.hasMosquiteroOption || !row.priceMosquitero || row.priceMosquitero <= 0) {
        return { available: false, reason: 'missing_price_mosq' }
      }
      const price = this.applyMarkupToPrice(row.priceMosquitero, marginMultiplier)
      return {
        available: true,
        price,
        currency: row.currency,
        estimated: false,
        components: ['base', 'mosquitero'],
      }
    }

    if (!base || base <= 0) {
      return { available: false, reason: 'missing_base' }
    }
    const price = this.applyMarkupToPrice(base, marginMultiplier)
    return {
      available: true,
      price,
      currency: row.currency,
      estimated: false,
      components: ['base'],
    }
  }

  private async getDistinctValues<T extends string | number | boolean>(
    productId: number,
    field: keyof ParametricMatrixRow | 'shutterSystem',
  ): Promise<T[]> {
    const records = await this.prisma.dimensionPriceMatrix.findMany({
      where: { productId },
      distinct: [field as any],
      select: {
        [field]: true,
      },
    })
    const values = records.reduce<T[]>((acc, row) => {
      const raw = (row as Record<string, unknown>)[field]
      if (raw === null || raw === undefined) {
        return acc
      }
      if (typeof raw === 'string' && !raw.trim()) {
        return acc
      }
      acc.push(raw as T)
      return acc
    }, [])
    const unique = Array.from(new Set(values))
    unique.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      if (typeof a === 'boolean' && typeof b === 'boolean') {
        return Number(a) - Number(b)
      }
      return String(a).localeCompare(String(b))
    })
    return unique
  }

  async getProductConfig(productId: number): Promise<ParametricConfigSnapshot> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)
    const [
      rowCount,
      minPriceRow,
      selectors,
      referenceRange,
      mosquiteroOptionCount,
      monoblockOptionCount,
      marginMultiplier,
    ] = await Promise.all([
      this.prisma.dimensionPriceMatrix.count({ where: { productId } }),
      this.prisma.dimensionPriceMatrix.findFirst({
        where: { productId, price: { gt: 0 } },
        orderBy: { price: 'asc' },
        select: { price: true, currency: true },
      }),
      Promise.all([
        this.getDistinctValues<string>(productId, 'familyId'),
        this.getDistinctValues<string>(productId, 'serie'),
        this.getDistinctValues<string>(productId, 'material'),
        this.getDistinctValues<string>(productId, 'color'),
        this.getDistinctValues<string>(productId, 'vidrio'),
        this.getDistinctValues<number>(productId, 'widthMm'),
        this.getDistinctValues<number>(productId, 'heightMm'),
        this.getDistinctValues<string>(productId, 'shutterSystem'),
      ]),
      this.prisma.dimensionPriceMatrix.aggregate({
        where: { productId, referenceDate: { not: null } },
        _min: { referenceDate: true },
        _max: { referenceDate: true },
      }),
      this.prisma.dimensionPriceMatrix.count({
        where: { productId, hasMosquiteroOption: true },
      }),
      this.prisma.dimensionPriceMatrix.count({
        where: { productId, hasMonoblockOption: true },
      }),
      this.resolveMarkupMultiplier(),
    ])

    let compatibility: ParametricCompatibilityConfig = {}
    try {
      compatibility = await this.getCompatibilityConfig(productId)
    } catch (error) {
      const err = error as Error
      this.logger.error(`Failed to load parametric compatibility for product ${productId}: ${err.message}`, err.stack)
    }

    const [families, series, materials, colors, glass, widths, heights, shutterMaterialsRaw] = selectors

    const fallbackSelectors = await this.getAberturasFallbackSelectors()
    const mergedSelectors = {
      families: this.mergeSelectors(families, fallbackSelectors?.families),
      series: this.mergeSelectors(series, fallbackSelectors?.series),
      materials: materials.length ? materials : ['ALUMINIO'],
      colors: this.mergeSelectors(colors, fallbackSelectors?.colors),
      glass: this.mergeSelectors(glass, fallbackSelectors?.glass),
      widths,
      heights,
      shutterMaterials: this.mergeSelectors(shutterMaterialsRaw.filter((value) => value !== ''), ['PVC', 'ALUMINIO']),
      hasMosquiteroOption: mosquiteroOptionCount > 0,
      hasMonoblockOption: monoblockOptionCount > 0,
    }

    return {
      selectors: mergedSelectors,
      stats: {
        rowCount,
        minimumPrice: minPriceRow
          ? this.applyMarkupToPrice(Number(minPriceRow.price.toFixed(4)), marginMultiplier)
          : undefined,
        currency: minPriceRow?.currency,
        newestReferenceDate:
          referenceRange && referenceRange._max?.referenceDate
            ? referenceRange._max.referenceDate.toISOString()
            : null,
        oldestReferenceDate:
          referenceRange && referenceRange._min?.referenceDate
            ? referenceRange._min.referenceDate.toISOString()
            : null,
      },
      compatibility,
    }
  }

  async getCompatibility(productId: number): Promise<ParametricCompatibilityConfig> {
    this.assertFeatureEnabled()
    await this.ensureProduct(productId)
    return this.getCompatibilityConfig(productId)
  }

  private isCombinationAllowed(
    compatibility: ParametricCompatibilityConfig,
    input: ParametricQuoteInput,
  ): string | null {
    const series = input.serie
    const glass = input.vidrio
    if (compatibility.glassBySeries && compatibility.glassBySeries[series]) {
      const allowed = compatibility.glassBySeries[series]
      if (!allowed.includes(glass)) {
        return 'Selected glass is not allowed for the chosen series.'
      }
    }
    if (compatibility.monoblockBySeries && compatibility.monoblockBySeries[series] === false) {
      if (input.hasShutterMonoblock) {
        return 'Monoblock is not allowed for the selected series.'
      }
    }
    if (compatibility.sizeLimits && compatibility.sizeLimits[series]) {
      const limits = compatibility.sizeLimits[series]
      if (typeof limits.minWidthMm === 'number' && input.widthMm < limits.minWidthMm) {
        return 'Width is below the allowed minimum for the selected series.'
      }
      if (typeof limits.maxWidthMm === 'number' && input.widthMm > limits.maxWidthMm) {
        return 'Width exceeds the allowed maximum for the selected series.'
      }
      if (typeof limits.minHeightMm === 'number' && input.heightMm < limits.minHeightMm) {
        return 'Height is below the allowed minimum for the selected series.'
      }
      if (typeof limits.maxHeightMm === 'number' && input.heightMm > limits.maxHeightMm) {
        return 'Height exceeds the allowed maximum for the selected series.'
      }
    }
    return null
  }

  async quote(input: ParametricQuoteInput): Promise<ParametricQuoteResult> {
    this.assertFeatureEnabled()
    const productId = Number(input.productId)
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('A valid productId is required')
    }

    await this.ensureProduct(productId)

    const [compatibility, marginMultiplier] = await Promise.all([
      this.getCompatibilityConfig(productId),
      this.resolveMarkupMultiplier(),
    ])
    const compatibilityError = this.isCombinationAllowed(compatibility, input)
    const requested = {
      familyId: input.familyId ?? null,
      serie: this.normalizeString(input.serie),
      material: this.normalizeString(input.material),
      color: this.normalizeString(input.color),
      vidrio: this.normalizeString(input.vidrio),
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      hasMosquitero: Boolean(input.hasMosquitero),
      hasShutterMonoblock: Boolean(input.hasShutterMonoblock),
      shutterMaterial: this.normalizeString(input.shutterMaterial ?? ''),
    }

    if (compatibilityError) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    const normalizedShutterMaterial = this.normalizeString(requested.shutterMaterial ?? '')
    const baseWhere: Prisma.DimensionPriceMatrixWhereInput = {
      productId,
      serie: requested.serie,
      material: requested.material,
      color: requested.color,
      vidrio: requested.vidrio,
      widthMm: requested.widthMm,
      heightMm: requested.heightMm,
      hasShutterMonoblock: false,
      shutterSystem: '',
    }

    const baseRow = await this.prisma.dimensionPriceMatrix.findFirst({
      where: baseWhere,
    })

    if (baseRow) {
      const resolved = this.resolveQuoteFromBaseRow(baseRow, requested, productId, marginMultiplier)
      if (resolved) {
        return resolved
      }
    }

    const matrixWhere: Prisma.DimensionPriceMatrixWhereInput = {
      productId,
      serie: requested.serie,
      material: requested.material,
      color: requested.color,
      vidrio: requested.vidrio,
      widthMm: requested.widthMm,
      heightMm: requested.heightMm,
      hasShutterMonoblock: requested.hasShutterMonoblock,
    }
    if (requested.hasShutterMonoblock) {
      if (normalizedShutterMaterial) {
        matrixWhere.shutterSystem = normalizedShutterMaterial
      }
    } else {
      matrixWhere.shutterSystem = ''
    }

    let matrixRow = await this.prisma.dimensionPriceMatrix.findFirst({
      where: matrixWhere,
    })

    if (!matrixRow && requested.hasShutterMonoblock) {
      const fallbackWhere = { ...matrixWhere }
      delete fallbackWhere.shutterSystem
      matrixRow = await this.prisma.dimensionPriceMatrix.findFirst({
        where: fallbackWhere,
      })
    }

    if (!matrixRow) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    const priceBase =
      matrixRow.priceBase !== null && matrixRow.priceBase !== undefined
        ? Number(matrixRow.priceBase.toFixed(4))
        : 0
    const priceMosquitero =
      matrixRow.priceMosquitero !== null && matrixRow.priceMosquitero !== undefined
        ? Number(matrixRow.priceMosquitero.toFixed(4))
        : 0
    const priceMonoblock =
      matrixRow.priceMonoblock !== null && matrixRow.priceMonoblock !== undefined
        ? Number(matrixRow.priceMonoblock.toFixed(4))
        : 0
    const priceMonoblockMosquitero =
      matrixRow.priceMonoblockMosquitero !== null && matrixRow.priceMonoblockMosquitero !== undefined
        ? Number(matrixRow.priceMonoblockMosquitero.toFixed(4))
        : 0

    const mosquiteroEnabled = Boolean(matrixRow.hasMosquiteroOption) && priceMosquitero > 0
    const monoblockEnabled = Boolean(matrixRow.hasMonoblockOption) && (priceMonoblock > 0 || priceMonoblockMosquitero > 0)

    if (requested.hasMosquitero && !mosquiteroEnabled) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    if (requested.hasShutterMonoblock && !monoblockEnabled) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    let finalCost = priceBase
    if (requested.hasShutterMonoblock) {
      finalCost = requested.hasMosquitero ? priceMonoblockMosquitero : priceMonoblock
    } else if (requested.hasMosquitero) {
      finalCost = priceMosquitero
    }

    const isBaseRequest = !requested.hasMosquitero && !requested.hasShutterMonoblock
    const allowZero = isBaseRequest && finalCost === 0
    if (!Number.isFinite(finalCost) || finalCost < 0 || (finalCost === 0 && !allowZero)) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    requested.shutterMaterial = this.normalizeString(matrixRow.shutterSystem ?? '')

    const specifications = matrixRow.detailSnapshot ?? null
    return {
      productId,
      available: true,
      price: this.applyMarkupToPrice(finalCost, marginMultiplier),
      currency: matrixRow.currency,
      detailSnapshot: specifications,
      specifications,
      source: matrixRow.source ?? null,
      referenceDate: matrixRow.referenceDate ? matrixRow.referenceDate.toISOString() : null,
      matrixRowId: matrixRow.id,
      requested,
    }
  }

  private resolveQuoteFromBaseRow(
    matrixRow: DimensionPriceMatrix,
    requested: ParametricQuoteResult['requested'],
    productId: number,
    marginMultiplier: number,
  ): ParametricQuoteResult | null {
    const priceBase =
      matrixRow.priceBase !== null && matrixRow.priceBase !== undefined
        ? Number(matrixRow.priceBase.toFixed(4))
        : 0
    const priceMosquitero =
      matrixRow.priceMosquitero !== null && matrixRow.priceMosquitero !== undefined
        ? Number(matrixRow.priceMosquitero.toFixed(4))
        : 0
    const priceMonoblock =
      matrixRow.priceMonoblock !== null && matrixRow.priceMonoblock !== undefined
        ? Number(matrixRow.priceMonoblock.toFixed(4))
        : 0
    const priceMonoblockMosquitero =
      matrixRow.priceMonoblockMosquitero !== null && matrixRow.priceMonoblockMosquitero !== undefined
        ? Number(matrixRow.priceMonoblockMosquitero.toFixed(4))
        : 0

    const mosquiteroEnabled = Boolean(matrixRow.hasMosquiteroOption) && priceMosquitero > 0
    const monoblockEnabled = Boolean(matrixRow.hasMonoblockOption) && (priceMonoblock > 0 || priceMonoblockMosquitero > 0)

    if (requested.hasMosquitero && !mosquiteroEnabled) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    if (requested.hasShutterMonoblock && !monoblockEnabled) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    let finalCost = priceBase
    if (requested.hasShutterMonoblock) {
      finalCost = requested.hasMosquitero ? priceMonoblockMosquitero : priceMonoblock
    } else if (requested.hasMosquitero) {
      finalCost = priceMosquitero
    }

    const isBaseRequest = !requested.hasMosquitero && !requested.hasShutterMonoblock
    const allowZero = isBaseRequest && finalCost === 0
    if (!Number.isFinite(finalCost) || finalCost < 0 || (finalCost === 0 && !allowZero)) {
      return {
        productId,
        available: false,
        requested,
      }
    }

    requested.shutterMaterial = this.normalizeString(matrixRow.shutterSystem ?? '')

    return {
      productId,
      available: true,
      price: this.applyMarkupToPrice(finalCost, marginMultiplier),
      currency: matrixRow.currency,
      detailSnapshot: matrixRow.detailSnapshot ?? null,
      source: matrixRow.source ?? null,
      referenceDate: matrixRow.referenceDate ? matrixRow.referenceDate.toISOString() : null,
      matrixRowId: matrixRow.id,
      requested,
    }
  }
}
