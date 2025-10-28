import { Module } from '@nestjs/common'
import { AccountingController } from './accounting.controller'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [OrdersModule, EmailModule],
  controllers: [AccountingController, PaymentsController],
  providers: [PaymentsService],
})
export class AccountingModule {}
