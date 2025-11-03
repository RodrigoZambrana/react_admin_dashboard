import { Module } from '@nestjs/common'
import { StorefrontController } from './storefront.controller'
import { StorefrontService } from './storefront.service'
import { StorefrontJwtStrategy } from './storefront-jwt.strategy'
import { CurrencyModule } from '../common/currency/currency.module'
import { PrismaService } from '../prisma/prisma.service'
import { MercadoPagoService } from './payments/mercadopago.service'
import { StorefrontGoogleOAuthService } from './oauth/google-oauth.service'
import { StorefrontSessionCookieService } from './storefront-session-cookie.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { PricingModule } from '../pricing/pricing.module'
import { EmailModule } from '../email/email.module'
import { StorefrontSecurityService } from './security/storefront-security.service'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [CurrencyModule, NotificationsModule, PricingModule, EmailModule, OrdersModule],
  controllers: [StorefrontController],
  providers: [
    StorefrontService,
    StorefrontJwtStrategy,
    PrismaService,
    MercadoPagoService,
    StorefrontGoogleOAuthService,
    StorefrontSessionCookieService,
    StorefrontSecurityService,
  ],
  exports: [MercadoPagoService],
})
export class StorefrontModule {}
