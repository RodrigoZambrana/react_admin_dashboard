import { Body, Controller, Get, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { BudgetCalculatorService } from './budget-calculator.service'
import { BudgetAddToCartDto, BudgetCalculateDto, BudgetLeadDto, BudgetSummaryDto } from './budget.types'

@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetCalculator: BudgetCalculatorService) {}

  @Get('products')
  listProducts() {
    return this.budgetCalculator.listProducts()
  }

  @Post('calculate')
  calculate(@Body() dto: BudgetCalculateDto) {
    return this.budgetCalculator.calculate(dto)
  }

  @Post('add-to-cart')
  addToCart(@Body() dto: BudgetAddToCartDto) {
    return this.budgetCalculator.addToCart(dto)
  }

  @Post('summary')
  summarize(@Body() dto: BudgetSummaryDto) {
    return this.budgetCalculator.summarize(dto)
  }

  @Post('lead')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createLead(@Body() dto: BudgetLeadDto) {
    return this.budgetCalculator.saveLead(dto)
  }
}
