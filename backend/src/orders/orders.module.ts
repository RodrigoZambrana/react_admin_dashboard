import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { BudgetsController } from './budgets.controller'
import { SalesDocumentsService } from './sales-documents.service'
import { BudgetsFeatureGuard } from './guards/budgets-feature.guard'
import { OrderFinanceService } from './order-finance.service'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [EmailModule],
  controllers: [OrdersController, BudgetsController],
  providers: [SalesDocumentsService, BudgetsFeatureGuard, OrderFinanceService],
  exports: [SalesDocumentsService, OrderFinanceService],
})
export class OrdersModule {}
