import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { StorefrontService } from './storefront.service'
import { StorefrontProductQueryDto } from './dto/product-query.dto'
import { StorefrontRegisterDto, StorefrontLoginDto, StorefrontRefreshDto } from './dto/auth.dto'
import { StorefrontCreateOrderDto } from './dto/order.dto'

@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get('config')
  getConfig() {
    return this.storefront.getConfig()
  }

  @Get('home-layouts/:key')
  getHomeLayout(@Param('key') key: string) {
    return this.storefront.getHomeLayout(key)
  }

  @Get('categories')
  listCategories() {
    return this.storefront.listCategories()
  }

  @Get('products')
  listProducts(@Query() query: StorefrontProductQueryDto) {
    return this.storefront.listProducts(query)
  }

  @Get('products/:identifier')
  getProduct(@Param('identifier') identifier: string) {
    return this.storefront.getProduct(identifier)
  }

  @Get('products/:id/recommendations')
  getRecommendations(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined
    return this.storefront.getRecommendations(id, Number.isNaN(parsedLimit) ? 8 : parsedLimit)
  }

  @Post('auth/register')
  register(@Body() dto: StorefrontRegisterDto) {
    return this.storefront.registerCustomer(dto)
  }

  @Post('auth/login')
  login(@Body() dto: StorefrontLoginDto) {
    return this.storefront.login(dto)
  }

  @Post('auth/refresh')
  refresh(@Body() dto: StorefrontRefreshDto) {
    return this.storefront.refreshSession(dto)
  }

  @Post('orders')
  createOrder(@Body() dto: StorefrontCreateOrderDto) {
    return this.storefront.createOrder(dto)
  }
}
