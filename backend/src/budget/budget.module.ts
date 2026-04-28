import { Module } from '@nestjs/common'
import { BudgetController } from './budget.controller'
import { BudgetCalculatorService } from './budget-calculator.service'
import { M2CalculationStrategy } from './strategies/m2-calculation.strategy'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { CurrencyModule } from '../common/currency/currency.module'

@Module({
  imports: [SecureConfigModule, CurrencyModule],
  controllers: [BudgetController],
  providers: [BudgetCalculatorService, M2CalculationStrategy],
  exports: [BudgetCalculatorService],
})
export class BudgetModule {}
