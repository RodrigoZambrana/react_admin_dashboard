import { BadRequestException, Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ProductType, SalesUnit, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CLIENT_CONFIG_TOKEN } from '../config/client-config.constants'
import type { ClientVariantConfig } from '../config/client-config.types'
import { roundDecimal, decimal } from '../common/currency/money.util'
import { buildProductSlug } from '../storefront/utils'
import { GoogleConfigService } from '../common/integrations/google-config.service'
import { buildPhoneLookupCandidates, normalizePhoneNumber } from '../common/utils/phone'
import { CalculationStrategy } from './strategies/calculation-strategy'
import { M2CalculationStrategy } from './strategies/m2-calculation.strategy'
import type {
  BudgetAddToCartDto,
  BudgetAddToCartResult,
  BudgetCalculateDto,
  BudgetCalculationResult,
  BudgetLeadDto,
  BudgetLeadResult,
  BudgetProductResult,
  BudgetSummaryDto,
  BudgetSummaryResult,
} from './budget.types'

type BudgetProductRecord = Prisma.ProductGetPayload<{
  select: {
    id: true
    name: true
    productCode: true
    img: true
    description: true
    salePrice: true
    currency: true
    unitOfMeasure: true
    published: true
    isBudgetCalculable: true
    calculationStrategy: true
    productType: true
  }
}>

@Injectable()
export class BudgetCalculatorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
    private readonly googleConfig: GoogleConfigService,
    private readonly defaultStrategy: M2CalculationStrategy,
  ) {}

  private get strategies(): CalculationStrategy[] {
    return [this.defaultStrategy]
  }

  private assertTenant() {
    if (this.clientConfig?.slug !== 'urucortinas') {
      throw new NotFoundException()
    }
  }

  private normalizeEmail(value?: string | null): string | null {
    const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return trimmed.length ? trimmed : null
  }

  private normalizeLeadName(value?: string | null): string {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (!trimmed) {
      throw new BadRequestException('El nombre es obligatorio.')
    }
    return trimmed
  }

  private normalizeLeadPhone(value?: string | null): string | null {
    const normalized = normalizePhoneNumber(value)
    return normalized && normalized.length >= 6 ? normalized : null
  }

  private roundMoney(value: Prisma.Decimal.Value): number {
    return Number(roundDecimal(decimal(value), 2).toString())
  }

  private async verifyRecaptcha(token?: string | null) {
    const config = await this.googleConfig.getEffectiveConfig()
    const isEnabled = config.recaptcha.storefront.enabled && Boolean(config.recaptcha.storefront.siteKey) && Boolean(config.recaptcha.secretKey)
    if (!isEnabled) {
      return
    }

    if (!token) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    const secretKey = config.recaptcha.secretKey
    if (!secretKey) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    const form = new URLSearchParams({
      secret: secretKey,
      response: token,
    })

    let response: Response
    try {
      response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body: form,
      })
    } catch {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    const payload = (await response.json()) as { success?: boolean }
    if (!payload.success) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }
  }

  private toNumber(value: number | string | Prisma.Decimal | null | undefined): number {
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
    return Number(value.toString())
  }

  private normalizeStrategyKey(value?: string | null): string {
    return String(value ?? 'M2').trim().toUpperCase() || 'M2'
  }

  private resolveStrategy(strategyKey?: string | null): CalculationStrategy {
    const normalized = this.normalizeStrategyKey(strategyKey)
    const strategy = this.strategies.find((candidate) => candidate.supports(normalized))
    if (!strategy) {
      throw new BadRequestException(`Unsupported calculation strategy "${normalized}"`)
    }
    return strategy
  }

  private ensureBudgetEligible(product: BudgetProductRecord) {
    const measurementType = product.unitOfMeasure === SalesUnit.SQUARE_METER ? 'M2' : 'OTHER'
    const isPublic = Boolean(product.published)
    const isBudgetCalculable = Boolean(product.isBudgetCalculable)

    if (product.productType !== ProductType.PHYSICAL) {
      throw new NotFoundException('Budget product not found')
    }

    if (measurementType !== 'M2' || !isPublic || !isBudgetCalculable) {
      throw new NotFoundException('Budget product not found')
    }
  }

  private async ensureBudgetLeadStatusId(): Promise<number> {
    const existing = await this.prisma.customerStatus.findFirst({
      where: {
        name: { in: ['Lead presupuesto', 'Presupuesto'] },
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    })

    if (existing) {
      return existing.id
    }

    const created = await this.prisma.customerStatus.create({
      data: {
        name: 'Lead presupuesto',
        color: '#2563EB',
      },
      select: { id: true },
    })

    return created.id
  }

  private toProductResult(product: BudgetProductRecord): BudgetProductResult {
    return {
      id: product.id,
      slug: buildProductSlug(product.id, product.name, product.productCode ?? undefined),
      name: product.name,
      productCode: product.productCode ?? null,
      img: product.img ?? null,
      description: product.description ?? null,
      currency: product.currency,
      unitPrice: this.roundMoney(product.salePrice),
      measurementType: 'M2',
      isPublic: Boolean(product.published),
      isBudgetCalculable: Boolean(product.isBudgetCalculable),
      calculationStrategy: this.normalizeStrategyKey(product.calculationStrategy),
    }
  }

  async listProducts(): Promise<BudgetProductResult[]> {
    this.assertTenant()

    const products = await this.prisma.product.findMany({
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
        img: true,
        description: true,
        salePrice: true,
        currency: true,
        unitOfMeasure: true,
        published: true,
        isBudgetCalculable: true,
        calculationStrategy: true,
        productType: true,
      },
    })

    return products.map((product) => this.toProductResult(product))
  }

  private async resolveBudgetProduct(productId: number): Promise<BudgetProductRecord> {
    this.assertTenant()

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        productCode: true,
        img: true,
        description: true,
        salePrice: true,
        currency: true,
        unitOfMeasure: true,
        published: true,
        isBudgetCalculable: true,
        calculationStrategy: true,
        productType: true,
      },
    })

    if (!product) {
      throw new NotFoundException('Budget product not found')
    }

    this.ensureBudgetEligible(product)
    return product
  }

  async calculateForProduct(
    product: BudgetProductRecord,
    width: number,
    height: number,
  ): Promise<BudgetCalculationResult> {
    this.ensureBudgetEligible(product)
    const strategy = this.resolveStrategy(product.calculationStrategy)
    return strategy.calculate({
      productId: product.id,
      width,
      height,
      unitPrice: this.roundMoney(product.salePrice),
    }) as BudgetCalculationResult
  }

  async calculate(dto: BudgetCalculateDto): Promise<BudgetCalculationResult & { product: BudgetProductResult }> {
    const product = await this.resolveBudgetProduct(dto.productId)
    const result = await this.calculateForProduct(product, dto.width, dto.height)
    return {
      ...result,
      currency: product.currency,
      product: this.toProductResult(product),
    }
  }

  async addToCart(dto: BudgetAddToCartDto): Promise<BudgetAddToCartResult> {
    await this.verifyRecaptcha(dto.recaptchaToken)
    if (!dto.items.length) {
      throw new BadRequestException('At least one budget item is required')
    }

    const products = await Promise.all(
      dto.items.map(async (item) => this.resolveBudgetProduct(item.productId)),
    )
    const resolved = await Promise.all(
      dto.items.map(async (item) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        if (!product) {
          throw new NotFoundException('Budget product not found')
        }
        const calculated = await this.calculateForProduct(product, item.width, item.height)
        const qty = Math.max(1, Math.trunc(this.toNumber(item.qty ?? 1)))
        return {
          ...calculated,
          currency: product.currency,
          qty,
          product: this.toProductResult(product),
        }
      }),
    )

    const currencies = new Set(resolved.map((item) => item.product.currency))
    if (currencies.size > 1) {
      throw new BadRequestException('Budget items must share the same currency')
    }

    const subtotal = resolved.reduce((sum, item) => sum + item.totalPrice * item.qty, 0)
    return {
      currency: resolved[0]?.product.currency ?? 'UYU',
      subtotal: Number(roundDecimal(decimal(subtotal), 2).toString()),
      items: resolved,
    }
  }

  async summarize(dto: BudgetSummaryDto): Promise<BudgetSummaryResult> {
    if (!dto.items.length) {
      throw new BadRequestException('At least one budget item is required')
    }

    const shippingFee = this.roundMoney(dto.shippingFee ?? 0)
    const products = await Promise.all(
      dto.items.map(async (item) => this.resolveBudgetProduct(item.productId)),
    )
    const resolved = await Promise.all(
      dto.items.map(async (item) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        if (!product) {
          throw new NotFoundException('Budget product not found')
        }
        const calculated = await this.calculateForProduct(product, item.width, item.height)
        const qty = Math.max(1, Math.trunc(this.toNumber(item.qty ?? 1)))
        const lineTotal = Number(roundDecimal(decimal(calculated.totalPrice).times(qty), 2).toString())
        return {
          ...calculated,
          currency: product.currency,
          qty,
          lineTotal,
          product: this.toProductResult(product),
        }
      }),
    )

    const currencies = new Set(resolved.map((item) => item.product.currency))
    if (currencies.size > 1) {
      throw new BadRequestException('Budget items must share the same currency')
    }

    const subtotal = Number(
      roundDecimal(
        decimal(resolved.reduce((sum, item) => sum + item.lineTotal, 0)),
        2,
      ).toString(),
    )
    const grandTotal = Number(roundDecimal(decimal(subtotal).plus(shippingFee), 2).toString())

    return {
      currency: resolved[0]?.product.currency ?? 'UYU',
      subtotal,
      shippingFee,
      grandTotal,
      items: resolved,
      customer: {
        name: typeof dto.customerName === 'string' && dto.customerName.trim().length ? dto.customerName.trim() : null,
        email: typeof dto.customerEmail === 'string' && dto.customerEmail.trim().length ? dto.customerEmail.trim() : null,
        phone: typeof dto.customerPhone === 'string' && dto.customerPhone.trim().length ? dto.customerPhone.trim() : null,
        notes: typeof dto.customerNotes === 'string' && dto.customerNotes.trim().length ? dto.customerNotes.trim() : null,
      },
    }
  }

  async saveLead(dto: BudgetLeadDto): Promise<BudgetLeadResult> {
    this.assertTenant()
    await this.verifyRecaptcha(dto.recaptchaToken)

    const name = this.normalizeLeadName(dto.name)
    const email = this.normalizeEmail(dto.email)
    const phone = this.normalizeLeadPhone(dto.phone)

    if (!email && !phone) {
      throw new BadRequestException('Necesitamos al menos un medio de contacto.')
    }

    const [existingByEmail, existingByPhone] = await Promise.all([
      email ? this.prisma.customer.findUnique({ where: { email } }) : Promise.resolve(null),
      phone
        ? this.prisma.customer.findFirst({
            where: {
              phoneNumber: {
                in: buildPhoneLookupCandidates(phone),
              },
            },
          })
        : Promise.resolve(null),
    ])

    if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
      throw new BadRequestException('El correo y el WhatsApp indicados pertenecen a contactos distintos.')
    }

    const existing = existingByEmail ?? existingByPhone
    const budgetLeadStatusId = await this.ensureBudgetLeadStatusId()
    const assignedLeadStatus = !existing?.statusId

    const customer = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email && !existing.email ? { email, emailVerifiedAt: null } : {}),
            ...(phone && !existing.phoneNumber ? { phoneNumber: phone } : {}),
            ...(assignedLeadStatus ? { statusId: budgetLeadStatusId } : {}),
          },
        })
      : await this.prisma.customer.create({
          data: {
            name,
            email,
            phoneNumber: phone ?? undefined,
            preferredLocale: 'es',
            preferredCurrency: 'UYU',
            statusId: budgetLeadStatusId,
          },
        })

    return {
      customerId: customer.id,
      name: customer.name,
      email: customer.email ?? null,
      phone: customer.phoneNumber ?? null,
      status: assignedLeadStatus ? 'Lead presupuesto' : null,
    }
  }
}
