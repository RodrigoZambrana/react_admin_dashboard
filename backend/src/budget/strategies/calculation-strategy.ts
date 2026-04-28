import type { BudgetCalculationResult } from '../budget.types'

export type CalculationStrategyInput = {
  productId: number
  width: number
  height: number
  unitPrice: number
}

export interface CalculationStrategy {
  readonly key: string
  supports(strategyKey: string): boolean
  calculate(input: CalculationStrategyInput): BudgetCalculationResult
}
