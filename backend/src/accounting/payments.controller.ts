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
import { PaymentsService } from './payments.service'
import { PaymentListQueryDto, CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto'

@UseGuards(JwtAuthGuard)
@Controller('accounting/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  listPayments(@Query() query: PaymentListQueryDto) {
    return this.payments.listPayments(query)
  }

  @Get(':id')
  getPayment(@Param('id', ParseIntPipe) id: number) {
    return this.payments.getPayment(id)
  }

  @Post()
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.payments.createPayment(dto)
  }

  @Put(':id')
  updatePayment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentDto) {
    return this.payments.updatePayment(id, dto)
  }

  @Delete(':id')
  deletePayment(@Param('id', ParseIntPipe) id: number) {
    return this.payments.deletePayment(id)
  }
}
