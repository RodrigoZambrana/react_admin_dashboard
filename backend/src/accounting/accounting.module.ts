import { Module } from '@nestjs/common'
import { AccountingController } from './accounting.controller'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { OrdersModule } from '../orders/orders.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [OrdersModule, NotificationsModule],
  controllers: [AccountingController, PaymentsController],
  providers: [PaymentsService],
})
export class AccountingModule {}
