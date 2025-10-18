import dayjs from 'dayjs'
import type { Server } from 'miragejs'

type CurrencyKey = 'IUSD' | 'UYU' | 'OTHER'

type MonthlyAccumulator = {
    date: dayjs.Dayjs
    sales: number
    expenses: number
    taxes: number
    salesBreakdown: Record<CurrencyKey, number>
    expensesBreakdown: Record<CurrencyKey, number>
}

const TAX_RATE = 0.22

const roundCurrency = (value: number) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100

const normalizeCurrencyKey = (raw?: string | null): CurrencyKey => {
    const normalized = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    if (normalized === 'IUSD') return 'IUSD'
    if (normalized === 'UYU') return 'UYU'
    return 'OTHER'
}

const emptyBreakdown = (): Record<CurrencyKey, number> => ({
    IUSD: 0,
    UYU: 0,
    OTHER: 0,
})

export default function accountingFakeApi(server: Server, apiPrefix: string) {
    server.post(`${apiPrefix}/accounting/dashboard`, (schema, { requestBody }) => {
        const body = requestBody ? JSON.parse(requestBody) : {}
        const startDate =
            typeof body.startDate === 'number' ? body.startDate : undefined
        const endDate =
            typeof body.endDate === 'number' ? body.endDate : undefined

        const rawOrders = (schema.db.ordersData || []).filter(
            (entry) => typeof entry !== 'function',
        ) as Array<Record<string, unknown>>
        const rawExpenses = (schema.db.expensesData || []).filter(
            (entry) => typeof entry !== 'function',
        ) as Array<Record<string, unknown>>

        const filterByRange = (timestamp: number | undefined) => {
            if (!Number.isFinite(timestamp)) {
                return false
            }
            if (startDate && timestamp < startDate) {
                return false
            }
            if (endDate && timestamp > endDate) {
                return false
            }
            return true
        }

        const orders = rawOrders.filter((order) =>
            filterByRange(Number(order.date)),
        )
        const expenses = rawExpenses.filter((expense) =>
            filterByRange(Number(expense.date)),
        )

        const candidateDates: number[] = []
        if (typeof startDate === 'number') {
            candidateDates.push(startDate)
        }
        if (typeof endDate === 'number') {
            candidateDates.push(endDate)
        }
        orders.forEach((order) => {
            const ts = Number(order.date)
            if (Number.isFinite(ts)) {
                candidateDates.push(ts)
            }
        })
        expenses.forEach((expense) => {
            const ts = Number(expense.date)
            if (Number.isFinite(ts)) {
                candidateDates.push(ts)
            }
        })

        const fallback = dayjs().startOf('month').unix()
        const minDate =
            candidateDates.length > 0
                ? Math.min(...candidateDates)
                : fallback
        const maxDate =
            candidateDates.length > 0
                ? Math.max(...candidateDates)
                : fallback

        const rangeStart = dayjs.unix(minDate).startOf('month')
        const rangeEnd = dayjs.unix(maxDate).startOf('month')

        const monthMap = new Map<string, MonthlyAccumulator>()

        const ensureMonth = (month: dayjs.Dayjs): MonthlyAccumulator => {
            const key = month.format('YYYY-MM')
            let record = monthMap.get(key)
            if (!record) {
                record = {
                    date: month.startOf('month'),
                    sales: 0,
                    expenses: 0,
                    taxes: 0,
                    salesBreakdown: emptyBreakdown(),
                    expensesBreakdown: emptyBreakdown(),
                }
                monthMap.set(key, record)
            }
            return record
        }

        orders.forEach((order, index) => {
            const ts = Number(order.date)
            const total =
                Number(order.grandTotal ?? order.totalAmount ?? 0) || 0
            const tax =
                Number(order.tax ?? roundCurrency(total * TAX_RATE)) || 0
            if (!Number.isFinite(ts)) {
                return
            }
            const month = ensureMonth(dayjs.unix(ts).startOf('month'))
            month.sales += total
            month.taxes += tax
            const currencyKey = normalizeCurrencyKey(
                (order.currency as string | undefined) ??
                    (index % 3 === 0 ? 'IUSD' : index % 3 === 1 ? 'UYU' : 'OTHER'),
            )
            month.salesBreakdown[currencyKey] += total
        })

        expenses.forEach((expense, index) => {
            const ts = Number(expense.date)
            const amount = Number(expense.amount ?? 0) || 0
            if (!Number.isFinite(ts)) {
                return
            }
            const month = ensureMonth(dayjs.unix(ts).startOf('month'))
            month.expenses += amount
            const currencyValue =
                (expense.currency as string | undefined) ??
                // Provide alternating currency fallback for mock data variety
                (index % 2 === 0 ? 'UYU' : 'IUSD')
            const key = normalizeCurrencyKey(currencyValue)
            month.expensesBreakdown[key] += amount
        })

        const monthly: Array<{
            month: number
            sales: number
            expenses: number
            taxes: number
            netIncome: number
            salesByCurrency: Record<CurrencyKey, number>
            expensesByCurrency: Record<CurrencyKey, number>
            netIncomeByCurrency: Record<CurrencyKey, number>
        }> = []

        let totalSales = 0
        let totalExpenses = 0
        let totalTaxes = 0
        const totalSalesBreakdown = emptyBreakdown()
        const totalExpensesBreakdown = emptyBreakdown()

        for (
            let current = rangeStart.clone();
            current.isSameOrBefore(rangeEnd, 'month');
            current = current.add(1, 'month')
        ) {
            const key = current.format('YYYY-MM')
            const record =
                monthMap.get(key) ?? {
                    date: current.clone(),
                    sales: 0,
                    expenses: 0,
                    taxes: 0,
                    salesBreakdown: emptyBreakdown(),
                    expensesBreakdown: emptyBreakdown(),
                }

            const roundedSales: Record<CurrencyKey, number> = {
                IUSD: roundCurrency(record.salesBreakdown.IUSD),
                UYU: roundCurrency(record.salesBreakdown.UYU),
                OTHER: roundCurrency(record.salesBreakdown.OTHER),
            }

            const roundedExpenses: Record<CurrencyKey, number> = {
                IUSD: roundCurrency(record.expensesBreakdown.IUSD),
                UYU: roundCurrency(record.expensesBreakdown.UYU),
                OTHER: roundCurrency(record.expensesBreakdown.OTHER),
            }

            const netIncomeValue = record.sales - record.expenses
            const netIncomeBreakdown: Record<CurrencyKey, number> = {
                IUSD: roundCurrency(record.salesBreakdown.IUSD - record.expensesBreakdown.IUSD),
                UYU: roundCurrency(record.salesBreakdown.UYU - record.expensesBreakdown.UYU),
                OTHER: roundCurrency(record.salesBreakdown.OTHER - record.expensesBreakdown.OTHER),
            }

            monthly.push({
                month: record.date.unix(),
                sales: roundCurrency(record.sales),
                expenses: roundCurrency(record.expenses),
                taxes: roundCurrency(record.taxes),
                netIncome: roundCurrency(netIncomeValue),
                salesByCurrency: roundedSales,
                expensesByCurrency: roundedExpenses,
                netIncomeByCurrency: netIncomeBreakdown,
            })

            totalSales += record.sales
            totalExpenses += record.expenses
            totalTaxes += record.taxes
            totalSalesBreakdown.IUSD += record.salesBreakdown.IUSD
            totalSalesBreakdown.UYU += record.salesBreakdown.UYU
            totalSalesBreakdown.OTHER += record.salesBreakdown.OTHER
            totalExpensesBreakdown.IUSD += record.expensesBreakdown.IUSD
            totalExpensesBreakdown.UYU += record.expensesBreakdown.UYU
            totalExpensesBreakdown.OTHER += record.expensesBreakdown.OTHER
        }

        const totalNetIncome = totalSales - totalExpenses

        return {
            range: {
                start: rangeStart.unix(),
                end: rangeEnd.unix(),
                granularity: 'month' as const,
            },
            monthly,
            totals: {
                sales: roundCurrency(totalSales),
                expenses: roundCurrency(totalExpenses),
                taxes: roundCurrency(totalTaxes),
                netIncome: roundCurrency(totalNetIncome),
                salesByCurrency: {
                    IUSD: roundCurrency(totalSalesBreakdown.IUSD),
                    UYU: roundCurrency(totalSalesBreakdown.UYU),
                    OTHER: roundCurrency(totalSalesBreakdown.OTHER),
                },
                expensesByCurrency: {
                    IUSD: roundCurrency(totalExpensesBreakdown.IUSD),
                    UYU: roundCurrency(totalExpensesBreakdown.UYU),
                    OTHER: roundCurrency(totalExpensesBreakdown.OTHER),
                },
                netIncomeByCurrency: {
                    IUSD: roundCurrency(totalSalesBreakdown.IUSD - totalExpensesBreakdown.IUSD),
                    UYU: roundCurrency(totalSalesBreakdown.UYU - totalExpensesBreakdown.UYU),
                    OTHER: roundCurrency(totalSalesBreakdown.OTHER - totalExpensesBreakdown.OTHER),
                },
            },
        }
    })
}
