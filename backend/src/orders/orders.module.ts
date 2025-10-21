import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { BudgetsController } from './budgets.controller'
import { SalesDocumentsService } from './sales-documents.service'
import { BudgetsFeatureGuard } from './guards/budgets-feature.guard'

@Module({
  controllers: [OrdersController, BudgetsController],
  providers: [SalesDocumentsService, BudgetsFeatureGuard],
  exports: [SalesDocumentsService],
})
export class OrdersModule {}
