import { Module } from '@nestjs/common'
import { SalesController } from './sales.controller'
import { PricingModule } from '../pricing/pricing.module'

@Module({
  imports: [PricingModule],
  controllers: [SalesController],
})
export class SalesModule {}
