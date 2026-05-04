import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProductMode, ProductType, SeoEntityType } from '@prisma/client'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { PublicResponseCacheService } from '../common/cache/public-response-cache.service'
import { buildCategorySlug, buildProductSlug } from './utils'
import { StorefrontService } from './storefront.service'
import type {
  ProductDetailDto,
  ResolvedSeoMetadataDto,
  SeoIndexableDto,
  StorefrontCategoryTree,
  StorefrontConfig,
} from './types'

const PUBLIC_SEO_CACHE_TTL_MS = 5 * 60 * 1000

type SeoOverrideRecord = Prisma.SeoMetadataGetPayload<{
  select: {
    tenantId: true
    entityType: true
    entityId: true
    slug: true
    title: true
    description: true
    keywords: true
    ogTitle: true
    ogDescription: true
    ogImage: true
    canonicalUrl: true
    robots: true
    schemaType: true
    schemaPayload: true
    searchTerms: true
    language: true
    updatedAt: true
  }
}>

const normalizeText = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().replace(/\s+/g, ' ')
}

const stripHtml = (value?: string | null): string => normalizeText(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const normalized = normalizeText(value)
    if (!normalized) {
      return
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(normalized)
  })

  return result
}

const normalizeArray = (values?: Array<string | null | undefined>): string[] => uniqueStrings(Array.isArray(values) ? values : [])

const normalizeOrigin = (value?: string | null): string | null => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return null
  }

  try {
    return new URL(normalized.endsWith('/') ? normalized : `${normalized}/`).origin
  } catch {
    try {
      return new URL(`https://${normalized}`).origin
    } catch {
      return null
    }
  }
}

const resolveOrigin = (config?: Pick<StorefrontConfig, 'companyProfile'> | null): string => {
  const environmentOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(process.env.STOREFRONT_BASE_URL) ??
    normalizeOrigin(process.env.BASE_URL)
  if (environmentOrigin) {
    return environmentOrigin
  }

  const website = normalizeText(config?.companyProfile?.website)

  if (website) {
    return normalizeOrigin(website) ?? 'http://localhost:3000'
  }

  return 'http://localhost:3000'
}

const resolveAbsoluteUrl = (path: string, config?: Pick<StorefrontConfig, 'companyProfile'> | null): string => {
  return new URL(path.startsWith('/') ? path : `/${path}`, resolveOrigin(config)).toString()
}

const resolveImageUrl = (value?: string | null, config?: Pick<StorefrontConfig, 'companyProfile'> | null): string | null => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return null
  }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) {
    return normalized
  }
  return resolveAbsoluteUrl(normalized, config)
}

const parseSpecifications = (
  specifications?: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> =>
  Array.isArray(specifications)
    ? specifications
        .map((entry) => ({
          label: normalizeText(entry?.label),
          value: normalizeText(entry?.value),
        }))
        .filter((entry) => entry.label && entry.value)
    : []

const isAberturasCategory = (category?: { slug?: string; name?: string } | null): boolean => {
  const haystack = `${normalizeText(category?.slug)} ${normalizeText(category?.name)}`.toLowerCase()
  return haystack.includes('abertura')
}

const isAberturasProduct = (product: Pick<ProductDetailDto, 'mode' | 'categories'>): boolean => {
  if (product.mode === 'parametric') {
    return true
  }
  return Array.isArray(product.categories) && product.categories.some((category) => isAberturasCategory(category))
}

const flattenCategories = (categories: StorefrontCategoryTree[]): StorefrontCategoryTree[] => {
  const flattened: StorefrontCategoryTree[] = []

  const visit = (nodes: StorefrontCategoryTree[]) => {
    nodes.forEach((node) => {
      flattened.push(node)
      if (Array.isArray(node.children) && node.children.length > 0) {
        visit(node.children)
      }
    })
  }

  visit(categories)
  return flattened
}

@Injectable()
export class StorefrontSeoService {
  private readonly memoryCache = new Map<string, unknown>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly config: ConfigService,
    private readonly publicResponseCache: PublicResponseCacheService,
  ) {}

  private getClientSlug(): string {
    const get = this.config?.get?.bind(this.config)
    return String(get?.('CLIENT_SLUG') ?? get?.('CLIENT') ?? '')
      .trim()
      .toLowerCase()
  }

  private getTenantScope(): string {
    const tenant = this.getClientSlug()
    return tenant.length > 0 ? tenant : 'global'
  }

  private async readCache<T>(key: string): Promise<T | null> {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T
    }
    return this.publicResponseCache.get<T>(key)
  }

  private async writeCache<T>(key: string, value: T, ttlMs: number): Promise<T> {
    this.memoryCache.set(key, value)
    return this.publicResponseCache.set(key, value, ttlMs)
  }

  private async getOrSetCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.readCache<T>(key)
    if (cached !== null) {
      return cached
    }
    const value = await loader()
    return this.writeCache(key, value, ttlMs)
  }

  private normalizePath(path: string): string {
    const trimmed = normalizeText(path)
    if (!trimmed || trimmed === '/') {
      return '/'
    }
    const [pathname] = trimmed.split('?')
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
    return normalized.replace(/\/+$/, '') || '/'
  }

  private resolveProductRoutePath(product: ProductDetailDto): string {
    if (product.canonicalConfiguration?.slug) {
      return `/${product.canonicalConfiguration.slug}`
    }
    if (isAberturasProduct(product)) {
      return `/aberturas/${product.slug}`
    }
    return `/product/${product.slug}`
  }

  private extractSemanticPayload(
    product: ProductDetailDto,
    extraTerms: string[] = [],
  ): ResolvedSeoMetadataDto['semantic'] {
    const specifications = parseSpecifications(product.specifications)
    const dimensions = specifications
      .filter((entry) => /ancho|alto|medida|area|área|dimension|dimensi[oó]n/i.test(entry.label))
      .map((entry) => `${entry.label}: ${entry.value}`)
    const materialSpecs = specifications
      .filter((entry) => /material|vidrio|linea|línea|perfil|acabado|color/i.test(entry.label))
      .map((entry) => `${entry.label}: ${entry.value}`)
    const customizations = uniqueStrings([
      product.mode === 'parametric' ? 'configurable a medida' : null,
      product.publishedParametricOptions?.selectors?.hasMosquiteroOption ? 'opcion mosquitero' : null,
      product.publishedParametricOptions?.selectors?.hasMonoblockOption ? 'opcion monoblock' : null,
      ...(product.publishedParametricOptions?.selectors?.series ?? []),
      ...(product.publishedParametricOptions?.selectors?.materials ?? []),
      ...(product.publishedParametricOptions?.selectors?.colors ?? []),
      ...(product.publishedParametricOptions?.selectors?.glass ?? []),
    ])

    return {
      materials: uniqueStrings([
        ...materialSpecs,
        ...(product.publishedParametricOptions?.selectors?.materials ?? []),
        ...(product.publishedParametricOptions?.selectors?.glass ?? []),
      ]),
      dimensions,
      uses: uniqueStrings([
        ...(product.categories?.map((category) => category.name) ?? []),
        ...(product.tags ?? []),
        ...extraTerms,
      ]),
      attributes: specifications,
      productType: product.mode ?? null,
      category: product.categories?.[0]?.name ?? null,
      variantLabel: product.variantLabel ?? null,
      customizations,
    }
  }

  private buildGeneratedProductTitle(product: ProductDetailDto, semantic: ResolvedSeoMetadataDto['semantic']): string {
    if (product.canonicalConfiguration?.canonicalName) {
      const base = product.canonicalConfiguration.baseLabel
      return uniqueStrings([
        product.canonicalConfiguration.canonicalName,
        base ? `(${base})` : null,
        isAberturasProduct(product) ? 'a medida' : null,
      ]).join(' ')
    }

    const measured = isAberturasProduct(product) ? 'a medida' : null
    return uniqueStrings([
      product.name,
      measured,
      semantic.variantLabel,
    ]).join(' ')
  }

  private buildGeneratedProductDescription(
    product: ProductDetailDto,
    semantic: ResolvedSeoMetadataDto['semantic'],
  ): string {
    const intro = product.canonicalConfiguration?.canonicalName
      ? `${product.canonicalConfiguration.canonicalName} ${product.canonicalConfiguration.baseLabel ? `para ${product.canonicalConfiguration.baseLabel}` : ''}`.trim()
      : product.name
    const materials = semantic.materials.slice(0, 2).join(', ')
    const dimensions = semantic.dimensions.slice(0, 2).join(', ')
    const uses = semantic.uses.slice(0, 3).join(', ')
    const customization = semantic.customizations?.slice(0, 3).join(', ') ?? ''

    return uniqueStrings([
      intro ? `${intro} con informacion estructurada para compra e indexacion.` : null,
      materials ? `Materiales y acabados: ${materials}.` : null,
      dimensions ? `Configuraciones visibles: ${dimensions}.` : null,
      customization ? `Personalizacion disponible: ${customization}.` : null,
      uses ? `Ideal para: ${uses}.` : null,
    ]).join(' ')
  }

  private buildProductSchemaPayload(
    config: StorefrontConfig,
    product: ProductDetailDto,
    routePath: string,
    title: string,
    description: string,
    semantic: ResolvedSeoMetadataDto['semantic'],
  ): Array<Record<string, unknown>> {
    const canonicalUrl = resolveAbsoluteUrl(routePath, config)
    const image = resolveImageUrl(product.seoImageUrl ?? product.thumbnail?.url ?? product.gallery?.[0]?.url ?? null, config)
    const ratingCount = product.reviewSummary?.reviewCount ?? 0
    const priceCurrency = product.salePrice?.currency ?? product.price.currency
    const priceAmount = product.salePrice?.amount ?? product.price.amount
    const variants = product.publishedParametricOptions?.variants ?? []
    const offerValues = variants.map((variant) => variant.price.amount).filter((value) => Number.isFinite(value))
    const lowPrice = offerValues.length > 0 ? Math.min(...offerValues) : priceAmount
    const highPrice = offerValues.length > 0 ? Math.max(...offerValues) : priceAmount
    const hasRange = !product.canonicalConfiguration && offerValues.length > 1 && lowPrice !== highPrice
    const availability =
      product.inventoryStatus === 'out-of-stock'
        ? 'https://schema.org/OutOfStock'
        : product.inventoryStatus === 'back-order'
        ? 'https://schema.org/BackOrder'
        : product.inventoryStatus === 'limited'
        ? 'https://schema.org/LimitedAvailability'
        : 'https://schema.org/InStock'

    const additionalProperty = semantic.attributes.map((attribute) => ({
      '@type': 'PropertyValue',
      name: attribute.label,
      value: attribute.value,
    }))

    if (semantic.customizations && semantic.customizations.length > 0) {
      additionalProperty.push({
        '@type': 'PropertyValue',
        name: 'Personalizacion',
        value: semantic.customizations.join(', '),
      })
    }

    const productSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description,
      url: canonicalUrl,
      sku: String(product.id),
      image: image ? [image] : undefined,
      category: product.categories?.map((category) => category.name).join(', ') || undefined,
      material: semantic.materials.length > 0 ? semantic.materials.join(', ') : undefined,
      additionalProperty: additionalProperty.length > 0 ? additionalProperty : undefined,
      brand: {
        '@type': 'Brand',
        name:
          normalizeText(config.companyProfile?.tradeName) ||
          normalizeText(config.companyProfile?.legalName) ||
          normalizeText(config.seo.siteName) ||
          'Storefront',
      },
      offers: hasRange
        ? {
            '@type': 'AggregateOffer',
            url: canonicalUrl,
            lowPrice,
            highPrice,
            offerCount: offerValues.length,
            priceCurrency,
            availability,
          }
        : {
            '@type': 'Offer',
            url: canonicalUrl,
            price: priceAmount,
            priceCurrency,
            availability,
          },
    }

    if (ratingCount > 0 && product.reviewSummary) {
      productSchema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Number(product.reviewSummary.averageRating.toFixed(2)),
        reviewCount: ratingCount,
      }
    }

    return [
      productSchema,
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name:
              normalizeText(config.companyProfile?.tradeName) ||
              normalizeText(config.companyProfile?.legalName) ||
              normalizeText(config.seo.siteName) ||
              'Storefront',
            item: resolveAbsoluteUrl('/', config),
          },
          ...(routePath.startsWith('/aberturas/')
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Aberturas',
                  item: resolveAbsoluteUrl('/aberturas', config),
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: product.name,
                  item: canonicalUrl,
                },
              ]
            : [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: title,
                  item: canonicalUrl,
                },
              ]),
        ],
      },
    ]
  }

  private buildCategorySchemaPayload(
    config: StorefrontConfig,
    category: StorefrontCategoryTree,
    routePath: string,
    title: string,
    description: string,
  ): Array<Record<string, unknown>> {
    const canonicalUrl = resolveAbsoluteUrl(routePath, config)
    const image = resolveImageUrl(category.seoImageUrl ?? category.thumbnail?.url ?? null, config)

    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonicalUrl,
        image: image ? [image] : undefined,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name:
              normalizeText(config.companyProfile?.tradeName) ||
              normalizeText(config.companyProfile?.legalName) ||
              normalizeText(config.seo.siteName) ||
              'Storefront',
            item: resolveAbsoluteUrl('/', config),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Categorias',
            item: resolveAbsoluteUrl('/categories', config),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: category.name,
            item: canonicalUrl,
          },
        ],
      },
    ]
  }

  private async resolveOverride(
    entityType: SeoEntityType,
    entityId: number,
    language: string,
  ): Promise<SeoOverrideRecord | null> {
    const tenantId = this.getTenantScope()
    const overrides = await this.prisma.seoMetadata.findMany({
      where: {
        entityType,
        entityId,
        language,
        OR: [{ tenantId }, { tenantId: 'global' }],
      },
      orderBy: [{ tenantId: 'desc' }, { updatedAt: 'desc' }],
      select: {
        tenantId: true,
        entityType: true,
        entityId: true,
        slug: true,
        title: true,
        description: true,
        keywords: true,
        ogTitle: true,
        ogDescription: true,
        ogImage: true,
        canonicalUrl: true,
        robots: true,
        schemaType: true,
        schemaPayload: true,
        searchTerms: true,
        language: true,
        updatedAt: true,
      },
    })

    return overrides.find((entry) => entry.tenantId === tenantId) ?? overrides.find((entry) => entry.tenantId === 'global') ?? null
  }

  private applyOverride(
    base: ResolvedSeoMetadataDto,
    override: SeoOverrideRecord | null,
  ): ResolvedSeoMetadataDto {
    if (!override) {
      return base
    }

    return {
      ...base,
      tenantId: override.tenantId ?? base.tenantId,
      slug: normalizeText(override.slug) || base.slug,
      title: normalizeText(override.title) || base.title,
      description: normalizeText(override.description) || base.description,
      keywords: uniqueStrings([...(override.keywords ?? []), ...base.keywords]),
      ogTitle: normalizeText(override.ogTitle) || base.ogTitle,
      ogDescription: normalizeText(override.ogDescription) || base.ogDescription,
      ogImage: resolveImageUrl(override.ogImage, null) || base.ogImage,
      canonicalUrl: normalizeText(override.canonicalUrl) || base.canonicalUrl,
      robots: normalizeText(override.robots) || base.robots,
      schemaType: normalizeText(override.schemaType) || base.schemaType,
      schemaPayload:
        override.schemaPayload && typeof override.schemaPayload === 'object'
          ? (override.schemaPayload as ResolvedSeoMetadataDto['schemaPayload'])
          : base.schemaPayload,
      searchTerms: uniqueStrings([...(override.searchTerms ?? []), ...base.searchTerms]),
      language: normalizeText(override.language) || base.language,
    }
  }

  private async buildProductSeoDocument(
    product: ProductDetailDto,
    language: string,
  ): Promise<ResolvedSeoMetadataDto> {
    const config = await this.storefront.getConfig()
    const routePath = this.resolveProductRoutePath(product)
    const semantic = this.extractSemanticPayload(product, product.canonicalConfiguration?.searchTerms ?? [])
    const generatedTitle = this.buildGeneratedProductTitle(product, semantic)
    const title = normalizeText(product.seoTitle) || generatedTitle
    const description =
      normalizeText(product.seoDescription) ||
      normalizeText(product.shortDescription) ||
      stripHtml(product.description) ||
      stripHtml(product.descriptionHtml) ||
      this.buildGeneratedProductDescription(product, semantic)
    const entityType = product.canonicalConfiguration ? SeoEntityType.CANONICAL : SeoEntityType.PRODUCT
    const entityId = product.canonicalConfiguration?.id ?? product.id
    const keywords = uniqueStrings([
      title,
      product.name,
      ...(product.categories?.map((category) => category.name) ?? []),
      ...(product.tags ?? []),
      ...(product.canonicalConfiguration?.searchTerms ?? []),
      ...semantic.materials,
      ...(semantic.customizations ?? []),
    ])
    const searchTerms = uniqueStrings([
      product.slug,
      ...(product.tags ?? []),
      ...(product.categories?.map((category) => category.slug) ?? []),
      ...(product.categories?.map((category) => category.name) ?? []),
      ...(product.canonicalConfiguration?.searchTerms ?? []),
      ...semantic.materials,
      ...(semantic.customizations ?? []),
    ])

    const base: ResolvedSeoMetadataDto = {
      entityType: entityType === SeoEntityType.CANONICAL ? 'canonical' : 'product',
      entityId,
      tenantId: this.getTenantScope(),
      slug: product.canonicalConfiguration?.slug ?? product.slug,
      routePath,
      title,
      description,
      keywords,
      ogTitle: title,
      ogDescription: description,
      ogImage: resolveImageUrl(product.seoImageUrl ?? product.thumbnail?.url ?? product.gallery?.[0]?.url ?? null, config),
      canonicalUrl: resolveAbsoluteUrl(routePath, config),
      robots:
        product.canonicalConfiguration?.indexable === false
          ? 'noindex,follow'
          : 'index,follow',
      schemaType: 'Product',
      schemaPayload: this.buildProductSchemaPayload(config, product, routePath, title, description, semantic),
      searchTerms,
      language,
      semantic,
    }

    return this.applyOverride(base, await this.resolveOverride(entityType, entityId, language))
  }

  private async buildCategorySeoDocument(
    category: StorefrontCategoryTree,
    language: string,
  ): Promise<ResolvedSeoMetadataDto> {
    const config = await this.storefront.getConfig()
    const routePath = `/categories/${category.slug}`
    const title = normalizeText(category.seoTitle) || category.name
    const description =
      normalizeText(category.seoDescription) ||
      normalizeText(category.description) ||
      `Explora ${category.name} con una ruta indexable, metadata automatica y productos relacionados.`
    const semantic = {
      materials: [] as string[],
      dimensions: [] as string[],
      uses: uniqueStrings([category.name, category.slug]),
      attributes: [] as Array<{ label: string; value: string }>,
      productType: 'category',
      category: category.name,
      variantLabel: null,
      customizations: [],
    }

    const base: ResolvedSeoMetadataDto = {
      entityType: 'category',
      entityId: category.id,
      tenantId: this.getTenantScope(),
      slug: category.slug,
      routePath,
      title,
      description,
      keywords: uniqueStrings([category.name, category.slug]),
      ogTitle: title,
      ogDescription: description,
      ogImage: resolveImageUrl(category.seoImageUrl ?? category.thumbnail?.url ?? null, config),
      canonicalUrl: resolveAbsoluteUrl(routePath, config),
      robots: 'index,follow',
      schemaType: 'CollectionPage',
      schemaPayload: this.buildCategorySchemaPayload(config, category, routePath, title, description),
      searchTerms: uniqueStrings([category.name, category.slug]),
      language,
      semantic,
    }

    return this.applyOverride(base, await this.resolveOverride(SeoEntityType.CATEGORY, category.id, language))
  }

  async resolveByPath(path: string, language = 'es'): Promise<ResolvedSeoMetadataDto> {
    const normalizedPath = this.normalizePath(path)
    const cacheKey = `storefront:seo:path:${this.getTenantScope()}:${language}:${normalizedPath}`

    return this.getOrSetCache(cacheKey, PUBLIC_SEO_CACHE_TTL_MS, async () => {
      await this.storefront.ensureCanonicalDefaults()

      if (normalizedPath.startsWith('/categories/')) {
        const categories = flattenCategories(await this.storefront.listCategories())
        const slug = normalizedPath.replace(/^\/categories\//, '')
        const category = categories.find((entry) => entry.slug === slug)
        if (!category) {
          throw new NotFoundException('SEO entity not found')
        }
        return this.buildCategorySeoDocument(category, language)
      }

      const identifier = normalizedPath
        .replace(/^\/product\//, '')
        .replace(/^\/aberturas\//, '')
        .replace(/^\/+/, '')

      if (!identifier || identifier === 'categories') {
        throw new NotFoundException('SEO entity not found')
      }

      const product = await this.storefront.getProduct(identifier)
      return this.buildProductSeoDocument(product, language)
    })
  }

  async listIndexables(language = 'es'): Promise<SeoIndexableDto[]> {
    const cacheKey = `storefront:seo:indexables:${language}:${this.getTenantScope()}`

    return this.getOrSetCache(cacheKey, PUBLIC_SEO_CACHE_TTL_MS, async () => {
      await this.storefront.ensureCanonicalDefaults()

      const config = await this.storefront.getConfig()
      const tenantId = this.getTenantScope()
      const [products, canonicalConfigurations, categories, categoryProducts] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            published: true,
            productType: ProductType.PHYSICAL,
          },
          select: {
            id: true,
            name: true,
            productCode: true,
            mode: true,
            currency: true,
            salePrice: true,
            updatedAt: true,
            createdAt: true,
            category: true,
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.canonicalConfiguration.findMany({
          where: {
            indexable: true,
            OR: [{ tenantId }, { tenantId: 'global' }],
          },
          select: {
            id: true,
            slug: true,
            updatedAt: true,
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.productCategory.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            seoTitle: true,
            seoDescription: true,
            seoImageUrl: true,
            image: true,
            parentId: true,
            installServiceProductId: true,
          },
          orderBy: [{ name: 'asc' }],
        }),
        this.prisma.product.findMany({
          where: {
            published: true,
            productType: ProductType.PHYSICAL,
            categoryId: { not: null },
          },
          select: {
            categoryId: true,
            updatedAt: true,
          },
        }),
      ])
      const scopedCanonicals = new Map<string, { id: number; slug: string; updatedAt: Date }>()
      canonicalConfigurations.forEach((configuration) => {
        if (!scopedCanonicals.has(configuration.slug)) {
          scopedCanonicals.set(configuration.slug, configuration)
        }
      })

      const categoryLatestUpdatedAt = new Map<number, Date>()
      categoryProducts.forEach((product) => {
        if (!product.categoryId) {
          return
        }
        const existing = categoryLatestUpdatedAt.get(product.categoryId)
        if (!existing || product.updatedAt.getTime() > existing.getTime()) {
          categoryLatestUpdatedAt.set(product.categoryId, product.updatedAt)
        }
      })

      const productEntries: SeoIndexableDto[] = products.map((product) => {
        const slug = buildProductSlug(product.id, product.name, product.productCode ?? undefined)
        const category = product.category
          ? { slug: buildCategorySlug(product.category.id, product.category.name), name: product.category.name }
          : null
        const path =
          product.mode === ProductMode.PARAMETRIC || isAberturasCategory(category)
            ? `/aberturas/${slug}`
            : `/product/${slug}`

        return {
          entityType: 'product',
          entityId: product.id,
          tenantId,
          slug,
          path,
          canonicalUrl: resolveAbsoluteUrl(path, config),
          updatedAt: (product.updatedAt ?? product.createdAt).toISOString(),
        }
      })

      const canonicalEntries: SeoIndexableDto[] = Array.from(scopedCanonicals.values()).map((configuration) => ({
        entityType: 'canonical',
        entityId: configuration.id,
        tenantId,
        slug: configuration.slug,
        path: `/${configuration.slug}`,
        canonicalUrl: resolveAbsoluteUrl(`/${configuration.slug}`, config),
        updatedAt: configuration.updatedAt.toISOString(),
      }))

      const categoryEntries: SeoIndexableDto[] = categories
        .filter((category) => category.installServiceProductId === null)
        .map((category) => {
          const slug = buildCategorySlug(category.id, category.name)
          const path = `/categories/${slug}`
          return {
            entityType: 'category',
            entityId: category.id,
            tenantId,
            slug,
            path,
            canonicalUrl: resolveAbsoluteUrl(path, config),
            updatedAt: (categoryLatestUpdatedAt.get(category.id) ?? new Date()).toISOString(),
          }
        })

      return [...canonicalEntries, ...productEntries, ...categoryEntries]
    })
  }
}
