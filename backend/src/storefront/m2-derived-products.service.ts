import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ProductType, SalesUnit } from '@prisma/client'
import { createHash } from 'crypto'
import { CLIENT_CONFIG_TOKEN } from '../config/client-config.constants'
import type { ClientVariantConfig } from '../config/client-config.types'
import { BudgetCalculatorService } from '../budget/budget-calculator.service'
import type { BudgetProductSource } from '../budget/budget.types'
import { decimalToNumber } from '../common/currency/money.util'
import { PrismaService } from '../prisma/prisma.service'
import { buildProductSlug } from './utils'
import type { DerivedProductDto, ImageAssetDto, StandardSizeDto } from './types'
import { M2DerivedProductCacheService } from './m2-derived-product.cache'
import { M2DerivedProductStockService } from './m2-derived-product-stock.service'

type StandardSizeRecord = Prisma.StandardSizeGetPayload<{
  select: {
    id: true
    width: true
    height: true
    label: true
    isActive: true
    sortOrder: true
    updatedAt: true
  }
}>

type BaseProductRecord = Prisma.ProductGetPayload<{
  select: {
    id: true
    name: true
    productCode: true
    description: true
    category: {
      select: {
        id: true
        name: true
      }
    }
    salePrice: true
    currency: true
    unitOfMeasure: true
    published: true
    isBudgetCalculable: true
    calculationStrategy: true
    productType: true
    stock: true
    updatedAt: true
    images: {
      select: {
        id: true
        img: true
        name: true
        sortOrder: true
      }
    }
  }
}>

@Injectable()
export class M2DerivedProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetCalculator: BudgetCalculatorService,
    private readonly cache: M2DerivedProductCacheService,
    private readonly stockService: M2DerivedProductStockService,
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
  ) {}

  private assertTenant() {
    if (this.clientConfig?.slug !== 'urucortinas') {
      throw new NotFoundException()
    }
  }

  private normalizeDecimal(value: Prisma.Decimal | number | string | null | undefined): number {
    if (value === null || value === undefined) {
      return 0
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return decimalToNumber(value)
  }

  private toStandardSizeDto(size: StandardSizeRecord): StandardSizeDto {
    return {
      id: size.id,
      width: this.normalizeDecimal(size.width),
      height: this.normalizeDecimal(size.height),
      label: size.label,
      isActive: Boolean(size.isActive),
      sortOrder: size.sortOrder,
    }
  }

  private toImageDto(image: BaseProductRecord['images'][number]): ImageAssetDto {
    return {
      id: image.id,
      url: image.img,
      alt: image.name ?? null,
    }
  }

  private buildPriceVersion(product: BaseProductRecord) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          unitPricePerM2: this.normalizeDecimal(product.salePrice),
          updatedAt: product.updatedAt.toISOString(),
        }),
      )
      .digest('hex')
  }

  private buildStandardSizesVersion(sizes: StandardSizeRecord[]) {
    return createHash('sha256')
      .update(
        JSON.stringify(
          sizes.map((size) => ({
            id: size.id,
            width: this.normalizeDecimal(size.width),
            height: this.normalizeDecimal(size.height),
            label: size.label,
            isActive: Boolean(size.isActive),
            sortOrder: size.sortOrder,
            updatedAt: size.updatedAt.toISOString(),
          })),
        ),
      )
      .digest('hex')
  }

  private async getActiveStandardSizes(): Promise<{ sizes: StandardSizeDto[]; version: string }> {
    const sizes = await this.prisma.standardSize.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        width: true,
        height: true,
        label: true,
        isActive: true,
        sortOrder: true,
        updatedAt: true,
      },
    })

    return {
      sizes: sizes.map((size) => this.toStandardSizeDto(size)),
      version: this.buildStandardSizesVersion(sizes),
    }
  }

  async listStandardSizes(): Promise<StandardSizeDto[]> {
    this.assertTenant()
    const { sizes } = await this.getActiveStandardSizes()
    return sizes
  }

  private async buildDerivedProductsForBaseProduct(
    product: BaseProductRecord,
    sizes: StandardSizeDto[],
  ): Promise<DerivedProductDto[]> {
    const base = product as unknown as BudgetProductSource
    const images = product.images.map((image) => this.toImageDto(image))
    const baseStock = Number(product.stock ?? 0)

    const derived = await Promise.all(
      sizes.map(async (size) => {
        const width = size.width
        const height = size.height
        const calculated = await this.budgetCalculator.calculateForProduct(base, width, height)
        const stock = await this.stockService.getStock(product.id, size.id, baseStock)

        return {
          id: `${product.id}:${size.id}`,
          baseProductId: product.id,
          sizeId: size.id,
          name: `${product.name} - ${size.label}`,
          description: product.description ?? null,
          images,
          width: calculated.width,
          height: calculated.height,
          area: calculated.area,
          unitPricePerM2: calculated.unitPrice,
          totalPrice: calculated.totalPrice,
          stock: Math.max(0, Math.trunc(Number(stock ?? 0))),
          currency: product.currency,
          sizeLabel: size.label,
          slug: buildProductSlug(product.id, `${product.name} ${size.label}`),
          updatedAt: product.updatedAt.toISOString(),
          categories: product.category
            ? [
                {
                  id: product.category.id,
                  slug: buildProductSlug(product.category.id, product.category.name),
                  name: product.category.name,
                },
              ]
            : [],
          measurementType: 'M2',
          isPublic: true,
          isBudgetCalculable: true,
          calculationStrategy: product.calculationStrategy ?? 'M2',
          tags: ['m2', 'derived', ...(product.productCode ? [product.productCode] : [])],
        } satisfies DerivedProductDto
      }),
    )

    return derived
  }

  async listM2DerivedProducts(): Promise<DerivedProductDto[]> {
    this.assertTenant()

    const [baseProducts, standardSizeBundle] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          productType: ProductType.PHYSICAL,
          published: true,
          isBudgetCalculable: true,
          unitOfMeasure: SalesUnit.SQUARE_METER,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          productCode: true,
          description: true,
          salePrice: true,
          currency: true,
          unitOfMeasure: true,
          published: true,
          isBudgetCalculable: true,
          calculationStrategy: true,
          productType: true,
          stock: true,
          updatedAt: true,
          images: {
            select: {
              id: true,
              img: true,
              name: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }) as Promise<BaseProductRecord[]>,
      this.getActiveStandardSizes(),
    ])

    const sizes = standardSizeBundle.sizes
    const standardSizesVersion = standardSizeBundle.version

    if (!baseProducts.length || !sizes.length) {
      return []
    }

    const derivedByBase = await Promise.all(
      baseProducts.map(async (product) => {
        const priceVersion = this.buildPriceVersion(product)
        const cacheKey = `derived_products:${product.id}:${priceVersion}:${standardSizesVersion}`
        const cached = await this.cache.get<DerivedProductDto[]>(cacheKey, {
          updatedAt: product.updatedAt,
        })
        if (cached) {
          return cached
        }

        const value = await this.buildDerivedProductsForBaseProduct(product, sizes)
        return this.cache.set(cacheKey, value, {
          baseProductId: product.id,
          priceVersion,
          updatedAt: product.updatedAt,
        })
      }),
    )

    return derivedByBase.flat()
  }

  async resolveM2DerivedProductByIdentifier(identifier: string): Promise<DerivedProductDto | null> {
    if (this.clientConfig?.slug !== 'urucortinas') {
      return null
    }

    const normalized = identifier.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    const derivedProducts = await this.listM2DerivedProducts()
    return (
      derivedProducts.find(
        (product) =>
          product.slug.toLowerCase() === normalized || product.id.toLowerCase() === normalized,
      ) ?? null
    )
  }

  async invalidateBaseProduct(baseProductId: number) {
    await this.cache.invalidateBaseProduct(baseProductId)
  }
}
