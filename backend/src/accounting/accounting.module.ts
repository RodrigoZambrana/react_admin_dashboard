import { Module } from '@nestjs/common'
import { AccountingController } from './accounting.controller'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [OrdersModule],
  controllers: [AccountingController, PaymentsController],
  providers: [PaymentsService],
})
export class AccountingModule {}
