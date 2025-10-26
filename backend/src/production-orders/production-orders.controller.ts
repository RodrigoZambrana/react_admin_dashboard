import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ProductionOrdersService } from './production-orders.service'
import {
  CreateProductionOrderDto,
  ProductionOrderListQueryDto,
  UpdateProductionOrderDto,
} from './dto/production-order.dto'

@UseGuards(JwtAuthGuard)
@Controller('production-orders')
export class ProductionOrdersController {
  constructor(private readonly productionOrders: ProductionOrdersService) {}

  @Get()
  list(@Query() query: ProductionOrderListQueryDto) {
    return this.productionOrders.list(query)
  }

  @Get('summary')
  summary() {
    return this.productionOrders.summary()
  }

  @Get('stats')
  stats() {
    return this.productionOrders.stats()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrders.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateProductionOrderDto) {
    return this.productionOrders.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductionOrderDto) {
    return this.productionOrders.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrders.remove(id)
  }
}
