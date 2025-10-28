import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { BudgetsController } from './budgets.controller'
import { SalesDocumentsService } from './sales-documents.service'
import { BudgetsFeatureGuard } from './guards/budgets-feature.guard'
import { OrderFinanceService } from './order-finance.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController, BudgetsController],
  providers: [SalesDocumentsService, BudgetsFeatureGuard, OrderFinanceService],
  exports: [SalesDocumentsService, OrderFinanceService],
})
export class OrdersModule {}
