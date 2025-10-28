import { Module } from '@nestjs/common'
import { StorefrontController } from './storefront.controller'
import { StorefrontService } from './storefront.service'
import { StorefrontJwtStrategy } from './storefront-jwt.strategy'
import { CurrencyModule } from '../common/currency/currency.module'
import { PrismaService } from '../prisma/prisma.service'
import { EmailModule } from '../email/email.module'
import { MercadoPagoService } from './payments/mercadopago.service'

@Module({
  imports: [CurrencyModule, EmailModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, StorefrontJwtStrategy, PrismaService, MercadoPagoService],
})
export class StorefrontModule {}
