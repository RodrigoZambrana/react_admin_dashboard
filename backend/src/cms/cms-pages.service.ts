import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CmsEntryStatus,
  CmsMediaType,
  CmsPageScope,
  Prisma,
} from '@prisma/client'
import { filterXSS, type IFilterXSSOptions } from 'xss'
import { PrismaService } from '../prisma/prisma.service'
import {
  CmsListMediaQueryDto,
  CmsListPagesQueryDto,
  CmsMediaDto,
  CmsPageBlockDto,
  CmsPageDto,
  CmsPageSectionDto,
} from './dto/cms-pages.dto'
import {
  deleteCmsMediaFile,
  persistCmsMediaFile,
} from '../common/uploads/cms'

type MultipartFile = import('@fastify/multipart').MultipartFile

const cmsRichTextOptions: IFilterXSSOptions = {
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  whiteList: {
    a: ['href', 'target', 'rel', 'title'],
    article: ['class'],
    blockquote: ['class'],
    br: [],
    code: ['class'],
    div: ['class'],
    em: [],
    figcaption: ['class'],
    figure: ['class'],
    h1: ['class'],
    h2: ['class'],
    h3: ['class'],
    h4: ['class'],
    h5: ['class'],
    h6: ['class'],
    hr: [],
    i: ['class'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen', 'loading', 'frameborder'],
    img: ['src', 'alt', 'title', 'loading'],
    li: ['class'],
    ol: ['class'],
    p: ['class'],
    pre: ['class'],
    s: [],
    section: ['class'],
    small: ['class'],
    span: ['class'],
    strong: ['class'],
    sub: [],
    sup: [],
    table: ['class'],
    tbody: ['class'],
    td: ['class', 'colspan', 'rowspan'],
    th: ['class', 'colspan', 'rowspan'],
    thead: ['class'],
    tr: ['class'],
    u: [],
    ul: ['class'],
  },
}

const pageInclude = {
  aliases: {
    orderBy: [{ path: 'asc' }],
  },
  sections: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      blocks: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          media: true,
        },
      },
    },
  },
} satisfies Prisma.CmsPageInclude

type CmsPageWithRelations = Prisma.CmsPageGetPayload<{ include: typeof pageInclude }>

@Injectable()
export class CmsPagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPages(query: CmsListPagesQueryDto = {}) {
    const locale = this.normalizeLocale(query.locale)
    const search = this.optionalText(query.search)
    return this.prisma.cmsPage.findMany({
      where: {
        ...(query.scope ? { scope: query.scope } : {}),
        ...(locale ? { locale } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.visible === undefined ? {} : { visible: query.visible }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { path: { contains: search.toLowerCase(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: {
          select: { sections: true },
        },
      },
    })
  }

  async getPage(id: number) {
    const page = await this.prisma.cmsPage.findUnique({
      where: { id },
      include: pageInclude,
    })
    if (!page) {
      throw new NotFoundException('CMS page not found')
    }
    return this.mapPageResponse(page)
  }

  async createPage(dto: CmsPageDto) {
    const normalized = this.normalizePageDto(dto)
    await this.assertUniquePath(normalized.path)
    await this.assertUniqueAliases(normalized.aliases)
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.cmsPage.create({
      data: {
        path: normalized.path,
        title: normalized.title,
        summary: normalized.summary,
        scope: normalized.scope,
        locale: normalized.locale,
        status: normalized.status,
        visible: normalized.visible,
        seoTitle: normalized.seoTitle,
        seoDescription: normalized.seoDescription,
        seoImageUrl: normalized.seoImageUrl,
        layoutKey: normalized.layoutKey,
        legacySource: normalized.legacySource,
      },
      })
      await this.replacePageAliases(tx, page.id, normalized.aliases)
      await this.replacePageSections(tx, page.id, normalized.sections)
      const saved = await tx.cmsPage.findUniqueOrThrow({
        where: { id: page.id },
        include: pageInclude,
      })
      return this.mapPageResponse(saved)
    })
  }

  async updatePage(id: number, dto: Partial<CmsPageDto>) {
    const existing = await this.getPage(id)
    const normalized = this.normalizePageDto({
      path: dto.path ?? existing.path,
      title: dto.title ?? existing.title,
      summary: dto.summary === undefined ? existing.summary : dto.summary,
      scope: dto.scope ?? existing.scope,
      locale: dto.locale ?? existing.locale,
      status: dto.status ?? existing.status,
      visible: dto.visible ?? existing.visible,
      seoTitle: dto.seoTitle === undefined ? existing.seoTitle : dto.seoTitle,
      seoDescription:
        dto.seoDescription === undefined ? existing.seoDescription : dto.seoDescription,
      seoImageUrl: dto.seoImageUrl === undefined ? existing.seoImageUrl : dto.seoImageUrl,
      layoutKey: dto.layoutKey === undefined ? existing.layoutKey : dto.layoutKey,
      legacySource:
        dto.legacySource === undefined ? existing.legacySource : dto.legacySource,
      aliases: dto.aliases ?? existing.aliases ?? [],
      sections:
        dto.sections ??
        existing.sections.map((section) => ({
          type: section.type,
          key: section.key,
          name: section.name,
          sortOrder: section.sortOrder,
          visible: section.visible,
          settings: (section.settings as Record<string, unknown> | null) ?? null,
          blocks: section.blocks.map((block) => ({
            type: block.type,
            key: block.key,
            name: block.name,
            sortOrder: block.sortOrder,
            visible: block.visible,
            content: (block.content as Record<string, unknown> | null) ?? null,
            mediaId: block.mediaId,
          })),
        })),
    })

    await this.assertUniquePath(normalized.path, id)
    await this.assertUniqueAliases(normalized.aliases, id)

    return this.prisma.$transaction(async (tx) => {
      await tx.cmsPage.update({
        where: { id },
        data: {
          path: normalized.path,
          title: normalized.title,
          summary: normalized.summary,
          scope: normalized.scope,
          locale: normalized.locale,
          status: normalized.status,
          visible: normalized.visible,
          seoTitle: normalized.seoTitle,
          seoDescription: normalized.seoDescription,
          seoImageUrl: normalized.seoImageUrl,
          layoutKey: normalized.layoutKey,
          legacySource: normalized.legacySource,
        },
      })
      await this.replacePageAliases(tx, id, normalized.aliases)
      await this.replacePageSections(tx, id, normalized.sections)
      const saved = await tx.cmsPage.findUniqueOrThrow({
        where: { id },
        include: pageInclude,
      })
      return this.mapPageResponse(saved)
    })
  }

  async deletePage(id: number) {
    await this.getPage(id)
    await this.prisma.cmsPage.delete({ where: { id } })
    return { ok: true }
  }

  async getPublicPageByPath(rawPath: string, locale = 'es'): Promise<CmsPageWithRelations> {
    const path = this.normalizePublicPath(rawPath)
    const normalizedLocale = this.normalizeLocale(locale) ?? 'es'
    const directCandidates = this.buildLegacyPathCandidates(path)
    const pages = await this.prisma.cmsPage.findMany({
      where: {
        OR: [
          {
            path: {
              in: directCandidates,
            },
          },
          {
            aliases: {
              some: {
                path: {
                  in: directCandidates,
                },
              },
            },
          },
        ],
        locale: normalizedLocale,
        visible: true,
        status: CmsEntryStatus.PUBLISHED,
      },
      include: {
        aliases: {
          orderBy: [{ path: 'asc' }],
        },
        sections: {
          where: { visible: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            blocks: {
              where: { visible: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: { media: true },
            },
          },
        },
      },
    })

    let page =
      directCandidates
        .map((candidatePath) =>
          pages.find(
            (entry) =>
              entry.path === candidatePath ||
              entry.aliases.some((alias) => alias.path === candidatePath),
          ),
        )
        .find(Boolean) ?? null

    if (!page && path && !path.includes('/')) {
      const basenameMatches = await this.prisma.cmsPage.findMany({
        where: {
          OR: [
            { path },
            { path: { endsWith: `/${path}` } },
            {
              aliases: {
                some: {
                  OR: [{ path }, { path: { endsWith: `/${path}` } }],
                },
              },
            },
          ],
          locale: normalizedLocale,
          visible: true,
          status: CmsEntryStatus.PUBLISHED,
        },
        include: {
          aliases: {
            orderBy: [{ path: 'asc' }],
          },
          sections: {
            where: { visible: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: {
              blocks: {
                where: { visible: true },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                include: { media: true },
              },
            },
          },
        },
      })

      page =
        basenameMatches.sort((left, right) =>
          this.compareLegacyAliasPaths(left.path, right.path),
        )[0] ?? null
    }

    if (!page) {
      throw new NotFoundException('CMS page not found')
    }

    return page
  }

  async listMedia(query: CmsListMediaQueryDto = {}) {
    const search = this.optionalText(query.search)
    return this.prisma.cmsMedia.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { alt: { contains: search, mode: 'insensitive' } },
                { fileName: { contains: search, mode: 'insensitive' } },
                { url: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  async getMedia(id: number) {
    const media = await this.prisma.cmsMedia.findUnique({ where: { id } })
    if (!media) {
      throw new NotFoundException('CMS media not found')
    }
    return media
  }

  async createMedia(dto: CmsMediaDto) {
    const normalized = this.normalizeMediaCreateDto(dto)
    if (!normalized.url) {
      throw new BadRequestException('CMS media url is required')
    }
    return this.prisma.cmsMedia.create({
      data: normalized,
    })
  }

  async updateMedia(id: number, dto: Partial<CmsMediaDto>) {
    await this.getMedia(id)
    const normalized = this.normalizeMediaUpdateDto(dto)
    return this.prisma.cmsMedia.update({
      where: { id },
      data: normalized,
    })
  }

  async uploadMedia(dto: CmsMediaDto, file: MultipartFile) {
    const persisted = await persistCmsMediaFile(file)
    const normalized = this.normalizeMediaCreateDto({
      ...dto,
      url: persisted.url,
      mimeType: persisted.mimeType,
      sizeBytes: persisted.sizeBytes,
      fileName: persisted.fileName,
      type: dto.type ?? persisted.type,
    })

    return this.prisma.cmsMedia.create({
      data: normalized,
    })
  }

  async deleteMedia(id: number) {
    const media = await this.getMedia(id)
    await this.prisma.cmsMedia.delete({ where: { id } })
    await deleteCmsMediaFile(media.url)
    return { ok: true }
  }

  normalizePublicPath(rawPath?: string | null) {
    const value = (rawPath ?? '').trim()
    if (!value || value === '/' || value === 'index.html') {
      return ''
    }

    const withoutHash = value.split('#')[0] ?? ''
    const withoutQuery = withoutHash.split('?')[0] ?? ''
    const withoutDomain = withoutQuery.replace(/^https?:\/\/[^/]+/i, '')
    const normalized = withoutDomain
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
      .replace(/^index\.html$/i, '')
      .trim()
      .toLowerCase()

    return normalized
  }

  private normalizeAliasPaths(values: string[] | undefined, pagePath: string) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => this.normalizePublicPath(value))
          .filter((value) => value && value !== pagePath),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }

  private buildLegacyPathCandidates(path: string) {
    if (!path) {
      return ['']
    }

    const candidates = [path]
    if (!path.includes('/') && /\.(html?|php)$/i.test(path)) {
      for (const prefix of ['productos', 'servicios', 'articulos', 'catalogo']) {
        candidates.push(`${prefix}/${path}`)
      }
    }

    return [...new Set(candidates)]
  }

  private compareLegacyAliasPaths(leftPath: string, rightPath: string) {
    const rank = (value: string) => {
      const prefix = value.split('/')[0] ?? ''
      switch (prefix) {
        case 'productos':
          return 0
        case 'servicios':
          return 1
        case 'articulos':
          return 2
        case 'catalogo':
          return 3
        default:
          return 4
      }
    }

    return rank(leftPath) - rank(rightPath) || leftPath.localeCompare(rightPath)
  }

  private async assertUniquePath(path: string, excludeId?: number) {
    const [existingPage, existingAlias] = await Promise.all([
      this.prisma.cmsPage.findFirst({
        where: {
          path,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
      this.prisma.cmsPageAlias.findFirst({
        where: {
          path,
          ...(excludeId ? { pageId: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
    ])

    if (existingPage || existingAlias) {
      throw new BadRequestException('CMS page path already exists')
    }
  }

  private async assertUniqueAliases(aliases: string[], excludeId?: number) {
    if (!aliases.length) {
      return
    }

    const [existingPage, existingAlias] = await Promise.all([
      this.prisma.cmsPage.findFirst({
        where: {
          path: { in: aliases },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
      this.prisma.cmsPageAlias.findFirst({
        where: {
          path: { in: aliases },
          ...(excludeId ? { pageId: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
    ])

    if (existingPage || existingAlias) {
      throw new BadRequestException('CMS page alias already exists')
    }
  }

  private async replacePageAliases(
    tx: Prisma.TransactionClient,
    pageId: number,
    aliases: string[] = [],
  ) {
    await tx.cmsPageAlias.deleteMany({ where: { pageId } })

    if (!aliases.length) {
      return
    }

    await tx.cmsPageAlias.createMany({
      data: aliases.map((path) => ({
        pageId,
        path,
      })),
    })
  }

  private async replacePageSections(
    tx: Prisma.TransactionClient,
    pageId: number,
    sections: CmsPageSectionDto[] = [],
  ) {
    await tx.cmsPageSection.deleteMany({ where: { pageId } })

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const section = sections[sectionIndex]
      const createdSection = await tx.cmsPageSection.create({
        data: {
          pageId,
          type: section.type,
          key: this.optionalText(section.key),
          name: this.optionalText(section.name),
          sortOrder: Number.isFinite(Number(section.sortOrder))
            ? Number(section.sortOrder)
            : sectionIndex,
          visible: section.visible ?? true,
          settings: this.toJsonInput(section.settings),
        },
      })

      for (let blockIndex = 0; blockIndex < (section.blocks ?? []).length; blockIndex += 1) {
        const block = section.blocks?.[blockIndex]
        if (!block) {
          continue
        }
        if (block.mediaId) {
          await this.ensureMediaExists(block.mediaId)
        }

        await tx.cmsPageBlock.create({
          data: {
            sectionId: createdSection.id,
            type: block.type,
            key: this.optionalText(block.key),
            name: this.optionalText(block.name),
            sortOrder: Number.isFinite(Number(block.sortOrder))
              ? Number(block.sortOrder)
              : blockIndex,
            visible: block.visible ?? true,
            content: this.toJsonInput(block.content),
            mediaId: block.mediaId ?? null,
          },
        })
      }
    }
  }

  private async ensureMediaExists(id: number) {
    const media = await this.prisma.cmsMedia.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!media) {
      throw new NotFoundException('CMS media not found')
    }
  }

  private normalizePageDto(dto: CmsPageDto) {
    const normalizedPath = this.normalizePublicPath(dto.path)
    return {
      path: normalizedPath,
      title: this.requireText(dto.title, 'CMS page title is required'),
      summary: this.optionalText(dto.summary),
      scope: dto.scope ?? CmsPageScope.GENERAL_SITE,
      locale: this.normalizeLocale(dto.locale) ?? 'es',
      status: dto.status ?? CmsEntryStatus.DRAFT,
      visible: dto.visible ?? true,
      seoTitle: this.optionalText(dto.seoTitle),
      seoDescription: this.optionalText(dto.seoDescription),
      seoImageUrl: this.optionalText(dto.seoImageUrl),
      layoutKey: this.optionalText(dto.layoutKey),
      legacySource: this.optionalText(dto.legacySource),
      aliases: this.normalizeAliasPaths(dto.aliases, normalizedPath),
      sections: (dto.sections ?? []).map((section, sectionIndex) =>
        this.normalizeSectionDto(section, sectionIndex),
      ),
    }
  }

  private mapPageResponse(page: CmsPageWithRelations) {
    return {
      ...page,
      aliases: page.aliases.map((alias) => alias.path),
    }
  }

  private normalizeSectionDto(dto: CmsPageSectionDto, sectionIndex: number): CmsPageSectionDto {
    return {
      type: dto.type,
      key: this.optionalText(dto.key),
      name: this.optionalText(dto.name),
      sortOrder: Number.isFinite(Number(dto.sortOrder)) ? Number(dto.sortOrder) : sectionIndex,
      visible: dto.visible ?? true,
      settings: this.sanitizeJson(dto.settings),
      blocks: (dto.blocks ?? []).map((block, blockIndex) =>
        this.normalizeBlockDto(block, blockIndex),
      ),
    }
  }

  private normalizeBlockDto(dto: CmsPageBlockDto, blockIndex: number): CmsPageBlockDto {
    return {
      type: dto.type,
      key: this.optionalText(dto.key),
      name: this.optionalText(dto.name),
      sortOrder: Number.isFinite(Number(dto.sortOrder)) ? Number(dto.sortOrder) : blockIndex,
      visible: dto.visible ?? true,
      content: this.sanitizeJson(dto.content),
      mediaId: dto.mediaId ?? null,
    }
  }

  private normalizeMediaCreateDto(dto: Partial<CmsMediaDto>): Prisma.CmsMediaCreateInput {
    const normalizedUrl = dto.url === undefined ? undefined : this.optionalText(dto.url)
    return {
      url: normalizedUrl ?? '',
      type: dto.type ?? CmsMediaType.IMAGE,
      alt: this.optionalText(dto.alt),
      title: this.optionalText(dto.title),
      mimeType: this.optionalText(dto.mimeType),
      fileName: this.optionalText(dto.fileName),
      sizeBytes:
        dto.sizeBytes === null || dto.sizeBytes === undefined
          ? null
          : Number(dto.sizeBytes),
      width:
        dto.width === null || dto.width === undefined ? null : Number(dto.width),
      height:
        dto.height === null || dto.height === undefined ? null : Number(dto.height),
      source: this.optionalText(dto.source),
      metadata: this.toJsonInput(this.sanitizeJson(dto.metadata)) ?? Prisma.JsonNull,
      isActive: dto.isActive ?? true,
    }
  }

  private normalizeMediaUpdateDto(dto: Partial<CmsMediaDto>): Prisma.CmsMediaUpdateInput {
    const normalizedUrl = dto.url === undefined ? undefined : this.optionalText(dto.url)
    return {
      ...(normalizedUrl === undefined ? {} : { url: normalizedUrl ?? '' }),
      ...(dto.type === undefined ? {} : { type: dto.type ?? CmsMediaType.IMAGE }),
      ...(dto.alt === undefined ? {} : { alt: this.optionalText(dto.alt) }),
      ...(dto.title === undefined ? {} : { title: this.optionalText(dto.title) }),
      ...(dto.mimeType === undefined ? {} : { mimeType: this.optionalText(dto.mimeType) }),
      ...(dto.fileName === undefined ? {} : { fileName: this.optionalText(dto.fileName) }),
      ...(dto.sizeBytes === undefined
        ? {}
        : {
            sizeBytes:
              dto.sizeBytes === null || dto.sizeBytes === undefined
                ? null
                : Number(dto.sizeBytes),
          }),
      ...(dto.width === undefined
        ? {}
        : { width: dto.width === null || dto.width === undefined ? null : Number(dto.width) }),
      ...(dto.height === undefined
        ? {}
        : { height: dto.height === null || dto.height === undefined ? null : Number(dto.height) }),
      ...(dto.source === undefined ? {} : { source: this.optionalText(dto.source) }),
      ...(dto.metadata === undefined ? {} : { metadata: this.toJsonInput(this.sanitizeJson(dto.metadata)) }),
      ...(dto.isActive === undefined ? {} : { isActive: Boolean(dto.isActive) }),
    }
  }

  private sanitizeJson(value?: Record<string, unknown> | null): Record<string, unknown> | null | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    const sanitizeValue = (input: unknown): unknown => {
      if (input === null || input === undefined) {
        return input
      }
      if (typeof input === 'string') {
        return filterXSS(input, cmsRichTextOptions).trim()
      }
      if (Array.isArray(input)) {
        return input.map((item) => sanitizeValue(item))
      }
      if (typeof input === 'object') {
        return Object.entries(input as Record<string, unknown>).reduce<Record<string, unknown>>(
          (acc, [key, current]) => {
            acc[key] = sanitizeValue(current)
            return acc
          },
          {},
        )
      }
      return input
    }

    return sanitizeValue(value) as Record<string, unknown>
  }

  private normalizeLocale(value?: string | null) {
    const locale = this.optionalText(value)
    return locale ? locale.toLowerCase() : null
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

  private toJsonInput(
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
}
