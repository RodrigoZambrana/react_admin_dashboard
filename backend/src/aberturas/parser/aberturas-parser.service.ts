import { Injectable } from '@nestjs/common'
import { AberturasGlossaryService } from '../aberturas-glossary.service'
import {
  AberturasAliasEntry,
  AberturasGlossaryGrouped,
  ParsedAberturasContext,
  ParsedAberturasItem,
} from './types'
import { normalizeAberturasToken } from './utils'

@Injectable()
export class AberturasParserService {
  constructor(
    private readonly aberturasGlossary: AberturasGlossaryService,
  ) {}

  async buildParsedContext(input: {
    text: string
    source?: string
    referenceDate?: string
  }): Promise<ParsedAberturasContext> {
    const grouped = (await this.aberturasGlossary.listGrouped()) as AberturasGlossaryGrouped
    const familyAliases = this.buildAliasList(grouped.tipo ?? [])
    const serieAliases = this.buildAliasList(grouped.serie ?? [])
    const colorAliases = this.buildAliasList(grouped.color ?? [])
    const glassAliases = this.buildAliasList(grouped.vidrio ?? [])
    const config = (await this.aberturasGlossary.getConfig()) as Record<string, unknown>

    const lines = this.normalizeInput(input.text)

    const items = lines
      .map((line, index) =>
        this.parseLine(line, index, {
          familyAliases,
          serieAliases,
          colorAliases,
          glassAliases,
        }),
      )
      .filter((entry): entry is ParsedAberturasItem => entry !== null)

    return {
      config,
      items,
    }
  }

  normalizeInput(text: string) {
    const normalizedSeparators = text
      .replace(/\s*(?:;|\||\/\/)\s*/g, '\n')
      .replace(/\r/g, '\n')

    return normalizedSeparators
      .split(/\n+/)
      .flatMap((line) => this.splitCompositeLine(this.stripChatPrefix(line)))
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  stripChatPrefix(line: string) {
    const cleaned = line
      .replace(/^\[\d{1,2}\/\d{1,2},[^\]]+\]\s*[^:]+:\s*/i, '')
      .trim()

    const keywordMatch = cleaned.match(
      /\b(corrediza|batiente|puerta|ventana|abertura|monoblock|paño fijo|pano fijo|fijo)\b/i,
    )

    if (keywordMatch?.index && keywordMatch.index > 0) {
      const prefix = cleaned.slice(0, keywordMatch.index).trim()
      const prefixTokenCount = prefix.split(/\s+/).filter(Boolean).length
      const looksLikeConversationalPrefix =
        /[:,-]$/.test(prefix) || prefixTokenCount > 2

      if (looksLikeConversationalPrefix) {
        return cleaned.slice(keywordMatch.index).trim()
      }
    }

    return cleaned
  }

  splitCompositeLine(line: string) {
    if (!line.trim()) {
      return []
    }

    const tokens = line.trim().split(/\s+/)
    const segments: string[] = []
    let current: string[] = []
    let currentHasType = false
    let currentHasMeasure = false
    let currentHasPrice = false

    const startsNewItem = (token: string) =>
      /^(corrediza|batiente|puerta|ventana|abertura|monoblock|fijo|paño|pano)$/i.test(
        normalizeAberturasToken(token),
      )

    const updateFlags = (text: string) => {
      currentHasType =
        /(corrediza|batiente|puerta|ventana|abertura|monoblock|pano fijo|paño fijo|fijo)/i.test(
          text,
        )
      currentHasMeasure = /(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)/i.test(text)
      currentHasPrice =
        /\b(?:usd|u\$s|us\$|uyu|\$u)\s*[\d.,]+/i.test(text) ||
        /\$\s*[\d.,]+/.test(text)
    }

    for (const token of tokens) {
      const shouldSplit =
        current.length > 0 &&
        startsNewItem(token) &&
        currentHasType &&
        (currentHasMeasure || currentHasPrice)

      if (shouldSplit) {
        segments.push(current.join(' '))
        current = [token]
        updateFlags(current.join(' '))
        continue
      }

      current.push(token)
      updateFlags(current.join(' '))
    }

    if (current.length > 0) {
      segments.push(current.join(' '))
    }

    return segments
  }

  parseLine(
    line: string,
    index: number,
    aliases: {
      familyAliases: AberturasAliasEntry[]
      serieAliases: AberturasAliasEntry[]
      colorAliases: AberturasAliasEntry[]
      glassAliases: AberturasAliasEntry[]
    },
  ): ParsedAberturasItem | null {
    const normalized = normalizeAberturasToken(line)
    const looksRelevant =
      /(corrediza|batiente|pano fijo|paño fijo|monoblock|mosq|mosquitero|dvh|abertura|ventana|puerta)/i.test(
        normalized,
      ) || /(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)/i.test(line)

    if (!looksRelevant) {
      return null
    }

    const family = this.findBestAlias(normalized, aliases.familyAliases)
    const serie = this.findBestAlias(normalized, aliases.serieAliases)
    const color = this.findBestAlias(normalized, aliases.colorAliases)
    const vidrio =
      this.findBestAlias(normalized, aliases.glassAliases) ??
      (/\bvidrio simple\b|\bsimple\b/i.test(normalized)
        ? { alias: 'vidrio simple', label: 'vidrio simple', value: 'VIDRIO SIMPLE' }
        : null)

    const size = this.extractDimensions(line)
    const priceData = this.extractPrice(line)
    const hasMosquitero = /\bmosq\b|\bmosquitero\b/i.test(normalized)
    const hasShutterMonoblock = /\bmonoblock\b|\bcortina\b|\btambor\b/i.test(normalized)
    const shutterSystem = /\bpvc\b/i.test(normalized)
      ? 'PVC'
      : /\baluminio\b/i.test(normalized) && hasShutterMonoblock
        ? 'ALUMINIO'
        : ''
    const extras = Array.from(
      new Set(
        ['fenix', 'sirius', 'reja', 'motor', 'control remoto'].filter((token) =>
          normalized.includes(normalizeAberturasToken(token)),
        ),
      ),
    )

    const missingFields: string[] = []
    const doubtfulFields: string[] = []
    if (!family) missingFields.push('family_id')
    if (!serie) missingFields.push('serie')
    if (!color) missingFields.push('color')
    if (!vidrio) missingFields.push('vidrio')
    if (!size.widthMm) missingFields.push('width_mm')
    if (!size.heightMm) missingFields.push('height_mm')
    if (priceData.price !== null && !priceData.currency) {
      doubtfulFields.push('currency')
    }
    if (vidrio?.value === 'VIDRIO SIMPLE') {
      doubtfulFields.push('vidrio')
    }

    const confidenceScore = Number(
      (
        1 -
        Math.min(
          0.85,
          missingFields.length * 0.14 + doubtfulFields.length * 0.08,
        )
      ).toFixed(2),
    )

    const processingScore =
      (size.widthMm && size.heightMm ? 1 : 0) +
      (priceData.price !== null ? 1 : 0) +
      (family ? 1 : 0) +
      (serie ? 1 : 0)

    return {
      lineNumber: index + 1,
      rawLine: line,
      familyId: family?.value ?? null,
      familyLabel: family?.label ?? null,
      serie: serie?.value ?? null,
      material: 'ALUMINIO',
      color: color?.value ?? null,
      vidrio: vidrio?.value ?? null,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      hasMosquitero,
      hasShutterMonoblock,
      shutterSystem: shutterSystem || null,
      price: priceData.price,
      currency: priceData.currency,
      extras,
      missingFields,
      doubtfulFields,
      processingScore,
      validForAutoProcess:
        processingScore >= 3 &&
        Boolean(family) &&
        Boolean(size.widthMm) &&
        Boolean(size.heightMm) &&
        priceData.price !== null,
      readyForQuote:
        missingFields.length === 0 &&
        doubtfulFields.filter((field) => field !== 'currency').length === 0,
      detalleSnapshot: line,
      confidenceScore,
    }
  }

  buildAliasList(entries: Array<{ label?: string; value?: string }>) {
    return entries
      .flatMap((entry) => {
        const label = entry.label?.trim()
        const value = entry.value?.trim()
        return [
          label
            ? {
                alias: normalizeAberturasToken(label),
                label,
                value: value || label,
              }
            : null,
          value
            ? {
                alias: normalizeAberturasToken(value),
                label: label || value,
                value,
              }
            : null,
        ].filter(Boolean) as AberturasAliasEntry[]
      })
      .filter((entry) => entry.alias.length > 0)
      .sort((a, b) => b.alias.length - a.alias.length)
  }

  findBestAlias(
    normalizedText: string,
    aliases: AberturasAliasEntry[],
  ) {
    return aliases.find((entry) => normalizedText.includes(entry.alias)) ?? null
  }

  extractDimensions(line: string) {
    const match = line.match(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)/i)
    if (!match) {
      return { widthMm: null, heightMm: null }
    }

    return {
      widthMm: this.normalizeDimension(match[1]),
      heightMm: this.normalizeDimension(match[2]),
    }
  }

  normalizeDimension(raw: string) {
    const cleaned = raw.trim().replace(',', '.')
    const numeric = Number(cleaned)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null
    }
    if (cleaned.includes('.')) {
      return Math.round(numeric * 1000)
    }
    if (numeric <= 10) {
      return Math.round(numeric * 1000)
    }
    if (numeric <= 400) {
      return Math.round(numeric * 10)
    }
    return Math.round(numeric)
  }

  extractPrice(line: string) {
    const explicitUsd = line.match(/\b(?:usd|u\$s|us\$)\s*([\d.,]+)/i)
    if (explicitUsd) {
      return {
        price: this.parseLooseNumber(explicitUsd[1]),
        currency: 'USD',
      }
    }

    const explicitUyu = line.match(/\b(?:uyu|\$u)\s*([\d.,]+)/i)
    if (explicitUyu) {
      return {
        price: this.parseLooseNumber(explicitUyu[1]),
        currency: 'UYU',
      }
    }

    const trailingMoney = line.match(/\$\s*([\d.,]+)/)
    if (trailingMoney) {
      return {
        price: this.parseLooseNumber(trailingMoney[1]),
        currency: 'UYU',
      }
    }

    return {
      price: null,
      currency: null,
    }
  }

  parseLooseNumber(raw?: string | null) {
    if (!raw) {
      return null
    }
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
}
