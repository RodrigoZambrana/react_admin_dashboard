import { Module } from '@nestjs/common'
import { StorefrontController } from './storefront.controller'
import { StorefrontService } from './storefront.service'
import { StorefrontJwtStrategy } from './storefront-jwt.strategy'
import { CurrencyModule } from '../common/currency/currency.module'
import { PrismaService } from '../prisma/prisma.service'
import { MercadoPagoService } from './payments/mercadopago.service'
import { StorefrontGoogleOAuthService } from './oauth/google-oauth.service'
import { StorefrontSessionCookieService } from './storefront-session-cookie.service'

@Module({
  imports: [CurrencyModule],
  controllers: [StorefrontController],
  providers: [
    StorefrontService,
    StorefrontJwtStrategy,
    PrismaService,
    MercadoPagoService,
    StorefrontGoogleOAuthService,
    StorefrontSessionCookieService,
  ],
})
export class StorefrontModule {}
