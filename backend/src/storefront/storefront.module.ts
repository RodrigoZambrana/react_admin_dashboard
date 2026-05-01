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
import { StorefrontPublishedProductResolverService } from './storefront-published-product-resolver.service'
import { CmsModule } from '../cms/cms.module'
import { GrowthModule } from '../growth/growth.module'
import { BudgetModule } from '../budget/budget.module'
import { M2DerivedProductCacheService } from './m2-derived-product.cache'
import { M2DerivedProductsService } from './m2-derived-products.service'
import { M2DerivedProductStockService } from './m2-derived-product-stock.service'
import { M2DerivedController } from './m2-derived.controller'
import { PublicResponseCacheService } from '../common/cache/public-response-cache.service'
import { NextRevalidationService } from '../common/cache/next-revalidation.service'

@Module({
  imports: [
    CurrencyModule,
    NotificationsModule,
    PricingModule,
    EmailModule,
    OrdersModule,
    CmsModule,
    GrowthModule,
    BudgetModule,
  ],
  controllers: [StorefrontController, M2DerivedController],
  providers: [
    StorefrontService,
    StorefrontJwtStrategy,
    PrismaService,
    MercadoPagoService,
    StorefrontGoogleOAuthService,
    StorefrontSessionCookieService,
    StorefrontSecurityService,
    StorefrontPublishedProductResolverService,
    M2DerivedProductCacheService,
    M2DerivedProductStockService,
    M2DerivedProductsService,
    PublicResponseCacheService,
    NextRevalidationService,
  ],
  exports: [
    StorefrontService,
    MercadoPagoService,
    M2DerivedProductsService,
    PublicResponseCacheService,
    NextRevalidationService,
  ],
})
export class StorefrontModule {}
