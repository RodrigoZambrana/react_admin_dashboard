import { Controller, Get } from '@nestjs/common'
import { M2DerivedProductsService } from './m2-derived-products.service'

@Controller('storefront/m2-derived')
export class M2DerivedController {
  constructor(private readonly m2DerivedProducts: M2DerivedProductsService) {}

  @Get()
  listM2DerivedProducts() {
    return this.m2DerivedProducts.listM2DerivedProducts()
  }

  @Get('sizes')
  listM2DerivedProductSizes() {
    return this.m2DerivedProducts.listStandardSizes()
  }
}
