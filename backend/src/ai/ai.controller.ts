import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AiService } from './ai.service'
import { CreateAiAppointmentDto } from './dto/create-ai-appointment.dto'
import { CreateAiCustomerDto } from './dto/create-ai-customer.dto'
import { CreateAiOrderDto, GenerateAiQuoteDto } from './dto/create-ai-order.dto'
import { CreateAiPaymentDto } from './dto/create-ai-payment.dto'
import { CreateAiProductDto } from './dto/create-ai-product.dto'
import { ListAiProductsDto } from './dto/list-ai-products.dto'
import { UpdateAiRuntimeConfigDto } from './dto/update-ai-runtime-config.dto'

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('runtime-config')
  getRuntimeConfig() {
    return this.ai.getRuntimeConfigSummary()
  }

  @UseGuards(JwtAuthGuard)
  @Put('runtime-config')
  updateRuntimeConfig(@Body() body: UpdateAiRuntimeConfigDto) {
    return this.ai.updateRuntimeConfig(body)
  }

  @Get('runtime-config/internal')
  getRuntimeConfigInternal(@Headers('x-ai-internal-token') token?: string) {
    this.assertInternalToken(token)
    return this.ai.getRuntimeConfigInternal()
  }

  @Get('actions')
  listActions(@Headers('x-ai-internal-token') token?: string) {
    this.assertInternalToken(token)
    return this.ai.listActions()
  }

  @Get('products')
  listProducts(
    @Query() query: ListAiProductsDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.listProducts(query)
  }

  @Post('customers')
  createCustomer(
    @Body() body: CreateAiCustomerDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.createCustomer(body)
  }

  @Post('appointments')
  createAppointment(
    @Body() body: CreateAiAppointmentDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.createAppointment(body)
  }

  @Post('products')
  createProduct(
    @Body() body: CreateAiProductDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.createProduct(body)
  }

  @Post('orders')
  createOrder(
    @Body() body: CreateAiOrderDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.createOrder(body)
  }

  @Post('quotes')
  generateQuote(
    @Body() body: GenerateAiQuoteDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.generateQuote(body)
  }

  @Post('payments')
  createPayment(
    @Body() body: CreateAiPaymentDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.ai.createPayment(body)
  }

  private assertInternalToken(token?: string) {
    const expected =
      this.config.get<string>('AI_INTERNAL_TOKEN') ||
      'local-ai-internal-token'
    if (!token || token !== expected) {
      throw new UnauthorizedException('ai.unauthorized')
    }
  }
}
