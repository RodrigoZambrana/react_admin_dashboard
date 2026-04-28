import { BadRequestException, Injectable } from '@nestjs/common'
import { roundDecimal, decimal } from '../../common/currency/money.util'
import type { CalculationStrategy, CalculationStrategyInput } from './calculation-strategy'
import type { BudgetCalculationResult } from '../budget.types'

@Injectable()
export class M2CalculationStrategy implements CalculationStrategy {
  readonly key = 'M2'

  supports(strategyKey: string): boolean {
    return String(strategyKey || '').trim().toUpperCase() === this.key
  }

  private assertPositiveDimension(value: number, label: 'width' | 'height') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`Invalid ${label}`)
    }
  }

  calculate(input: CalculationStrategyInput): BudgetCalculationResult {
    this.assertPositiveDimension(input.width, 'width')
    this.assertPositiveDimension(input.height, 'height')

    const width = roundDecimal(decimal(input.width), 2)
    const height = roundDecimal(decimal(input.height), 2)
    const area = roundDecimal(width.times(height), 2)
    const unitPrice = roundDecimal(decimal(input.unitPrice), 2)
    const totalPrice = roundDecimal(area.times(unitPrice), 2)

    return {
      productId: input.productId,
      width: Number(width.toString()),
      height: Number(height.toString()),
      area: Number(area.toString()),
      unitPrice: Number(unitPrice.toString()),
      totalPrice: Number(totalPrice.toString()),
      measurementType: 'M2',
      strategy: this.key,
    }
  }
}
