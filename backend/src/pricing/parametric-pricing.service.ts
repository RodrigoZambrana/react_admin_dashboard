import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, ProductMode, ParametricModifierType, ParametricAdjustmentMode } from '@prisma/client'
import * as XLSX from 'xlsx'
import { PrismaService } from '../prisma/prisma.service'
import { CLIENT_CONFIG_TOKEN } from '../config/client-config.constants'
import type { ClientVariantConfig } from '../config/client-config.types'
import { CurrencyConversionService } from '../common/currency/currency-conversion.service'
import {
  decimal,
  decimalToNumber,
  multiplyDecimals,
  roundDecimal,
} from '../common/currency/money.util'
import type { PrismaClientOrTransaction } from './types'
import {
  DEFAULT_PARAMETRIC_SCHEMA,
  normalizeColor,
  normalizeGlass,
  normalizeSeries,
  normalizeYesNo,
  sanitizeDecimalInput,
} from './parametric-utils'
import type {
  ParametricQuoteInput,
  ParametricQuoteResult,
  ParametricModifierSnapshot,
  ParametricImportSummary,
} from './types'
@Injectable()
export class ParametricPricingService {
  private readonly logger = new Logger(ParametricPricingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyConversionService,
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
  ) {}

  isFeatureEnabled(): boolean {
    return Boolean(this.clientConfig?.featureFlags?.PARAMETRIC_PRODUCTS)
  }

  assertFeatureEnabled() {
    if (!this.isFeatureEnabled()) {
      throw new NotFoundException('Parametric products are not enabled for this client')
    }
  }

  async ensureProductConfig(productId: number, client: PrismaClientOrTransaction = this.prisma) {
    this.assertFeatureEnabled()
    await client.parametricProductConfig.upsert({
      where: { productId },
      update: {},
      create: {
        productId,
        schema: DEFAULT_PARAMETRIC_SCHEMA,
      },
    })
  }

  async getProductConfig(productId: number) {
    this.assertFeatureEnabled()
    const record = await this.prisma.parametricProductConfig.findUnique({
      where: { productId },
    })
    if (!record) {
      await this.ensureProductConfig(productId)
      return DEFAULT_PARAMETRIC_SCHEMA
    }
    return record.schema
  }

  private computeRecencyConfidence(date: Date): number {
    const now = new Date()
    const days = Math.max(0, this.daysBetween(now, date))
    if (days <= 30) return 1
    if (days <= 90) return 0.8
    if (days <= 180) return 0.6
    return 0.4
  }

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.floor((a.getTime() - b.getTime()) / msPerDay)
  }

  private buildModifierKey(type: ParametricModifierType, code: string) {
    return `${type}:${code}`.toUpperCase()
  }

  async quote(input: ParametricQuoteInput): Promise<ParametricQuoteResult> {
    this.assertFeatureEnabled()
    const productId = Number(input.productId)
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('A valid productId is required')
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        parametricConfig: true,
      },
    })

    if (!product || product.mode !== ProductMode.PARAMETRIC) {
      throw new NotFoundException('Parametric product not found')
    }

    if (!product.parametricConfig) {
      await this.ensureProductConfig(productId)
    }

    const widthValue = sanitizeDecimalInput(input.width)
    const heightValue = sanitizeDecimalInput(input.height)
    if (!widthValue || !heightValue) {
      throw new BadRequestException('Width and height are required')
    }

    const width = decimal(widthValue)
    const height = decimal(heightValue)
    if (width.lte(0) || height.lte(0)) {
      throw new BadRequestException('Width and height must be positive values')
    }
    const area = roundDecimal(multiplyDecimals(width, height), 4)

    const normalizedSeries = normalizeSeries(input.series)
    const normalizedGlass = normalizeGlass(input.glass)
    const normalizedColor = normalizeColor(input.color)
    const mosquitoNet = Boolean(input.mosquitoNet)

    const references = await this.prisma.parametricReferencePrice.findMany({
      where: {
        productId,
        series: normalizedSeries,
        glass: normalizedGlass,
      },
      orderBy: {
        quotationDate: 'desc',
      },
      take: 100,
    })

    if (!references.length) {
      throw new NotFoundException('No reference prices available for the selected configuration')
    }

    type ReferencePick = {
      price: Prisma.Decimal
      quotationDate: Date
      confidence: number
      area: Prisma.Decimal
      recordId: number
      color?: string | null
      source?: string | null
      detail?: string | null
      importBatchId?: number | null
    }

    const scored: Array<{ ref: ReferencePick; weight: number }> = []
    for (const record of references) {
      const recConfidence = record.confidence ?? this.computeRecencyConfidence(record.quotationDate)
      const daysWeight = this.computeRecencyConfidence(record.quotationDate)
      const areaDiff = area.minus(record.area).abs()
      const areaWeight = Number(areaDiff.toNumber()) < 0.0001 ? 1 : 1 / (1 + areaDiff.toNumber())
      const baseWeight = recConfidence * daysWeight * areaWeight
      const ref: ReferencePick = {
        price: record.price,
        quotationDate: record.quotationDate,
        confidence: recConfidence,
        area: record.area,
        recordId: record.id,
        color: record.color,
        source: record.source,
        detail: record.detail,
        importBatchId: record.importBatchId,
      }
      scored.push({ ref, weight: baseWeight })
    }

    if (!scored.length) {
      throw new NotFoundException('Unable to build a pricing reference for this configuration')
    }

    const aggregate = scored.reduce(
      (acc, current) => {
        const price = current.ref.price
        const weight = current.weight
        acc.totalWeight += weight
        acc.totalPrice = acc.totalPrice.plus(price.mul(weight))
        if (!acc.referenceDate || current.ref.quotationDate > acc.referenceDate) {
          acc.referenceDate = current.ref.quotationDate
          acc.source = current.ref.source ?? undefined
          acc.importBatchId = current.ref.importBatchId ?? undefined
        }
        return acc
      },
      {
        totalWeight: 0,
        totalPrice: decimal(0),
        referenceDate: undefined as Date | undefined,
        source: undefined as string | undefined,
        importBatchId: undefined as number | undefined,
      },
    )

    if (aggregate.totalWeight === 0) {
      throw new NotFoundException('Unable to compute price due to missing weights')
    }

    let basePrice = aggregate.totalPrice.div(aggregate.totalWeight)
    const breakdown = {
      base: decimal(0),
      color: decimal(0),
      glass: decimal(0),
      monoblock: decimal(0),
      mosquitoNet: decimal(0),
    }
    breakdown.base = basePrice

    const modifierSnapshots: ParametricModifierSnapshot[] = []

    const applyModifier = async (
      type: ParametricModifierType,
      code: string,
      options?: { fallbackMultiplier?: number },
    ) => {
      const normalizedCode = code.trim().toUpperCase()
      if (!normalizedCode) {
        return
      }
      const modifier = await this.prisma.parametricModifier.findFirst({
        where: {
          productId,
          type,
          code: normalizedCode,
        },
        orderBy: {
          quotationDate: 'desc',
        },
      })
      if (!modifier) {
        if (options?.fallbackMultiplier && type === ParametricModifierType.COLOR) {
          const multiplier = decimal(options.fallbackMultiplier)
          const nextPrice = roundDecimal(basePrice.mul(multiplier), 4)
          const addition = nextPrice.minus(basePrice)
          breakdown.color = breakdown.color.plus(addition)
          basePrice = nextPrice
        }
        return
      }

      let delta = decimal(0)
      if (modifier.adjustmentMode === ParametricAdjustmentMode.MULTIPLIER) {
        const multiplier = modifier.value ?? decimal(1)
        const nextPrice = roundDecimal(basePrice.mul(multiplier), 4)
        delta = nextPrice.minus(basePrice)
        basePrice = nextPrice
      } else {
        const surchargeValue = modifier.surcharge ?? modifier.value ?? decimal(0)
        delta = decimal(surchargeValue)
        basePrice = roundDecimal(basePrice.plus(delta), 4)
      }

      switch (type) {
        case ParametricModifierType.COLOR:
          breakdown.color = breakdown.color.plus(delta)
          break
        case ParametricModifierType.GLASS:
          breakdown.glass = breakdown.glass.plus(delta)
          break
        case ParametricModifierType.MONOBLOCK:
          breakdown.monoblock = breakdown.monoblock.plus(delta)
          break
        case ParametricModifierType.MOSQUITO_NET:
          breakdown.mosquitoNet = breakdown.mosquitoNet.plus(delta)
          break
        default:
          break
      }

      modifierSnapshots.push({
        type,
        code: modifier.code,
        label: modifier.label ?? undefined,
        adjustmentMode: modifier.adjustmentMode,
        value: decimalToNumber(modifier.value ?? 0, 6),
        surcharge: modifier.surcharge ? decimalToNumber(modifier.surcharge, 4) : undefined,
        quotationDate: modifier.quotationDate?.toISOString(),
        confidence: modifier.confidence ?? undefined,
      })
    }

    if (normalizedColor && normalizedColor !== 'NATURAL') {
      await applyModifier(ParametricModifierType.COLOR, normalizedColor)
    }

    if (input.monoblock?.enabled) {
      const material = input.monoblock.material ? input.monoblock.material.toUpperCase() : 'DEFAULT'
      const colorCode = input.monoblock.color ? input.monoblock.color.toUpperCase() : 'DEFAULT'
      await applyModifier(ParametricModifierType.MONOBLOCK, `${material}:${colorCode}`)
    }

    if (mosquitoNet) {
      await applyModifier(ParametricModifierType.MOSQUITO_NET, 'ENABLED')
    }

    const breakdownNumbers = {
      base: decimalToNumber(breakdown.base, 4),
      color: decimalToNumber(breakdown.color, 4),
      glass: decimalToNumber(breakdown.glass, 4),
      monoblock: decimalToNumber(breakdown.monoblock, 4),
      mosquitoNet: decimalToNumber(breakdown.mosquitoNet, 4),
    }

    const total = decimalToNumber(basePrice, 4)
    const response: ParametricQuoteResult = {
      productId,
      currency: product.currency ?? 'UYU',
      width: decimalToNumber(width, 4),
      height: decimalToNumber(height, 4),
      area: decimalToNumber(area, 4),
      total,
      breakdown: breakdownNumbers,
      referenceDate: aggregate.referenceDate?.toISOString() ?? new Date().toISOString(),
      confidence: Math.min(1, scored.reduce((sum, item) => sum + item.weight, 0)),
      dataVersion: aggregate.referenceDate
        ? `${aggregate.referenceDate.toISOString()}${aggregate.importBatchId ? `#${aggregate.importBatchId}` : ''}`
        : `manual#${Date.now()}`,
      source: aggregate.source,
      modifiers: modifierSnapshots,
    }

    if (input.currency && input.currency.toUpperCase() !== response.currency) {
      const targetCurrency = this.currency.normalizeCurrency(input.currency)
      if (!targetCurrency) {
        throw new BadRequestException('Invalid currency code supplied')
      }
      if (targetCurrency !== response.currency) {
        const originalCurrency = response.currency
        const snapshot = await this.currency.buildRatesSnapshot([originalCurrency, targetCurrency])
        const conversion = this.currency.convertWithSnapshot(basePrice, originalCurrency, targetCurrency, snapshot)
        response.total = decimalToNumber(conversion.amount, 4)
        response.currency = targetCurrency
        const convertBreakdown = (value: number) =>
          decimalToNumber(
            this.currency.convertWithSnapshot(decimal(value), originalCurrency, targetCurrency, snapshot).amount,
            4,
          )
        response.breakdown = {
          base: convertBreakdown(breakdownNumbers.base),
          color: convertBreakdown(breakdownNumbers.color),
          glass: convertBreakdown(breakdownNumbers.glass),
          monoblock: convertBreakdown(breakdownNumbers.monoblock),
          mosquitoNet: convertBreakdown(breakdownNumbers.mosquitoNet),
        }
      }
    }

    return response
  }

  async importFromBuffer(
    productId: number,
    buffer: Buffer,
    options: { filename?: string; userId?: number } = {},
  ): Promise<ParametricImportSummary> {
    this.assertFeatureEnabled()
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product || product.mode !== ProductMode.PARAMETRIC) {
      throw new NotFoundException('Parametric product not found')
    }

    const { rows, warnings } = await this.parseImportBuffer(buffer, options.filename)
    if (!rows.length) {
      throw new BadRequestException('The provided file does not contain any recognizable rows')
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.parametricImportBatch.create({
        data: {
          productId,
          sourceType: options.filename?.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
          sourceFile: options.filename,
          importedById: options.userId,
          rowsProcessed: rows.length,
        },
      })

      const referenceData: Prisma.ParametricReferencePriceCreateManyInput[] = []
      const modifierData: Prisma.ParametricModifierCreateManyInput[] = []

      const baseMap = new Map<string, Prisma.ParametricReferencePriceCreateManyInput>()

      for (const row of rows) {
        const width = decimal(row.width)
        const height = decimal(row.height)
        const area = roundDecimal(multiplyDecimals(width, height), 4)
        const price = decimal(row.price)
        const confidence = this.computeRecencyConfidence(row.quotationDate)

        const baseRecord: Prisma.ParametricReferencePriceCreateManyInput = {
          productId,
          series: row.series,
          glass: row.glass,
          color: row.color,
          width: roundDecimal(width, 4),
          height: roundDecimal(height, 4),
          area,
          price: roundDecimal(price, 4),
          currency: row.currency ?? product.currency ?? 'UYU',
          quotationDate: row.quotationDate,
          confidence,
          source: row.source,
          detail: row.detail,
          metadata: {
            mosquitoNet: row.mosquitoNet,
            monoblock: row.monoblock,
          },
          importBatchId: batch.id,
        }
        referenceData.push(baseRecord)

        const baseKey = `${row.series}|${row.glass}|${row.width.toFixed(4)}|${row.height.toFixed(4)}|${row.mosquitoNet ? 'Y' : 'N'}|${row.monoblock?.enabled ? 'Y' : 'N'}`
        if (!baseMap.has(baseKey) && row.color === 'NATURAL' && !row.monoblock?.enabled && !row.mosquitoNet) {
          baseMap.set(baseKey, baseRecord)
        }
      }

      for (const row of rows) {
        if (row.color !== 'NATURAL') {
          const baseKey = `${row.series}|${row.glass}|${row.width.toFixed(4)}|${row.height.toFixed(4)}|${row.mosquitoNet ? 'Y' : 'N'}|${row.monoblock?.enabled ? 'Y' : 'N'}`
          const base = baseMap.get(baseKey)
          if (base) {
            const multiplier = decimal(row.price).div(
              decimal(base.price as Prisma.Decimal.Value),
            )
            modifierData.push({
              productId,
              type: ParametricModifierType.COLOR,
              code: row.color,
              label: row.color,
              adjustmentMode: ParametricAdjustmentMode.MULTIPLIER,
              value: roundDecimal(multiplier, 6),
              quotationDate: row.quotationDate,
              confidence: this.computeRecencyConfidence(row.quotationDate),
              importBatchId: batch.id,
            })
          }
        }

        if (row.mosquitoNet) {
          const baseKeyNoMosquito = `${row.series}|${row.glass}|${row.width.toFixed(4)}|${row.height.toFixed(4)}|N|${row.monoblock?.enabled ? 'Y' : 'N'}`
          const base = baseMap.get(baseKeyNoMosquito)
          if (base) {
            const diff = decimal(row.price).minus(decimal(base.price as Prisma.Decimal.Value))
            if (!diff.isZero()) {
              modifierData.push({
                productId,
                type: ParametricModifierType.MOSQUITO_NET,
                code: 'ENABLED',
                label: 'Mosquitero',
                adjustmentMode: ParametricAdjustmentMode.SURCHARGE,
                value: decimal(0),
                surcharge: roundDecimal(diff, 4),
                quotationDate: row.quotationDate,
                confidence: this.computeRecencyConfidence(row.quotationDate),
                importBatchId: batch.id,
              })
            }
          }
        }
      }

      if (referenceData.length) {
        await tx.parametricReferencePrice.createMany({ data: referenceData })
      }
      if (modifierData.length) {
        await tx.parametricModifier.createMany({ data: modifierData })
      }

      await tx.parametricImportBatch.update({
        where: { id: batch.id },
        data: {
          rowsInserted: referenceData.length,
          summary: {
            warnings,
            modifiersCreated: modifierData.length,
          },
        },
      })

      return {
        batchId: batch.id,
        rowsProcessed: rows.length,
        referencesInserted: referenceData.length,
        modifiersInserted: modifierData.length,
        warnings,
      }
    })
  }

  private async parseImportBuffer(buffer: Buffer, filename?: string) {
    const warnings: string[] = []
    const table: string[][] = []

    if (filename && /\.(xlsx|xls)$/i.test(filename)) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        return { rows: [], warnings }
      }
      const worksheet = workbook.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false }) as string[][]
      for (const row of raw) {
        if (!row || row.every((cell) => !cell)) {
          continue
        }
        table.push(row.map((cell) => (cell ?? '').toString()))
      }
    } else {
      const text = buffer.toString('utf8')
      const rawLines = text.split(/\r?\n/)
      for (const line of rawLines) {
        if (!line || !line.trim()) {
          continue
        }
        table.push(line.split(/[,;\t]/).map((cell) => cell.trim()))
      }
    }

    if (!table.length) {
      return { rows: [], warnings }
    }

    const [headerRow, ...dataRows] = table
    if (!headerRow) {
      return { rows: [], warnings }
    }

    const columns = headerRow.map((col) => col.trim().toUpperCase())
    const map = new Map<string, number>()
    columns.forEach((col, idx) => {
      map.set(col, idx)
    })

    const required = ['FECHA COTIZACION', 'PRODUCTO', 'ANCHO', 'ALTO', 'SERIE', 'COLOR', 'VIDRIO', 'PRECIO']
    for (const key of required) {
      if (!map.has(key)) {
        throw new BadRequestException(`Missing required column: ${key}`)
      }
    }

    const parseCell = (cells: string[], key: string, fallbackKeys: string[] = []) => {
      const searchKeys = [key, ...fallbackKeys]
      for (const candidate of searchKeys) {
        const idx = map.get(candidate)
        if (idx !== undefined && idx < cells.length) {
          return cells[idx]
        }
      }
      return undefined
    }

    const detectCurrency = (priceCell?: string, detailCell?: string): string | undefined => {
      const joined = `${priceCell ?? ''} ${detailCell ?? ''}`.toUpperCase()
      if (joined.includes('USD') || joined.includes('U$S') || joined.includes('US$')) {
        return 'USD'
      }
      if (joined.includes('UYU') || joined.includes('$U') || joined.includes('UY$')) {
        return 'UYU'
      }
      return undefined
    }

    const parseBooleanFromDetail = (detail?: string, keywords: string[] = []): boolean => {
      if (!detail) {
        return false
      }
      const lowered = detail.toLowerCase()
      return keywords.some((keyword) => lowered.includes(keyword))
    }

    const parseGlassFromDetail = (detail?: string): string | undefined => {
      if (!detail) {
        return undefined
      }
      const upper = detail.toUpperCase()
      if (upper.includes('DVH')) {
        return 'DVH'
      }
      const triple = upper.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/)
      if (triple) {
        return 'DVH'
      }
      if (upper.match(/\b6\s*MM\b/)) return '6MM'
      if (upper.match(/\b5\s*MM\b/)) return '5MM'
      if (upper.match(/\b4\s*MM\b/)) return '4MM'
      if (upper.match(/\b3\s*MM\b/)) return '3MM'
      return undefined
    }

    const parseMonoblockFromDetail = (
      detail?: string,
    ): { enabled: boolean; material?: string; color?: string } | undefined => {
      if (!detail) {
        return undefined
      }
      const lower = detail.toLowerCase()
      if (!lower.includes('monoblock')) {
        return undefined
      }
      const material = lower.includes('alu') ? 'ALUMINUM' : lower.includes('pvc') ? 'PVC' : undefined
      const colorMatch = lower.match(
        /(white|blanco|black|negro|brown|marr[oó]n|natural|anoloc)/,
      )
      const color = colorMatch ? normalizeColor(colorMatch[0]) : undefined
      return {
        enabled: true,
        material,
        color,
      }
    }

    const rows: Array<{
      quotationDate: Date
      productName: string
      mosquitoNet: boolean
      width: number
      height: number
      series: string
      color: string
      glass: string
      price: number
      currency?: string
      detail?: string
      source?: string
      monoblock?: { enabled: boolean; material?: string; color?: string }
    }> = []

    for (const row of dataRows) {
      const cells = row.map((cell) => cell.trim())
      if (cells.every((cell) => !cell)) {
        continue
      }

      const dateRaw = parseCell(cells, 'FECHA COTIZACION')
      const productName = parseCell(cells, 'PRODUCTO') ?? ''
      const widthRaw = parseCell(cells, 'ANCHO')
      const heightRaw = parseCell(cells, 'ALTO')
      const seriesRaw = parseCell(cells, 'SERIE')
      const colorRaw = parseCell(cells, 'COLOR')
      const glassRaw = parseCell(cells, 'VIDRIO')
      const priceRaw = parseCell(cells, 'PRECIO')
      const mosquitoRaw = parseCell(cells, 'MOSQUITERO')
      const detail = parseCell(cells, 'DETALLE')

      if (!dateRaw || !widthRaw || !heightRaw || !seriesRaw || !glassRaw || !priceRaw) {
        warnings.push('Skipping row due to missing required values')
        continue
      }

      const quotationDate = this.parseDate(dateRaw)
      if (!quotationDate) {
        warnings.push(`Invalid quotation date: ${dateRaw}`)
        continue
      }

      const width = Number(widthRaw.replace(',', '.'))
      const height = Number(heightRaw.replace(',', '.'))
      const price = Number(priceRaw.replace(',', '.'))

      if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(price)) {
        warnings.push('Invalid numeric values detected; row skipped')
        continue
      }

      const currency = detectCurrency(priceRaw, detail)
      const baseGlass = normalizeGlass(glassRaw)
      const detailGlass = parseGlassFromDetail(detail)
      const monoblockFromDetail = parseMonoblockFromDetail(detail)
      const mosquitoFromDetail = parseBooleanFromDetail(detail, [
        'mosquitero',
        'mosquito',
        'mosq.',
      ])

      const normalizedRow = {
        quotationDate,
        productName,
        mosquitoNet: normalizeYesNo(mosquitoRaw) || mosquitoFromDetail,
        width,
        height,
        series: normalizeSeries(seriesRaw),
        color: normalizeColor(colorRaw),
        glass: detailGlass ?? baseGlass ?? '4MM',
        price,
        currency,
        detail,
        monoblock: monoblockFromDetail ?? { enabled: false },
      }

      if (!normalizedRow.currency && priceRaw && priceRaw.includes('$')) {
        normalizedRow.currency = 'USD'
      }

      rows.push(normalizedRow)
    }

    return { rows, warnings }
  }

  private parseDate(raw: string): Date | null {
    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }
    const normalized = trimmed.replace(/[-.]/g, '/').replace(/\s+/g, '')
    const parts = normalized.split('/')
    if (parts.length === 3) {
      const [day, month, yearRaw] = parts
      const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw)
      const date = new Date(year, Number(month) - 1, Number(day))
      if (Number.isNaN(date.getTime())) {
        return null
      }
      return date
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed
  }
}
