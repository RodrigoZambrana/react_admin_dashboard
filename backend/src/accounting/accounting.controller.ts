import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { DashboardFilterDto } from './dto/dashboard.dto'
import { Prisma } from '@prisma/client'
import { decimalToNumber, roundCurrency as roundPrice } from '../sales/utils/pricing'

type CurrencyKey = 'IUSD' | 'UYU' | 'OTHER'

type MonthlyAccumulator = {
  month: Date
  sales: number
  expenses: number
  salesByCurrency: Record<CurrencyKey, number>
  expensesByCurrency: Record<CurrencyKey, number>
  salesVatByCurrency: Record<CurrencyKey, number>
  purchaseVatByCurrency: Record<CurrencyKey, number>
}

type DashboardCurrencyBreakdown = Record<CurrencyKey, number>

const CURRENCY_ORDER: CurrencyKey[] = ['IUSD', 'UYU', 'OTHER']
const VAT_RATE = 0.22

@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly prisma: PrismaService) {}

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}`
  }

  private toUnix(date: Date): number {
    return Math.floor(date.getTime() / 1000)
  }

  private roundCurrency(value: number): number {
    return roundPrice(value)
  }

  private extractCurrencyKey(raw?: string | null): CurrencyKey {
    const normalized = raw?.trim().toUpperCase()
    if (!normalized) {
      return 'OTHER'
    }
    const alias: Record<string, CurrencyKey> = {
      IUSD: 'IUSD',
      USD: 'IUSD',
      'US$': 'IUSD',
      'U$S': 'IUSD',
      'U$D': 'IUSD',
      USD$: 'IUSD',
      DOLARES: 'IUSD',
      'DÓLARES': 'IUSD',
      DOLLARS: 'IUSD',
      UYU: 'UYU',
      'UY$': 'UYU',
      'UY$S': 'UYU',
      '$U': 'UYU',
      PESO: 'UYU',
      PESOS: 'UYU',
    }
    if (alias[normalized]) {
      return alias[normalized]
    }
    const sanitized = normalized.replace(/[^A-Z]/g, '')
    if (alias[sanitized]) {
      return alias[sanitized]
    }
    return 'OTHER'
  }

  private mergeCurrencyTotals(target: DashboardCurrencyBreakdown, source: DashboardCurrencyBreakdown) {
    target.IUSD += source.IUSD
    target.UYU += source.UYU
    target.OTHER += source.OTHER
  }

  private emptyBreakdown(): DashboardCurrencyBreakdown {
    return { IUSD: 0, UYU: 0, OTHER: 0 }
  }

  private sumBreakdown(breakdown: DashboardCurrencyBreakdown): number {
    return (breakdown.IUSD ?? 0) + (breakdown.UYU ?? 0) + (breakdown.OTHER ?? 0)
  }

  private computeVat(amount: number) {
    if (!Number.isFinite(amount) || amount === 0) {
      return { net: 0, vat: 0 }
    }
    const net = amount / (1 + VAT_RATE)
    const vat = amount - net
    return { net, vat }
  }

  @Post('dashboard')
  async dashboard(@Body() dto: DashboardFilterDto) {
    const { startDate, endDate } = dto ?? {}

    const dateRange: Prisma.DateTimeFilter = {}
    if (typeof startDate === 'number' && Number.isFinite(startDate)) {
      dateRange.gte = new Date(startDate * 1000)
    }
    if (typeof endDate === 'number' && Number.isFinite(endDate)) {
      dateRange.lte = new Date(endDate * 1000)
    }

    const orderWhere: Prisma.OrderWhereInput = {}
    const expenseWhere: Prisma.ExpenseWhereInput = {}
    if (Object.keys(dateRange).length > 0) {
      orderWhere.date = dateRange
      expenseWhere.date = dateRange
    }

    const [orders, expenses] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          date: true,
          grandTotal: true,
          tax: true,
          orderCurrency: true,
          items: {
            select: {
              price: true,
              qty: true,
              unitCurrency: true,
              unitAmount: true,
              unitAmountOrderCurrency: true,
              unitCostOrderCurrency: true,
              unitCostAmount: true,
              unitCostCurrency: true,
              conversionRate: true,
              product: {
                select: {
                  currency: true,
                  salePrice: true,
                  costPrice: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: { date: true, amount: true, currency: true, taxCreditEligible: true },
      }),
    ])

    const monthMap = new Map<string, MonthlyAccumulator>()

    const ensureAccumulator = (date: Date) => {
      const monthStart = this.startOfMonth(date)
      const key = this.monthKey(monthStart)
      let acc = monthMap.get(key)
      if (!acc) {
        acc = {
          month: monthStart,
          sales: 0,
          expenses: 0,
          salesByCurrency: {
            IUSD: 0,
            UYU: 0,
            OTHER: 0,
          },
          expensesByCurrency: {
            IUSD: 0,
            UYU: 0,
            OTHER: 0,
          },
          salesVatByCurrency: {
            IUSD: 0,
            UYU: 0,
            OTHER: 0,
          },
          purchaseVatByCurrency: {
            IUSD: 0,
            UYU: 0,
            OTHER: 0,
          },
        }
        monthMap.set(key, acc)
      }
      return acc
    }

    for (const order of orders) {
      const orderDate = new Date(order.date)
      const acc = ensureAccumulator(orderDate)
      let orderSales = 0

      if (Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
          const qty = Number(item.qty ?? 0)
          const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 0
          const unitPriceOrder = decimalToNumber(item.price)
          const saleTotalOrderCurrency = this.roundCurrency(unitPriceOrder * normalizedQty)
          orderSales += saleTotalOrderCurrency

          const unitAmountOriginal = (() => {
            if (item.unitAmount !== null && item.unitAmount !== undefined) {
              return decimalToNumber(item.unitAmount)
            }
            if (
              item.unitAmountOrderCurrency !== null &&
              item.unitAmountOrderCurrency !== undefined &&
              item.conversionRate !== null &&
              item.conversionRate !== undefined
            ) {
              const derivedRate = decimalToNumber(item.conversionRate)
              if (Number.isFinite(derivedRate) && derivedRate !== 0) {
                const amountOrder = decimalToNumber(item.unitAmountOrderCurrency)
                return amountOrder / derivedRate
              }
            }
            if (item.product?.currency) {
              return decimalToNumber(item.product?.salePrice)
            }
            return unitPriceOrder
          })()
          const saleTotalOriginal = this.roundCurrency(unitAmountOriginal * normalizedQty)
          const saleCurrencyRaw =
            item.unitCurrency ?? item.product?.currency ?? order.orderCurrency ?? null
          const saleCurrencyKey = this.extractCurrencyKey(saleCurrencyRaw)
          acc.salesByCurrency[saleCurrencyKey] += saleTotalOriginal
          const { vat: saleVatOriginal } = this.computeVat(saleTotalOriginal)
          acc.salesVatByCurrency[saleCurrencyKey] += saleVatOriginal

          const unitCostOriginal = (() => {
            if (item.unitCostAmount !== null && item.unitCostAmount !== undefined) {
              return decimalToNumber(item.unitCostAmount)
            }
            if (
              item.unitCostOrderCurrency !== null &&
              item.unitCostOrderCurrency !== undefined &&
              item.conversionRate !== null &&
              item.conversionRate !== undefined
            ) {
              const derivedRate = decimalToNumber(item.conversionRate)
              if (Number.isFinite(derivedRate) && derivedRate !== 0) {
                const costOrder = decimalToNumber(item.unitCostOrderCurrency)
                return costOrder / derivedRate
              }
            }
            if (item.product?.costPrice !== undefined && item.product?.costPrice !== null) {
              return decimalToNumber(item.product?.costPrice)
            }
            return 0
          })()
          const costTotalOriginal = this.roundCurrency(unitCostOriginal * normalizedQty)
          if (costTotalOriginal > 0) {
            const costCurrencyRaw =
              item.unitCostCurrency ?? item.unitCurrency ?? item.product?.currency ?? order.orderCurrency ?? null
            const costCurrencyKey = this.extractCurrencyKey(costCurrencyRaw)
            const { vat: costVatOriginal } = this.computeVat(costTotalOriginal)
            acc.purchaseVatByCurrency[costCurrencyKey] += costVatOriginal
          }
        }
      }

      if (orderSales <= 0) {
        const fallbackTotal = decimalToNumber(order.grandTotal)
        const normalizedFallback = Number.isFinite(fallbackTotal) ? fallbackTotal : 0
        if (normalizedFallback !== 0) {
          const currencyKey = this.extractCurrencyKey(order.orderCurrency ?? null)
          acc.salesByCurrency[currencyKey] += normalizedFallback
          const { vat: saleVat } = this.computeVat(normalizedFallback)
          acc.salesVatByCurrency[currencyKey] += saleVat
          orderSales += normalizedFallback
        }
      }

      acc.sales += orderSales
    }

    for (const expense of expenses) {
      const expenseDate = new Date(expense.date)
      const acc = ensureAccumulator(expenseDate)
      const amount = decimalToNumber(expense.amount)
      const normalizedAmount = Number.isFinite(amount) ? amount : 0
      const currencyKey = this.extractCurrencyKey(expense.currency)
      acc.expenses += normalizedAmount
      acc.expensesByCurrency[currencyKey] += normalizedAmount
      if (expense.taxCreditEligible) {
        const { vat: expenseVat } = this.computeVat(normalizedAmount)
        acc.purchaseVatByCurrency[currencyKey] += expenseVat
      }
    }

    let rangeStart: Date | undefined
    let rangeEnd: Date | undefined

    if (typeof startDate === 'number' && Number.isFinite(startDate)) {
      rangeStart = this.startOfMonth(new Date(startDate * 1000))
    }

    if (typeof endDate === 'number' && Number.isFinite(endDate)) {
      rangeEnd = this.startOfMonth(new Date(endDate * 1000))
    }

    for (const { month } of monthMap.values()) {
      if (!rangeStart || month < rangeStart) {
        rangeStart = month
      }
      if (!rangeEnd || month > rangeEnd) {
        rangeEnd = month
      }
    }

    if (!rangeStart || !rangeEnd) {
      const today = this.startOfMonth(new Date())
      rangeStart = today
      rangeEnd = today
    }

    if (rangeStart > rangeEnd) {
      const tmp = rangeStart
      rangeStart = rangeEnd
      rangeEnd = tmp
    }

    const monthly: Array<{
      month: number
      sales: number
      expenses: number
      taxes: number
      netIncome: number
      salesByCurrency: DashboardCurrencyBreakdown
      expensesByCurrency: DashboardCurrencyBreakdown
      taxesByCurrency: DashboardCurrencyBreakdown
      netIncomeByCurrency: DashboardCurrencyBreakdown
    }> = []

    let totalSales = 0
    let totalExpenses = 0
    let totalTaxes = 0
    const totalSalesByCurrency = this.emptyBreakdown()
    const totalExpensesByCurrency = this.emptyBreakdown()
    const totalTaxesByCurrency = this.emptyBreakdown()

    for (
      let cursor = new Date(rangeStart);
      cursor <= rangeEnd;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      const key = this.monthKey(cursor)
      const acc = monthMap.get(key) ?? {
        month: this.startOfMonth(cursor),
        sales: 0,
        expenses: 0,
        salesByCurrency: this.emptyBreakdown(),
        expensesByCurrency: this.emptyBreakdown(),
        salesVatByCurrency: this.emptyBreakdown(),
        purchaseVatByCurrency: this.emptyBreakdown(),
      }

      this.mergeCurrencyTotals(totalSalesByCurrency, acc.salesByCurrency)
      this.mergeCurrencyTotals(totalExpensesByCurrency, acc.expensesByCurrency)
      const taxesByCurrencyRaw: DashboardCurrencyBreakdown = {
        IUSD: (acc.salesVatByCurrency.IUSD ?? 0) - (acc.purchaseVatByCurrency.IUSD ?? 0),
        UYU: (acc.salesVatByCurrency.UYU ?? 0) - (acc.purchaseVatByCurrency.UYU ?? 0),
        OTHER: (acc.salesVatByCurrency.OTHER ?? 0) - (acc.purchaseVatByCurrency.OTHER ?? 0),
      }
      this.mergeCurrencyTotals(totalTaxesByCurrency, taxesByCurrencyRaw)

      const roundedSalesByCurrency: DashboardCurrencyBreakdown = {
        IUSD: this.roundCurrency(acc.salesByCurrency.IUSD ?? 0),
        UYU: this.roundCurrency(acc.salesByCurrency.UYU ?? 0),
        OTHER: this.roundCurrency(acc.salesByCurrency.OTHER ?? 0),
      }

      const roundedExpensesByCurrency: DashboardCurrencyBreakdown = {
        IUSD: this.roundCurrency(acc.expensesByCurrency.IUSD ?? 0),
        UYU: this.roundCurrency(acc.expensesByCurrency.UYU ?? 0),
        OTHER: this.roundCurrency(acc.expensesByCurrency.OTHER ?? 0),
      }

      const roundedTaxesByCurrency: DashboardCurrencyBreakdown = {
        IUSD: this.roundCurrency(taxesByCurrencyRaw.IUSD),
        UYU: this.roundCurrency(taxesByCurrencyRaw.UYU),
        OTHER: this.roundCurrency(taxesByCurrencyRaw.OTHER),
      }

      const netTaxRaw = this.sumBreakdown(taxesByCurrencyRaw)
      const netIncomeRaw = acc.sales - (acc.expenses + netTaxRaw)
      const netIncomeByCurrency: DashboardCurrencyBreakdown = {
        IUSD: this.roundCurrency(
          (acc.salesByCurrency.IUSD ?? 0) -
            ((acc.expensesByCurrency.IUSD ?? 0) + taxesByCurrencyRaw.IUSD),
        ),
        UYU: this.roundCurrency(
          (acc.salesByCurrency.UYU ?? 0) -
            ((acc.expensesByCurrency.UYU ?? 0) + taxesByCurrencyRaw.UYU),
        ),
        OTHER: this.roundCurrency(
          (acc.salesByCurrency.OTHER ?? 0) -
            ((acc.expensesByCurrency.OTHER ?? 0) + taxesByCurrencyRaw.OTHER),
        ),
      }

      monthly.push({
        month: this.toUnix(acc.month),
        sales: this.roundCurrency(acc.sales),
        expenses: this.roundCurrency(acc.expenses),
        taxes: this.roundCurrency(netTaxRaw),
        netIncome: this.roundCurrency(netIncomeRaw),
        salesByCurrency: roundedSalesByCurrency,
        expensesByCurrency: roundedExpensesByCurrency,
        taxesByCurrency: roundedTaxesByCurrency,
        netIncomeByCurrency,
      })

      totalSales += acc.sales
      totalExpenses += acc.expenses
      totalTaxes += netTaxRaw
    }

    const roundedSalesTotalsByCurrency: DashboardCurrencyBreakdown = {
      IUSD: this.roundCurrency(totalSalesByCurrency.IUSD),
      UYU: this.roundCurrency(totalSalesByCurrency.UYU),
      OTHER: this.roundCurrency(totalSalesByCurrency.OTHER),
    }

    const roundedExpensesTotalsByCurrency: DashboardCurrencyBreakdown = {
      IUSD: this.roundCurrency(totalExpensesByCurrency.IUSD),
      UYU: this.roundCurrency(totalExpensesByCurrency.UYU),
      OTHER: this.roundCurrency(totalExpensesByCurrency.OTHER),
    }

    const roundedTaxesTotalsByCurrency: DashboardCurrencyBreakdown = {
      IUSD: this.roundCurrency(totalTaxesByCurrency.IUSD),
      UYU: this.roundCurrency(totalTaxesByCurrency.UYU),
      OTHER: this.roundCurrency(totalTaxesByCurrency.OTHER),
    }

    const totalNetIncome = totalSales - (totalExpenses + totalTaxes)
    const roundedBalanceByCurrency: DashboardCurrencyBreakdown = {
      IUSD: this.roundCurrency(totalSalesByCurrency.IUSD - totalExpensesByCurrency.IUSD),
      UYU: this.roundCurrency(totalSalesByCurrency.UYU - totalExpensesByCurrency.UYU),
      OTHER: this.roundCurrency(totalSalesByCurrency.OTHER - totalExpensesByCurrency.OTHER),
    }

    const totalNetIncomeByCurrency: DashboardCurrencyBreakdown = {
      IUSD: this.roundCurrency(
        totalSalesByCurrency.IUSD - (totalExpensesByCurrency.IUSD + totalTaxesByCurrency.IUSD),
      ),
      UYU: this.roundCurrency(
        totalSalesByCurrency.UYU - (totalExpensesByCurrency.UYU + totalTaxesByCurrency.UYU),
      ),
      OTHER: this.roundCurrency(
        totalSalesByCurrency.OTHER - (totalExpensesByCurrency.OTHER + totalTaxesByCurrency.OTHER),
      ),
    }

    const currencySummary = CURRENCY_ORDER.map((currency) => ({
      currency,
      sales: this.roundCurrency(totalSalesByCurrency[currency]),
      expenses: this.roundCurrency(totalExpensesByCurrency[currency]),
      taxes: this.roundCurrency(totalTaxesByCurrency[currency]),
      balance: this.roundCurrency(totalSalesByCurrency[currency] - totalExpensesByCurrency[currency]),
      liquidIncome: this.roundCurrency(
        totalSalesByCurrency[currency] - (totalExpensesByCurrency[currency] + totalTaxesByCurrency[currency]),
      ),
    }))

    return {
      range: {
        start: this.toUnix(rangeStart),
        end: this.toUnix(rangeEnd),
        granularity: 'month' as const,
      },
      monthly,
      totals: {
        sales: this.roundCurrency(totalSales),
        expenses: this.roundCurrency(totalExpenses),
        taxes: this.roundCurrency(totalTaxes),
        balance: this.roundCurrency(totalSales - totalExpenses),
        netIncome: this.roundCurrency(totalNetIncome),
        salesByCurrency: roundedSalesTotalsByCurrency,
        expensesByCurrency: roundedExpensesTotalsByCurrency,
        taxesByCurrency: roundedTaxesTotalsByCurrency,
        balanceByCurrency: roundedBalanceByCurrency,
        netIncomeByCurrency: totalNetIncomeByCurrency,
      },
      currencySummary,
    }
  }
}
