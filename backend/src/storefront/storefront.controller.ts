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
  Res,
  UseGuards,
  BadRequestException,
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
import type { FastifyRequest, FastifyReply } from 'fastify'
import { StorefrontJwtGuard } from './storefront-jwt.guard'
import type { StorefrontJwtPayload } from './storefront-jwt.strategy'
import type { StorefrontCategoryTree } from './types'
import { MercadoPagoChargeDto, MercadoPagoWebhookDto } from './dto/mercadopago-charge.dto'
import { MercadoPagoPreferenceDto } from './dto/mercadopago-preference.dto'
import { MercadoPagoService } from './payments/mercadopago.service'
import { decimalToNumber } from '../common/currency/money.util'
import { Throttle } from '@nestjs/throttler'
import { StorefrontGoogleOAuthService } from './oauth/google-oauth.service'
import { StorefrontSessionCookieService } from './storefront-session-cookie.service'
import { StorefrontGoogleStartDto } from './dto/google-auth.dto'
import {
  StorefrontPasswordForgotDto,
  StorefrontPasswordVerifyOtpDto,
  StorefrontPasswordResetDto,
  StorefrontPasswordChangeDto,
  StorefrontReauthPasswordDto,
} from './dto/password.dto'
import { StorefrontSecurityService } from './security/storefront-security.service'

@Controller('storefront')
export class StorefrontController {
  private readonly logger = new Logger(StorefrontController.name)

  constructor(
    private readonly storefront: StorefrontService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly googleAuth: StorefrontGoogleOAuthService,
    private readonly sessionCookies: StorefrontSessionCookieService,
    private readonly security: StorefrontSecurityService,
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

  @Get('products/:id/parametric-config')
  getParametricConfig(@Param('id', ParseIntPipe) id: number) {
    return this.storefront.getParametricProductConfig(id)
  }

  @Post('products/:id/parametric-quote')
  quoteParametric(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      familyId?: string
      serie: string
      material: string
      color: string
      vidrio: string
      widthMm: number
      heightMm: number
      hasMosquitero: boolean
      hasShutterMonoblock: boolean
      shutterMaterial?: string
    },
  ) {
    return this.storefront.quoteParametricProduct({
      productId: id,
      ...body,
    })
  }

  @Post('auth/register')
  async register(
    @Body() dto: StorefrontRegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.storefront.registerCustomer(dto)
    this.sessionCookies.setSessionCookies(reply, session)
    return session
  }

  @Post('auth/login')
  async login(
    @Body() dto: StorefrontLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.storefront.login(dto)
    this.sessionCookies.setSessionCookies(reply, session)
    return session
  }

  @Post('auth/refresh')
  async refresh(
    @Body() dto: StorefrontRefreshDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.storefront.refreshSession(dto)
    this.sessionCookies.setSessionCookies(reply, session)
    return session
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    this.sessionCookies.clearSessionCookies(reply)
    return { ok: true }
  }

  @Post('auth/password/forgot')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordRecovery(@Body() dto: StorefrontPasswordForgotDto, @Req() req: FastifyRequest) {
    if (dto.channel === 'phone') {
      await this.security.requestPhoneRecovery(dto.phone ?? '', req)
    } else {
      await this.security.requestEmailRecovery(dto.email ?? '', req)
    }
    return { ok: true }
  }

  @Post('auth/password/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyPasswordOtp(@Body() dto: StorefrontPasswordVerifyOtpDto, @Req() req: FastifyRequest) {
    const result = await this.security.verifyPhoneOtp(dto.phone, dto.otp, req)
    return { ok: true, resetSessionToken: result.token, expiresAt: result.expiresAt.toISOString() }
  }

  @Post('auth/password/reset')
  async resetPassword(@Body() dto: StorefrontPasswordResetDto, @Req() req: FastifyRequest) {
    if (dto.channel === 'phone') {
      await this.security.resetPasswordWithSessionToken(dto.resetSessionToken ?? '', dto.newPassword, req)
    } else {
      await this.security.resetPasswordWithEmailToken(dto.token ?? '', dto.newPassword, req)
    }
    return { ok: true }
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('auth/security/reauth/password')
  async reauthenticatePassword(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontReauthPasswordDto,
  ) {
    const token = await this.security.reauthenticateWithPassword(req.user.sub, dto.currentPassword, req)
    return { token: token.token, expiresAt: token.expiresAt.toISOString() }
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('auth/password/change')
  async changePassword(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontPasswordChangeDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const customer = await this.security.changePassword(
      req.user.sub,
      dto.newPassword,
      { reauthToken: dto.reauthToken, keepSession: dto.keepSession ?? false },
      req,
    )
    const session = await this.storefront.createSessionForCustomer(customer)
    this.sessionCookies.setSessionCookies(reply, session)
    return session
  }

  @Post('auth/google/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startGoogle(
    @Body() dto: StorefrontGoogleStartDto,
    @Req() req: FastifyRequest,
  ) {
    const purpose = dto.purpose ?? 'login'
    return this.googleAuth.start(dto.returnPath, req, purpose)
  }

  @Post('auth/google/recover/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startGoogleRecovery(
    @Body() dto: StorefrontGoogleStartDto,
    @Req() req: FastifyRequest,
  ) {
    return this.googleAuth.start(dto.returnPath, req, 'recover')
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('auth/google/reauth/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startGoogleReauth(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontGoogleStartDto,
  ) {
    return this.googleAuth.start(dto.returnPath, req, 'reauth', req.user.sub)
  }

  @Get('auth/google/callback')
  async completeGoogle(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.googleAuth.complete({
      state,
      code,
      error,
      error_description: errorDescription,
    })

    const redirectUrl = await this.googleAuth.buildCompletionRedirect(result)

    if (result.status === 'success') {
      if (result.session) {
        this.sessionCookies.setSessionCookies(reply, result.session)
      }
    } else {
      this.sessionCookies.clearSessionCookies(reply)
    }

    if (redirectUrl) {
      reply.status(302).redirect(redirectUrl)
      return
    }

    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.status(200).send(await this.googleAuth.renderCallbackPage(result))
  }

  @Get('auth/session')
  async getAuthSession(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.storefront.getSessionFromRequest(req)
    if (result.refreshed) {
      this.sessionCookies.setSessionCookies(reply, result.session)
    }
    return result.session
  }

  @Post('orders')
  createOrder(@Body() dto: StorefrontCreateOrderDto) {
    return this.storefront.createOrder(dto)
  }

  @Post('payments/mercadopago/preference')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createMercadoPagoPreference(@Body() dto: MercadoPagoPreferenceDto, @Req() req: FastifyRequest) {
    this.logger.log(
      `Mercado Pago preference request | amount=${String(dto.amount)} currency=${String(dto.currency)} body=${JSON.stringify(dto)}`,
    )
    if (dto.amount === undefined || dto.amount === null) {
      this.logger.warn(`Mercado Pago preference request missing amount | body=${JSON.stringify(dto)}`)
      throw new BadRequestException({ message: 'amount es obligatorio', mp: dto })
    }
    const backUrls = this.buildBackUrls(dto, req)
    return this.mercadoPago.createPreference({
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      cartId: dto.cartId,
      orderId: dto.orderId,
      statementDescriptor: dto.statementDescriptor,
      payerEmail: dto.payerEmail,
      backUrls,
    })
  }

  @Post('payments/mercadopago/charge')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
      cardholderName: record.cardholderName,
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
  @Get('account/orders/:identifier/timeline')
  getAccountOrderTimeline(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('identifier') identifier: string,
  ) {
    const user = req.user
    return this.storefront.getCustomerOrderTimeline(user.sub, identifier)
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

  private resolveAbsoluteUrl(candidate: string | undefined, req: FastifyRequest): string | null {
    if (!candidate) {
      return null
    }
    const trimmed = candidate.trim()
    if (!trimmed) {
      return null
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (trimmed.startsWith('/')) {
      const protocolHeader = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
      const protocol = protocolHeader || req.protocol || 'https'
      const host =
        (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
        (req.headers.host as string | undefined)
      if (!host) {
        return null
      }
      return `${protocol}://${host}${trimmed}`
    }
    return null
  }

  private buildBackUrls(dto: MercadoPagoPreferenceDto, req: FastifyRequest) {
    const success = this.resolveAbsoluteUrl(dto.successUrl, req)
    const failure = this.resolveAbsoluteUrl(dto.failureUrl, req)
    const pending = this.resolveAbsoluteUrl(dto.pendingUrl, req)

    if (!success && !failure && !pending) {
      return undefined
    }

    return {
      success: success ?? undefined,
      failure: failure ?? undefined,
      pending: pending ?? undefined,
    }
  }
}
