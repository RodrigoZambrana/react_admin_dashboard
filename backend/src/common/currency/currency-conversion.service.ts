import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma, CurrencyRate } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  STANDARD_CURRENCY_CODES,
  STANDARD_CURRENCIES,
  type StandardCurrencyOption,
} from './currency.constants'
import {
  decimal,
  roundDecimal,
  divideDecimals,
  multiplyDecimals,
} from './money.util'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

export type CurrencyRatesSnapshot = {
  base: string
  rates: Record<string, Prisma.Decimal>
  generatedAt: string
}

export type CurrencyConversionResult = {
  amount: Prisma.Decimal
  rate: Prisma.Decimal
}

@Injectable()
export class CurrencyConversionService {
  private readonly fallbackCurrencies = ['USD', 'UYU'] as const

  constructor(private readonly prisma: PrismaService) {}

  private isPrismaService(client: PrismaClientOrTx): client is PrismaService {
    return typeof (client as PrismaService).$transaction === 'function'
  }

  private async withTransaction<T>(
    client: PrismaClientOrTx,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (this.isPrismaService(client)) {
      return client.$transaction((tx) => fn(tx))
    }
    return fn(client)
  }

  getStandardCurrencies(): StandardCurrencyOption[] {
    return STANDARD_CURRENCIES
  }

  normalizeCurrency(code: unknown): string | null {
    if (!code) return null
    const trimmed = String(code).trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null
    }
    if (!STANDARD_CURRENCY_CODES.has(trimmed)) {
      return null
    }
    return trimmed
  }

  async getEnabledCurrencies(): Promise<string[]> {
    const record = await this.prisma.systemConfig.findUnique({ where: { key: 'currencies' } })
    const fallback = [...this.fallbackCurrencies]
    if (!record) {
      return fallback
    }
    try {
      const parsed = JSON.parse(record.value)
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => this.normalizeCurrency(item))
          .filter((item): item is string => Boolean(item))
        return normalized.length ? Array.from(new Set(normalized)) : fallback
      }
    } catch (error) {
      // ignore parsing errors and fall back
    }
    return fallback
  }

  async setEnabledCurrencies(
    codes: string[],
    client: PrismaClientOrTx = this.prisma,
  ): Promise<string[]> {
    const normalized = codes
      .map((code) => this.normalizeCurrency(code))
      .filter((code): code is string => Boolean(code))
    if (!normalized.length) {
      throw new BadRequestException('At least one valid currency must be provided')
    }
    const unique = Array.from(new Set(normalized))
    await client.systemConfig.upsert({
      where: { key: 'currencies' },
      update: { value: JSON.stringify(unique) },
      create: { key: 'currencies', value: JSON.stringify(unique) },
    })
    return unique
  }

  async getBaseCurrency(): Promise<string> {
    const record = await this.prisma.systemConfig.findUnique({ where: { key: 'currencyBase' } })
    const normalized = this.normalizeCurrency(record?.value)
    if (normalized) return normalized
    return this.fallbackCurrencies[1] ?? 'USD'
  }

  async setBaseCurrency(
    code: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<string> {
    const normalized = this.normalizeCurrency(code)
    if (!normalized) {
      throw new BadRequestException('Invalid currency code')
    }
    await client.systemConfig.upsert({
      where: { key: 'currencyBase' },
      update: { value: normalized },
      create: { key: 'currencyBase', value: normalized },
    })
    return normalized
  }

  async listRates(base?: string): Promise<CurrencyRate[]> {
    const resolvedBase = base ?? (await this.getBaseCurrency())
    return this.prisma.currencyRate.findMany({
      where: { base: resolvedBase },
      orderBy: { quote: 'asc' },
    })
  }

  async replaceRates(
    base: string,
    entries: Array<{ quote: string; rate: Prisma.Decimal.Value }>,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<CurrencyRate[]> {
    const normalizedBase = this.normalizeCurrency(base)
    if (!normalizedBase) {
      throw new BadRequestException('Invalid base currency')
    }
    const normalizedEntries = entries
      .map((entry) => ({
        quote: this.normalizeCurrency(entry.quote),
        rate: decimal(entry.rate),
      }))
      .filter((entry): entry is { quote: string; rate: Prisma.Decimal } => {
        if (!entry.quote) {
          return false
        }
        if (entry.rate.isZero() || entry.rate.isNegative()) {
          throw new BadRequestException(`Invalid rate for ${entry.quote}`)
        }
        if (entry.quote === normalizedBase) {
          return false
        }
        return true
      })

    const uniqueEntries = new Map<string, Prisma.Decimal>()
    for (const entry of normalizedEntries) {
      uniqueEntries.set(entry.quote, entry.rate)
    }
    const prepared = Array.from(uniqueEntries.entries()).map(([quote, rate]) => ({
      base: normalizedBase,
      quote,
      rate: rate.toFixed(8),
    }))

    await this.withTransaction(client, async (tx) => {
      await tx.currencyRate.deleteMany({ where: { base: normalizedBase } })
      if (prepared.length) {
        await tx.currencyRate.createMany({
          data: prepared,
        })
      }
    })

    return this.prisma.currencyRate.findMany({
      where: { base: normalizedBase },
      orderBy: { quote: 'asc' },
    })
  }

  async buildRatesSnapshot(requiredCurrencies: string[]): Promise<CurrencyRatesSnapshot> {
    const normalizedRequired = Array.from(
      new Set(
        requiredCurrencies
          .map((currency) => this.normalizeCurrency(currency))
          .filter((currency): currency is string => Boolean(currency)),
      ),
    )
    const base = await this.getBaseCurrency()
    const targets = normalizedRequired.filter((currency) => currency !== base)
    const records = await this.prisma.currencyRate.findMany({
      where: { base, quote: { in: targets } },
    })
    const rateMap = new Map<string, Prisma.Decimal>()
    rateMap.set(base, new Prisma.Decimal(1))
    for (const record of records) {
      rateMap.set(record.quote, new Prisma.Decimal(record.rate))
    }
    for (const currency of targets) {
      if (!rateMap.has(currency)) {
        throw new BadRequestException(`Missing exchange rate for ${base} -> ${currency}`)
      }
    }
    const snapshotRates: Record<string, Prisma.Decimal> = {}
    for (const [currency, rate] of rateMap.entries()) {
      snapshotRates[currency] = rate
    }
    return {
      base,
      rates: snapshotRates,
      generatedAt: new Date().toISOString(),
    }
  }

  convertWithSnapshot(
    amount: Prisma.Decimal.Value,
    fromCurrency: string,
    toCurrency: string,
    snapshot: CurrencyRatesSnapshot,
    options?: { amountScale?: number; rateScale?: number },
  ): CurrencyConversionResult {
    const normalizedFrom = this.normalizeCurrency(fromCurrency)
    const normalizedTo = this.normalizeCurrency(toCurrency)
    if (!normalizedFrom || !normalizedTo) {
      throw new BadRequestException('Invalid currency conversion request')
    }
    const base = snapshot.base
    const rates = snapshot.rates
    const amountScale = options?.amountScale ?? 4
    const rateScale = options?.rateScale ?? 8

    const rateFrom = normalizedFrom === base ? new Prisma.Decimal(1) : rates[normalizedFrom]
    const rateTo = normalizedTo === base ? new Prisma.Decimal(1) : rates[normalizedTo]

    if (!rateFrom) {
      throw new BadRequestException(`Missing exchange rate for ${base} -> ${normalizedFrom}`)
    }
    if (!rateTo) {
      throw new BadRequestException(`Missing exchange rate for ${base} -> ${normalizedTo}`)
    }

    const amountDecimal = roundDecimal(amount, amountScale)

    let amountInBase = amountDecimal
    if (normalizedFrom !== base) {
      amountInBase = roundDecimal(multiplyDecimals(amountInBase, rateFrom), amountScale)
    }

    let converted = amountInBase
    if (normalizedTo !== base) {
      converted = roundDecimal(divideDecimals(converted, rateTo), amountScale)
    }

    let effectiveRate = roundDecimal(1, rateScale)
    if (normalizedFrom !== base) {
      effectiveRate = roundDecimal(multiplyDecimals(effectiveRate, rateFrom), rateScale)
    }
    if (normalizedTo !== base) {
      effectiveRate = roundDecimal(divideDecimals(effectiveRate, rateTo), rateScale)
    }

    return {
      amount: converted,
      rate: effectiveRate,
    }
  }
}
