import { Module } from '@nestjs/common'
import { ParametricPricingService } from './parametric-pricing.service'
import { PricingController } from './pricing.controller'
import { ParametricFeatureGuard } from './pricing.guard'
import { AberturasGlossaryModule } from '../aberturas/aberturas-glossary.module'

@Module({
  imports: [AberturasGlossaryModule],
  controllers: [PricingController],
  providers: [ParametricPricingService, ParametricFeatureGuard],
  exports: [ParametricPricingService],
})
export class PricingModule {}
