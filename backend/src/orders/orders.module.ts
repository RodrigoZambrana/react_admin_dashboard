import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { BudgetsController } from './budgets.controller'
import { SalesDocumentsService } from './sales-documents.service'
import { BudgetsFeatureGuard } from './guards/budgets-feature.guard'
import { OrderFinanceService } from './order-finance.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { EmailModule } from '../email/email.module'
import { OrderTimelineService } from './order-timeline.service'

@Module({
  imports: [NotificationsModule, EmailModule],
  controllers: [OrdersController, BudgetsController],
  providers: [SalesDocumentsService, BudgetsFeatureGuard, OrderFinanceService, OrderTimelineService],
  exports: [SalesDocumentsService, OrderFinanceService, OrderTimelineService],
})
export class OrdersModule {}
