import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { StorefrontService } from './storefront.service'
import { StorefrontProductQueryDto } from './dto/product-query.dto'
import {
  StorefrontRegisterDto,
  StorefrontLoginDto,
  StorefrontRefreshDto,
  StorefrontUpdateProfileDto,
} from './dto/auth.dto'
import { StorefrontCreateOrderDto } from './dto/order.dto'
import { StorefrontAddressDto } from './dto/address.dto'
import { StorefrontAddWishlistItemDto } from './dto/wishlist.dto'
import type { FastifyRequest } from 'fastify'
import { StorefrontJwtGuard } from './storefront-jwt.guard'
import type { StorefrontJwtPayload } from './storefront-jwt.strategy'
import type { StorefrontCategoryTree } from './types'
import { MercadoPagoChargeDto, MercadoPagoWebhookDto } from './dto/mercadopago-charge.dto'
import { MercadoPagoService } from './payments/mercadopago.service'
import { decimalToNumber } from '../common/currency/money.util'
import { Throttle } from '@nestjs/throttler'

@Controller('storefront')
export class StorefrontController {
  private readonly logger = new Logger(StorefrontController.name)

  constructor(
    private readonly storefront: StorefrontService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  @Get('config')
  getConfig() {
    return this.storefront.getConfig()
  }

  @Get('currencies')
  getCurrencySettings() {
    return this.storefront.getCurrencySettings()
  }

  @Get('home-layouts/:key')
  getHomeLayout(@Param('key') key: string) {
    return this.storefront.getHomeLayout(key)
  }

  @Get('categories')
  listCategories(): Promise<StorefrontCategoryTree[]> {
    return this.storefront.listCategories()
  }

  @Get('products')
  listProducts(@Query() query: StorefrontProductQueryDto) {
    return this.storefront.listProducts(query)
  }

  @Get('products/:identifier')
  getProduct(@Param('identifier') identifier: string) {
    return this.storefront.getProduct(identifier)
  }

  @Get('products/:id/recommendations')
  getRecommendations(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined
    return this.storefront.getRecommendations(id, Number.isNaN(parsedLimit) ? 8 : parsedLimit)
  }

  @Post('auth/register')
  register(@Body() dto: StorefrontRegisterDto) {
    return this.storefront.registerCustomer(dto)
  }

  @Post('auth/login')
  login(@Body() dto: StorefrontLoginDto) {
    return this.storefront.login(dto)
  }

  @Post('auth/refresh')
  refresh(@Body() dto: StorefrontRefreshDto) {
    return this.storefront.refreshSession(dto)
  }

  @Post('orders')
  createOrder(@Body() dto: StorefrontCreateOrderDto) {
    return this.storefront.createOrder(dto)
  }

  @Post('payments/mercadopago/charge')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async createMercadoPagoCharge(
    @Body() dto: MercadoPagoChargeDto,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    const record = await this.mercadoPago.createCardPayment(dto, {
      idempotencyKey: idempotencyKey ?? null,
      cartId: dto.cartId ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      ipAddress: (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? null,
    })

    return {
      status: record.status,
      statusDetail: record.statusDetail,
      paymentId: record.externalPaymentId,
      paymentIntentId: record.id,
      cartId: record.cartId,
      orderId: record.orderId,
      amount: decimalToNumber(record.amount),
      currency: record.currency,
      installments: record.installments,
      cardBrand: record.cardBrand,
      cardLastFour: record.cardLastFour,
      createdAt: record.createdAt,
    }
  }

  @Post('payments/mercadopago/webhook')
  @HttpCode(200)
  async handleMercadoPagoWebhook(@Body() payload: MercadoPagoWebhookDto) {
    if (!this.mercadoPago.isEnabled()) {
      return { received: true, ignored: true }
    }

    const type = payload.type?.toLowerCase()
    const paymentId = payload.data?.id

    if (type !== 'payment' || !paymentId) {
      return { received: true }
    }

    try {
      await this.mercadoPago.syncPaymentIntentByExternalId(paymentId)
      return { received: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to handle Mercado Pago webhook for ${paymentId}: ${message}`)
      return { received: false }
    }
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/profile')
  getAccountProfile(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.getCustomerProfile(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Patch('account/profile')
  updateAccountProfile(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontUpdateProfileDto,
  ) {
    const user = req.user
    return this.storefront.updateCustomerProfile(user.sub, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/orders')
  listAccountOrders(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.listCustomerOrders(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/orders/:identifier')
  getAccountOrder(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('identifier') identifier: string,
  ) {
    const user = req.user
    return this.storefront.getCustomerOrder(user.sub, identifier)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/addresses')
  listAccountAddresses(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.listCustomerAddresses(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('account/addresses')
  createAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontAddressDto,
  ) {
    const user = req.user
    return this.storefront.createCustomerAddress(user.sub, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Put('account/addresses/:id')
  updateAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StorefrontAddressDto,
  ) {
    const user = req.user
    return this.storefront.updateCustomerAddress(user.sub, id, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Delete('account/addresses/:id')
  deleteAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user
    return this.storefront.deleteCustomerAddress(user.sub, id)
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('account/addresses/:id/set-primary')
  setPrimaryAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user
    return this.storefront.setPrimaryCustomerAddress(user.sub, id)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/wishlist')
  getAccountWishlist(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.getCustomerWishlist(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('account/wishlist')
  addAccountWishlistItem(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontAddWishlistItemDto,
  ) {
    const user = req.user
    return this.storefront.addProductToWishlist(user.sub, dto.productId)
  }

  @UseGuards(StorefrontJwtGuard)
  @Delete('account/wishlist/:productId')
  removeAccountWishlistItem(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const user = req.user
    return this.storefront.removeProductFromWishlist(user.sub, productId)
  }
}
