import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { StorefrontService } from './storefront.service'
import { StorefrontProductQueryDto } from './dto/product-query.dto'
import {
  StorefrontRegisterDto,
  StorefrontLoginDto,
  StorefrontRefreshDto,
  StorefrontUpdateProfileDto,
} from './dto/auth.dto'
import { StorefrontCreateOrderDto } from './dto/order.dto'
import { StorefrontAddressDto } from './dto/address.dto'
import type { FastifyRequest } from 'fastify'
import { StorefrontJwtGuard } from './storefront-jwt.guard'
import type { StorefrontJwtPayload } from './storefront-jwt.strategy'
import type { StorefrontCategoryTree } from './types'

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
  listCategories(): Promise<StorefrontCategoryTree[]> {
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

  @UseGuards(StorefrontJwtGuard)
  @Get('account/profile')
  getAccountProfile(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.getCustomerProfile(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Patch('account/profile')
  updateAccountProfile(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontUpdateProfileDto,
  ) {
    const user = req.user
    return this.storefront.updateCustomerProfile(user.sub, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/orders')
  listAccountOrders(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.listCustomerOrders(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/orders/:identifier')
  getAccountOrder(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('identifier') identifier: string,
  ) {
    const user = req.user
    return this.storefront.getCustomerOrder(user.sub, identifier)
  }

  @UseGuards(StorefrontJwtGuard)
  @Get('account/addresses')
  listAccountAddresses(@Req() req: FastifyRequest & { user: StorefrontJwtPayload }) {
    const user = req.user
    return this.storefront.listCustomerAddresses(user.sub)
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('account/addresses')
  createAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Body() dto: StorefrontAddressDto,
  ) {
    const user = req.user
    return this.storefront.createCustomerAddress(user.sub, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Put('account/addresses/:id')
  updateAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StorefrontAddressDto,
  ) {
    const user = req.user
    return this.storefront.updateCustomerAddress(user.sub, id, dto)
  }

  @UseGuards(StorefrontJwtGuard)
  @Delete('account/addresses/:id')
  deleteAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user
    return this.storefront.deleteCustomerAddress(user.sub, id)
  }

  @UseGuards(StorefrontJwtGuard)
  @Post('account/addresses/:id/set-primary')
  setPrimaryAccountAddress(
    @Req() req: FastifyRequest & { user: StorefrontJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user
    return this.storefront.setPrimaryCustomerAddress(user.sub, id)
  }
}
