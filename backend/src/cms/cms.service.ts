import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CmsEntryStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CmsEntryDto, CmsSectionDto } from './dto/cms.dto'

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSections() {
    return this.prisma.cmsSection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      include: {
        _count: {
          select: { entries: true },
        },
      },
    })
  }

  async getSection(id: number) {
    const section = await this.prisma.cmsSection.findUnique({
      where: { id },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    })
    if (!section) {
      throw new NotFoundException('CMS section not found')
    }
    return section
  }

  async createSection(dto: CmsSectionDto) {
    const key = this.normalizeSectionKey(dto.key)
    return this.prisma.cmsSection.create({
      data: {
        key,
        name: this.requireText(dto.name, 'Section name is required.'),
        description: this.optionalText(dto.description),
        isActive: dto.isActive ?? true,
        sortOrder: Number.isFinite(Number(dto.sortOrder)) ? Number(dto.sortOrder) : 0,
      },
    })
  }

  async updateSection(id: number, dto: Partial<CmsSectionDto>) {
    await this.ensureSectionExists(id)
    return this.prisma.cmsSection.update({
      where: { id },
      data: {
        key: dto.key ? this.normalizeSectionKey(dto.key) : undefined,
        name: dto.name === undefined ? undefined : this.requireText(dto.name, 'Section name is required.'),
        description: dto.description === undefined ? undefined : this.optionalText(dto.description),
        isActive: dto.isActive === undefined ? undefined : Boolean(dto.isActive),
        sortOrder:
          dto.sortOrder === undefined ? undefined : Number.isFinite(Number(dto.sortOrder)) ? Number(dto.sortOrder) : 0,
      },
    })
  }

  async deleteSection(id: number) {
    await this.ensureSectionExists(id)
    await this.prisma.cmsSection.delete({ where: { id } })
    return { ok: true }
  }

  async listEntries(filters?: { sectionId?: number; sectionKey?: string }) {
    const where: Prisma.CmsEntryWhereInput = {}
    if (filters?.sectionId) {
      where.sectionId = filters.sectionId
    }
    if (filters?.sectionKey) {
      where.section = { key: this.normalizeSectionKey(filters.sectionKey) }
    }
    return this.prisma.cmsEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        section: true,
        product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            published: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        assets: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    })
  }

  async getEntry(id: number) {
    const entry = await this.prisma.cmsEntry.findUnique({
      where: { id },
      include: {
        section: true,
        product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            published: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        assets: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    })
    if (!entry) {
      throw new NotFoundException('CMS entry not found')
    }
    return entry
  }

  async createEntry(dto: CmsEntryDto) {
    await this.ensureSectionExists(dto.sectionId)
    if (dto.productId) {
      await this.ensureProductExists(dto.productId)
    }
    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId)
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.cmsEntry.create({
        data: this.buildEntryCreateData(dto),
      })
      await this.replaceAssets(tx, entry.id, dto.assets)
      return tx.cmsEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: {
          section: true,
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
              published: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          assets: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      })
    })
  }

  async updateEntry(id: number, dto: Partial<CmsEntryDto>) {
    await this.getEntry(id)
    if (dto.sectionId) {
      await this.ensureSectionExists(dto.sectionId)
    }
    if (dto.productId) {
      await this.ensureProductExists(dto.productId)
    }
    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId)
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.cmsEntry.update({
        where: { id },
        data: this.buildEntryUpdateData(dto),
      })
      if (dto.assets !== undefined) {
        await this.replaceAssets(tx, id, dto.assets)
      }
      return tx.cmsEntry.findUniqueOrThrow({
        where: { id },
        include: {
          section: true,
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
              published: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          assets: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      })
    })
  }

  async deleteEntry(id: number) {
    await this.getEntry(id)
    await this.prisma.cmsEntry.delete({ where: { id } })
    return { ok: true }
  }

  async getPublicSectionByKey(key: string, locale = 'es') {
    const normalizedKey = this.normalizeSectionKey(key)
    const now = new Date()
    const section = await this.prisma.cmsSection.findFirst(this.buildPublicSectionsQuery(locale, now, normalizedKey))

    if (!section) {
      throw new NotFoundException('CMS section not found')
    }

    return section
  }

  async listPublicSections(locale = 'es') {
    const now = new Date()
    return this.prisma.cmsSection.findMany(this.buildPublicSectionsQuery(locale, now))
  }

  private async replaceAssets(tx: Prisma.TransactionClient, entryId: number, assets?: CmsEntryDto['assets']) {
    await tx.cmsEntryAsset.deleteMany({ where: { entryId } })
    if (!assets?.length) {
      return
    }
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index]
      const mediaUrl = this.optionalText(asset.mediaUrl)
      if (!mediaUrl) {
        continue
      }
      await tx.cmsEntryAsset.create({
        data: {
          entryId,
          title: this.optionalText(asset.title),
          caption: this.optionalText(asset.caption),
          mediaType: asset.mediaType,
          mediaUrl,
          posterUrl: this.optionalText(asset.posterUrl),
          externalUrl: this.optionalText(asset.externalUrl),
          durationSec:
            asset.durationSec === null || asset.durationSec === undefined
              ? null
              : Number.isFinite(Number(asset.durationSec))
                ? Number(asset.durationSec)
                : null,
          sortOrder: Number.isFinite(Number(asset.sortOrder)) ? Number(asset.sortOrder) : index,
          isActive: asset.isActive ?? true,
        },
      })
    }
  }

  private buildEntryCreateData(dto: CmsEntryDto): Prisma.CmsEntryCreateInput {
    return {
      section: { connect: { id: dto.sectionId } },
      slug: this.optionalSlug(dto.slug),
      title: this.requireText(dto.title, 'Entry title is required.'),
      subtitle: this.optionalText(dto.subtitle),
      description: this.optionalText(dto.description),
      payload: this.toPrismaJsonInput(dto.payload),
      locale: this.normalizeLocale(dto.locale),
      status: dto.status ?? CmsEntryStatus.DRAFT,
      priority: Number.isFinite(Number(dto.priority)) ? Number(dto.priority) : 0,
      isActive: dto.isActive ?? true,
      publishedAt: dto.publishedAt ?? null,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
      thumbnailUrl: this.optionalText(dto.thumbnailUrl),
      ctaLabel: this.optionalText(dto.ctaLabel),
      ctaUrl: this.optionalText(dto.ctaUrl),
      product: dto.productId ? { connect: { id: dto.productId } } : undefined,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
    }
  }

  private buildEntryUpdateData(dto: Partial<CmsEntryDto>): Prisma.CmsEntryUpdateInput {
    const data: Prisma.CmsEntryUpdateInput = {}
    if (dto.sectionId !== undefined) {
      data.section = { connect: { id: dto.sectionId } }
    }
    if (dto.slug !== undefined) {
      data.slug = this.optionalSlug(dto.slug)
    }
    if (dto.title !== undefined) {
      data.title = this.requireText(dto.title, 'Entry title is required.')
    }
    if (dto.subtitle !== undefined) {
      data.subtitle = this.optionalText(dto.subtitle)
    }
    if (dto.description !== undefined) {
      data.description = this.optionalText(dto.description)
    }
    if (dto.payload !== undefined) {
      data.payload = this.toPrismaJsonInput(dto.payload)
    }
    if (dto.locale !== undefined) {
      data.locale = this.normalizeLocale(dto.locale)
    }
    if (dto.status !== undefined) {
      data.status = dto.status
    }
    if (dto.priority !== undefined) {
      data.priority = Number.isFinite(Number(dto.priority)) ? Number(dto.priority) : 0
    }
    if (dto.isActive !== undefined) {
      data.isActive = Boolean(dto.isActive)
    }
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt ?? null
    }
    if (dto.startsAt !== undefined) {
      data.startsAt = dto.startsAt ?? null
    }
    if (dto.endsAt !== undefined) {
      data.endsAt = dto.endsAt ?? null
    }
    if (dto.thumbnailUrl !== undefined) {
      data.thumbnailUrl = this.optionalText(dto.thumbnailUrl)
    }
    if (dto.ctaLabel !== undefined) {
      data.ctaLabel = this.optionalText(dto.ctaLabel)
    }
    if (dto.ctaUrl !== undefined) {
      data.ctaUrl = this.optionalText(dto.ctaUrl)
    }
    if (dto.productId !== undefined) {
      data.product = dto.productId ? { connect: { id: dto.productId } } : { disconnect: true }
    }
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true }
    }
    return data
  }

  private normalizeSectionKey(value: string) {
    const key = this.requireText(value, 'Section key is required.').toUpperCase()
    if (!/^[A-Z0-9_:-]+$/.test(key)) {
      throw new BadRequestException('Invalid section key.')
    }
    return key
  }

  private normalizeLocale(value?: string | null) {
    const locale = this.optionalText(value) ?? 'es'
    return locale.toLowerCase()
  }

  private optionalSlug(value?: string | null) {
    const slug = this.optionalText(value)
    return slug ? slug.toLowerCase() : null
  }

  private requireText(value: string | null | undefined, message: string) {
    const normalized = this.optionalText(value)
    if (!normalized) {
      throw new BadRequestException(message)
    }
    return normalized
  }

  private optionalText(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private toPrismaJsonInput(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return Prisma.JsonNull
    }
    return value as Prisma.InputJsonValue
  }

  private async ensureSectionExists(id: number) {
    const exists = await this.prisma.cmsSection.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      throw new NotFoundException('CMS section not found')
    }
  }

  private async ensureProductExists(id: number) {
    const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      throw new NotFoundException('Linked product not found')
    }
  }

  private async ensureCategoryExists(id: number) {
    const exists = await this.prisma.productCategory.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      throw new NotFoundException('Linked category not found')
    }
  }

  private buildPublicSectionsQuery(locale: string, now: Date, key?: string): Prisma.CmsSectionFindManyArgs {
    return {
      where: {
        ...(key ? { key } : {}),
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        entries: {
          where: {
            isActive: true,
            status: CmsEntryStatus.PUBLISHED,
            locale,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
          },
          orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productCode: true,
                published: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            assets: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    }
  }
}
