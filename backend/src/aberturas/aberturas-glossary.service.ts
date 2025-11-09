import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'
import { PrismaService } from '../prisma/prisma.service'

type GlossaryCategory = 'tipo' | 'serie' | 'color' | 'vidrio'

export type AberturasConfig = {
  nearest: {
    maxResults: number
    dimensionTolerancePercent: number
    dimensionMinToleranceMm: number
  }
  pricing: {
    markupPercent: number
  }
}

export type UpdateAberturasConfigInput = {
  nearest?: Partial<AberturasConfig['nearest']>
  pricing?: Partial<AberturasConfig['pricing']>
}

const DEFAULT_ABERTURAS_CONFIG: AberturasConfig = {
  nearest: {
    maxResults: 3,
    dimensionTolerancePercent: 12,
    dimensionMinToleranceMm: 40,
  },
  pricing: {
    markupPercent: 25,
  },
}

export type AberturasSelectorSummary = {
  families: string[]
  series: string[]
  colors: string[]
  glass: string[]
}

type CreateGlossaryItemInput = {
  category: string
  label: string
  value?: string
  adjustPct?: number | null
}

@Injectable()
export class AberturasGlossaryService implements OnModuleInit {
  private readonly logger = new Logger(AberturasGlossaryService.name)
  private seedPromise: Promise<void> | null = null
  private configCache: { value: AberturasConfig; expiresAt: number } | null = null
  private static readonly CONFIG_KEY = 'aberturas_config'
  private static readonly CONFIG_CACHE_TTL_MS = 30_000

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeeded().catch((error) => {
      this.logger.error('Failed to ensure abertura glossary seed on boot', error)
    })
  }

  async seedFromGlossaryFile() {
    const glossaryPath = path.resolve(__dirname, '../../../../docs/glosario_normalizado.json')
    const raw = await fs.readFile(glossaryPath, 'utf8')
    const parsed = JSON.parse(raw) as {
      maps: {
        tipos_abertura: Record<string, string>
        series: Record<string, string>
        colores: Record<
          string,
          {
            normalized: string
            adjust_pct?: number
          }
        >
        vidrios: Record<string, string>
      }
    }

    const items: CreateGlossaryItemInput[] = []

    Object.entries(parsed.maps.tipos_abertura ?? {}).forEach(([label, normalized]) => {
      items.push({ category: 'tipo', label, value: normalized })
    })

    Object.entries(parsed.maps.series ?? {}).forEach(([label, normalized]) => {
      items.push({ category: 'serie', label, value: normalized })
    })

    Object.entries(parsed.maps.colores ?? {}).forEach(([label, payload]) => {
      items.push({
        category: 'color',
        label,
        value: payload?.normalized ?? label,
        adjustPct: typeof payload?.adjust_pct === 'number' ? payload.adjust_pct : null,
      })
    })

    Object.entries(parsed.maps.vidrios ?? {}).forEach(([label, normalized]) => {
      items.push({ category: 'vidrio', label, value: normalized })
    })

    if (!items.length) {
      return
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.aberturaGlossaryItem.upsert({
          where: {
            category_label: {
              category: item.category,
              label: item.label,
            },
          },
          create: {
            category: item.category,
            label: item.label,
            value: item.value ?? item.label,
            adjustPct: item.adjustPct !== null && item.adjustPct !== undefined ? new Prisma.Decimal(item.adjustPct) : null,
          },
          update: {
            value: item.value ?? item.label,
            adjustPct: item.adjustPct !== null && item.adjustPct !== undefined ? new Prisma.Decimal(item.adjustPct) : null,
          },
        }),
      ),
    )
  }

  private async ensureSeeded() {
    const existing = await this.prisma.aberturaGlossaryItem.count()
    if (existing > 0) {
      return
    }
    if (!this.seedPromise) {
      this.seedPromise = this.seedFromGlossaryFile().catch((error) => {
        this.logger.error('Failed to seed abertura glossary', error)
        throw error
      })
    }
    await this.seedPromise
  }

  async listGrouped() {
    await this.ensureSeeded()
    const records = await this.prisma.aberturaGlossaryItem.findMany({
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    })
    const grouped: Record<string, unknown[]> = {}
    records.forEach((record) => {
      const entry = this.toResponse(record)
      grouped[record.category] = grouped[record.category] ?? []
      grouped[record.category].push(entry)
    })
    return grouped
  }

  async listByCategory(category: string) {
    await this.ensureSeeded()
    const normalized = category.toLowerCase()
    const records = await this.prisma.aberturaGlossaryItem.findMany({
      where: { category: normalized },
      orderBy: { label: 'asc' },
    })
    return records.map((record) => this.toResponse(record))
  }

  async create(category: string, payload: CreateGlossaryItemInput) {
    const normalizedCategory = category.toLowerCase()
    const data = this.normalizePayload(normalizedCategory, payload)
    const created = await this.prisma.aberturaGlossaryItem.create({ data })
    return this.toResponse(created)
  }

  async update(id: number, payload: CreateGlossaryItemInput) {
    const existing = await this.prisma.aberturaGlossaryItem.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Glossary item not found')
    }
    const data = this.normalizePayload(existing.category, { ...payload, category: existing.category })
    const updated = await this.prisma.aberturaGlossaryItem.update({
      where: { id },
      data,
    })
    return this.toResponse(updated)
  }

  async remove(id: number) {
    await this.prisma.aberturaGlossaryItem.delete({ where: { id } })
    return { id }
  }

  async getSelectorSummary(): Promise<AberturasSelectorSummary> {
    await this.ensureSeeded()
    const records = await this.prisma.aberturaGlossaryItem.findMany({
      where: {
        category: {
          in: ['tipo', 'serie', 'color', 'vidrio'],
        },
      },
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    })

    const summarize = (category: GlossaryCategory) => {
      const set = new Set<string>()
      records
        .filter((record) => record.category === category)
        .forEach((record) => {
          const value = (record.value || record.label || '').trim()
          if (value) {
            set.add(value)
          }
        })
      return Array.from(set)
    }

    return {
      families: summarize('tipo'),
      series: summarize('serie'),
      colors: summarize('color'),
      glass: summarize('vidrio'),
    }
  }

  async getConfig(): Promise<AberturasConfig> {
    const now = Date.now()
    if (this.configCache && this.configCache.expiresAt > now) {
      return this.configCache.value
    }

    const record = await this.prisma.systemConfig.findUnique({
      where: { key: AberturasGlossaryService.CONFIG_KEY },
    })
    const parsed = this.parseConfig(record?.value)
    this.configCache = {
      value: parsed,
      expiresAt: now + AberturasGlossaryService.CONFIG_CACHE_TTL_MS,
    }
    return parsed
  }

  async updateConfig(payload: UpdateAberturasConfigInput): Promise<AberturasConfig> {
    const sanitized = this.normalizeConfig(payload)
    await this.prisma.systemConfig.upsert({
      where: { key: AberturasGlossaryService.CONFIG_KEY },
      create: {
        key: AberturasGlossaryService.CONFIG_KEY,
        value: JSON.stringify(sanitized),
      },
      update: {
        value: JSON.stringify(sanitized),
      },
    })
    this.configCache = {
      value: sanitized,
      expiresAt: Date.now() + AberturasGlossaryService.CONFIG_CACHE_TTL_MS,
    }
    return sanitized
  }

  async getNearestConfig(): Promise<AberturasConfig['nearest']> {
    const config = await this.getConfig()
    return config.nearest
  }

  async getPricingConfig(): Promise<AberturasConfig['pricing']> {
    const config = await this.getConfig()
    return config.pricing
  }

  private normalizePayload(category: string, payload: CreateGlossaryItemInput) {
    const label = (payload.label ?? '').trim()
    const value = (payload.value ?? label).trim()
    return {
      category,
      label,
      value,
      adjustPct:
        payload.adjustPct !== null && payload.adjustPct !== undefined
          ? new Prisma.Decimal(payload.adjustPct)
          : null,
    }
  }

  private toResponse(record: {
    id: number
    category: string
    label: string
    value: string
    adjustPct: Prisma.Decimal | null
    metadata: Prisma.JsonValue | null
  }) {
    return {
      id: record.id,
      category: record.category,
      label: record.label,
      value: record.value,
      adjustPct: record.adjustPct ? Number(record.adjustPct) : null,
      metadata: record.metadata ?? null,
    }
  }

  private parseConfig(raw?: string | null): AberturasConfig {
    if (!raw) {
      return DEFAULT_ABERTURAS_CONFIG
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AberturasConfig>
      return this.normalizeConfig(parsed)
    } catch (error) {
      this.logger.warn('Failed to parse stored aberturas config, falling back to defaults', error as Error)
      return DEFAULT_ABERTURAS_CONFIG
    }
  }

  private normalizeConfig(payload?: Partial<AberturasConfig> | UpdateAberturasConfigInput): AberturasConfig {
    const base = payload ?? {}
    const nearest = base?.nearest ?? {}
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
    const maxResults = Number.isFinite(nearest.maxResults) ? clamp(Number(nearest.maxResults), 1, 10) : DEFAULT_ABERTURAS_CONFIG.nearest.maxResults
    const dimensionTolerancePercent = Number.isFinite(nearest.dimensionTolerancePercent)
      ? clamp(Number(nearest.dimensionTolerancePercent), 1, 100)
      : DEFAULT_ABERTURAS_CONFIG.nearest.dimensionTolerancePercent
    const dimensionMinToleranceMm = Number.isFinite(nearest.dimensionMinToleranceMm)
      ? clamp(Number(nearest.dimensionMinToleranceMm), 1, 2000)
      : DEFAULT_ABERTURAS_CONFIG.nearest.dimensionMinToleranceMm

    const pricing = base?.pricing ?? {}
    const markupPercent = Number.isFinite(pricing.markupPercent)
      ? clamp(Number(pricing.markupPercent), 0, 500)
      : DEFAULT_ABERTURAS_CONFIG.pricing.markupPercent

    return {
      nearest: {
        maxResults,
        dimensionTolerancePercent,
        dimensionMinToleranceMm,
      },
      pricing: {
        markupPercent,
      },
    }
  }
}
