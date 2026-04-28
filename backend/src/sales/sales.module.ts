import { Module } from '@nestjs/common'
import { SalesController } from './sales.controller'
import { PricingModule } from '../pricing/pricing.module'
import { StorefrontModule } from '../storefront/storefront.module'

@Module({
  imports: [PricingModule, StorefrontModule],
  controllers: [SalesController],
})
export class SalesModule {}
