import { Module } from '@nestjs/common'
import { StorefrontController } from './storefront.controller'
import { StorefrontService } from './storefront.service'
import { StorefrontJwtStrategy } from './storefront-jwt.strategy'

@Module({
  controllers: [StorefrontController],
  providers: [StorefrontService, StorefrontJwtStrategy],
})
export class StorefrontModule {}
