import { Module } from '@nestjs/common'
import { ParametricPricingService } from './parametric-pricing.service'
import { PricingController } from './pricing.controller'
import { ParametricFeatureGuard } from './pricing.guard'

@Module({
  controllers: [PricingController],
  providers: [ParametricPricingService, ParametricFeatureGuard],
  exports: [ParametricPricingService],
})
export class PricingModule {}
