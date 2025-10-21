import wildCardSearch from '@/utils/wildCardSearch'
import sortBy, { Primer } from '@/utils/sortBy'
import paginate from '@/utils/paginate'
import dayjs from 'dayjs'
import type { Server } from 'miragejs'
import { calculateLineTotal } from '@/utils/salesUnitCalculation'

export default function salesFakeApi(server: Server, apiPrefix: string) {
    server.post(`${apiPrefix}/sales/dashboard`, (schema, { requestBody }) => {
        const body = requestBody ? JSON.parse(requestBody) : {}
        const startDate =
            typeof body.startDate === 'number' ? body.startDate : undefined
        const endDate =
            typeof body.endDate === 'number' ? body.endDate : undefined

        const rawOrders = schema.db.ordersData.filter(
            (entry) => typeof entry !== 'function',
        ) as {
            date: number
            totalAmount: number
            customer: string
            id: string
            status: number
            paymentMehod: string
            paymentIdendifier: string
        }[]

        const filteredOrders = rawOrders.filter((order) => {
            const orderDate = Number(order.date)
            if (Number.isNaN(orderDate)) {
                return false
            }
            if (startDate && orderDate < startDate) {
                return false
            }
            if (endDate && orderDate > endDate) {
                return false
            }
            return true
        })

        const rangeStart =
            startDate ??
            (filteredOrders.length > 0
                ? filteredOrders.reduce(
                      (min, order) =>
                          order.date < min ? order.date : min,
                      filteredOrders[0].date,
                  )
                : dayjs().startOf('day').unix())

        const rangeEnd =
            endDate ??
            (filteredOrders.length > 0
                ? filteredOrders.reduce(
                      (max, order) =>
                          order.date > max ? order.date : max,
                      filteredOrders[0].date,
                  )
                : dayjs().startOf('day').unix())

        const start = dayjs.unix(rangeStart).startOf('day')
        const end = dayjs.unix(rangeEnd).startOf('day')
        const diffDays = Math.max(end.diff(start, 'day'), 0)

        const categories: number[] = []
        const purchasesSeries: number[] = []
        const monthlyPurchases = new Map<string, number>()

        filteredOrders.forEach((order) => {
            const orderTotal = Number(order.totalAmount || 0)
            const monthKey = dayjs.unix(order.date).format('YYYY-MM')
            monthlyPurchases.set(
                monthKey,
                (monthlyPurchases.get(monthKey) || 0) + orderTotal,
            )
        })

        const isFullYearRange =
            start.isSame(start.startOf('year')) &&
            end.isSame(start.endOf('year')) &&
            start.isSame(end, 'year')

        const granularity: 'hour' | 'day' | 'month' =
            diffDays === 0 ? 'hour' : isFullYearRange ? 'month' : 'day'

        if (diffDays === 0) {
            const hourlyPurchases = Array.from({ length: 24 }, () => 0)
            filteredOrders.forEach((order) => {
                const orderHour = dayjs.unix(order.date).hour()
                if (orderHour >= 0 && orderHour < 24) {
                    hourlyPurchases[orderHour] += Number(order.totalAmount || 0)
                }
            })
            for (let hour = 0; hour < 24; hour++) {
                const purchasesValue =
                    Math.round((hourlyPurchases[hour] + Number.EPSILON) * 100) /
                    100
                const bucketTime = start.add(hour, 'hour')
                categories.push(bucketTime.startOf('hour').unix())
                purchasesSeries.push(purchasesValue)
            }
        } else if (granularity === 'month') {
            const year = start.year()
            for (let month = 0; month < 12; month++) {
                const bucketTime = dayjs(`${year}-01-01`).startOf('year').add(month, 'month')
                const monthKey = bucketTime.format('YYYY-MM')
                categories.push(bucketTime.startOf('month').unix())
                purchasesSeries.push(
                    Math.round(
                        ((monthlyPurchases.get(monthKey) || 0) + Number.EPSILON) *
                            100,
                    ) / 100,
                )
            }
        } else {
            for (let i = 0; i <= diffDays; i++) {
                const day = start.add(i, 'day')
                const dayStart = day.startOf('day').unix()
                const dayEnd = day.endOf('day').unix()
                const dayRevenue = filteredOrders.reduce((sum, order) => {
                    if (order.date >= dayStart && order.date <= dayEnd) {
                        return sum + Number(order.totalAmount || 0)
                    }
                    return sum
                }, 0)

                categories.push(day.startOf('day').unix())
                purchasesSeries.push(
                    Math.round((dayRevenue + Number.EPSILON) * 100) / 100,
                )
            }
        }

        const computeTotals = filteredOrders.reduce(
            (acc, order) => {
                const total = Number(order.totalAmount || 0)
                return {
                    revenue: acc.revenue + total,
                    purchases: acc.purchases + total * 0.65,
                }
            },
            { revenue: 0, purchases: 0 },
        )

        const baseDashboard =
            (schema.db.salesDashboardData[0] as Record<string, unknown>) || {}

        const categoriesData = schema.db.productCategoriesData.filter(
            (entry) => typeof entry !== 'function',
        ) as { id: string; name: string }[]
        const categoryLabelMap = new Map<string, string>()
        categoriesData.forEach((category) => {
            categoryLabelMap.set(String(category.id), category.name)
        })

        const rawProducts = schema.db.productsData.filter(
            (entry) => typeof entry !== 'function',
        ) as {
            id: string | number
            name: string
            img?: string
            category?: string
            categoryId?: string | number
        }[]

        const productIndex = new Map<
            string,
            {
                name: string
                img: string
                categoryId: string
                categoryLabel: string
            }
        >()
        rawProducts.forEach((product) => {
            const categoryRaw =
                (product as any).categoryId ??
                (product as any).category ??
                ((product as any).category?.id ?? '')
            const categoryId = categoryRaw ? String(categoryRaw) : ''
            const categoryLabel = categoryId
                ? categoryLabelMap.get(categoryId) ?? categoryId
                : ''
            productIndex.set(String(product.id), {
                name: product.name,
                img: product.img || '',
                categoryId,
                categoryLabel,
            })
        })

        const productQty = new Map<string, number>()
        const categoryTotalsMap = new Map<string, number>()
        filteredOrders.forEach((order) => {
            const items = Array.isArray((order as any).items)
                ? ((order as any).items as any[])
                : []
            items.forEach((item) => {
                const rawQty = Number(item?.qty ?? item?.quantity ?? 0)
                const qty = Number.isFinite(rawQty) ? rawQty : 0
                if (qty <= 0) {
                    return
                }
                const productIdRaw = item?.productId ?? item?.id
                const productId =
                    productIdRaw !== undefined && productIdRaw !== null
                        ? String(productIdRaw)
                        : ''
                if (productId) {
                    productQty.set(
                        productId,
                        (productQty.get(productId) || 0) + qty,
                    )
                }

                let categoryId = item?.categoryId ?? item?.category ?? ''
                let categoryLabel = item?.categoryLabel ?? ''
                if (productId) {
                    const productInfo = productIndex.get(productId)
                    if (productInfo) {
                        categoryId = productInfo.categoryId || categoryId
                        categoryLabel =
                            productInfo.categoryLabel || categoryLabel
                    }
                }
                if (!categoryLabel && categoryId) {
                    categoryLabel =
                        categoryLabelMap.get(String(categoryId)) ??
                        String(categoryId)
                }
                if (!categoryLabel) {
                    return
                }
                categoryTotalsMap.set(
                    categoryLabel,
                    (categoryTotalsMap.get(categoryLabel) || 0) + qty,
                )
            })
        })

        let categorySummary = Array.from(categoryTotalsMap.entries())
            .map(([label, value]) => ({ label, value }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value)

        if (!categorySummary.length) {
            const baseCategories = (baseDashboard.salesByCategoriesData ||
                {}) as { labels?: string[]; data?: number[] }
            categorySummary = (baseCategories.labels || [])
                .map((label, index) => ({
                    label,
                    value: baseCategories.data?.[index] || 0,
                }))
                .filter((item) => item.value > 0)
        }

        let topProductsData = Array.from(productQty.entries())
            .map(([productId, sold]) => {
                const productInfo = productIndex.get(productId)
                if (!productInfo) {
                    return null
                }
                return {
                    id: productId,
                    name: productInfo.name,
                    img: productInfo.img,
                    sold,
                }
            })
            .filter(
                (
                    item,
                ): item is {
                    id: string
                    name: string
                    img: string
                    sold: number
                } => !!item && item.sold > 0,
            )
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 6)

        if (!topProductsData.length) {
            topProductsData =
                ((baseDashboard.topProductsData as {
                    id: string
                    name: string
                    img: string
                    sold: number
                }[]) || []).filter((item) => (item?.sold || 0) > 0)
        }

        const latestOrderData = filteredOrders
            .slice()
            .sort((a, b) => Number(b.date) - Number(a.date))
            .slice(0, 8)
            .map((order) => ({
                ...order,
                totalAmount: Number(order.totalAmount || 0),
            }))

        return {
            statisticData: {
                revenue: {
                    value:
                        Math.round(
                            (computeTotals.revenue + Number.EPSILON) * 100,
                        ) / 100,
                    growShrink: 0,
                },
                orders: {
                    value: filteredOrders.length,
                    growShrink: 0,
                },
                purchases: {
                    value:
                        Math.round(
                            (computeTotals.purchases + Number.EPSILON) * 100,
                        ) / 100,
                    growShrink: 0,
                },
            },
            salesReportData: {
                series: [
                    { name: 'Purchases', data: purchasesSeries },
                ],
                categories,
                granularity,
            },
            topProductsData,
            latestOrderData,
            salesByCategoriesData: {
                labels: categorySummary.map((item) => item.label),
                data: categorySummary.map((item) => item.value),
            },
        }
    })

    server.post(`${apiPrefix}/sales/products`, (schema, { requestBody }) => {
        const body = JSON.parse(requestBody)
        const { pageIndex, pageSize, sort, query } = body
        const { order, key } = sort
        const products = schema.db.productsData
        const sanitizeProducts = products.filter(
            (elm) => typeof elm !== 'function',
        )
        let data = sanitizeProducts.map((p: any) => ({
            ...p,
            published: typeof p.published === 'boolean' ? p.published : false,
        }))
        let total = products.length

        if ((key === 'category' || key === 'name') && order) {
            data.sort(
                sortBy(key, order === 'desc', (a) =>
                    (a as string).toUpperCase(),
                ),
            )
        } else {
            data.sort(sortBy(key, order === 'desc', parseInt as Primer))
        }

        if (query) {
            data = wildCardSearch(data, query)
            total = data.length
        }

        data = paginate(data, pageSize, pageIndex)

        const responseData = {
            data: data,
            total: total,
        }
        return responseData
    })

    server.del(
        `${apiPrefix}/sales/products/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            schema.db.productsData.remove({ id })
            return true
        },
    )

    server.get(`${apiPrefix}/sales/product`, (schema, { queryParams }) => {
        const id = queryParams.id
        const product = schema.db.productsData.find(id as string)
        if (product && typeof (product as any).published !== 'boolean') {
            ;(product as any).published = false
        }
        return product
    })

    server.put(
        `${apiPrefix}/sales/products/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.productsData.update({ id }, data)
            return true
        },
    )

    server.post(
        `${apiPrefix}/sales/products/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            if (typeof data.published !== 'boolean') {
                data.published = false
            }
            schema.db.productsData.insert(data)
            return true
        },
    )

    server.get(`${apiPrefix}/orders`, (schema, { queryParams }) => {
        const { pageIndex, pageSize, query } = queryParams
        const order = queryParams['sort[order]']
        const key = queryParams['sort[key]']
        const orders = schema.db.ordersData
        const sanitizeProducts = orders.filter(
            (elm) => typeof elm !== 'function',
        )
        let data = sanitizeProducts
        let total = orders.length

        if (key) {
            if (
                (key === 'date' ||
                    key === 'status' ||
                    key === 'paymentMehod') &&
                order
            ) {
                data.sort(sortBy(key, order === 'desc', parseInt as Primer))
            } else {
                data.sort(
                    sortBy(key as string, order === 'desc', (a) =>
                        (a as string).toUpperCase(),
                    ),
                )
            }
        }

        if (query) {
            data = wildCardSearch(data, query as string)
            total = data.length
        }

        data = paginate(
            data,
            parseInt(pageSize as string),
            parseInt(pageIndex as string),
        )

        const responseData = {
            data: data,
            total: total,
        }
        return responseData
    })

    server.del(
        `${apiPrefix}/orders`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            id.forEach((elm: string) => {
                schema.db.ordersData.remove({ id: elm })
            })
            return true
        },
    )

    server.get(
        `${apiPrefix}/orders/:id/details`,
        (schema, { params }) => {
            const { id } = params
            const orderDetail = schema.db.orderDetailsData
            orderDetail[0].id = id
            return orderDetail[0]
        },
    )

    server.put(`${apiPrefix}/orders/:id/status`, (schema, { params, requestBody }) => {
        const { id } = params
        const { status } = JSON.parse(requestBody)
        schema.db.ordersData.update({ id }, { status })
        return true
    })

    server.put(
        `${apiPrefix}/orders/:id/payment-method`,
        (schema, { params, requestBody }) => {
            const { id } = params
            const { paymentMehod } = JSON.parse(requestBody)
            schema.db.ordersData.update({ id }, { paymentMehod })
            return true
        },
    )

    // CRUD: get single order
    server.get(`${apiPrefix}/orders/:id`, (schema, { params }) => {
        const { id } = params
        return schema.db.ordersData.find(id)
    })

    // CRUD: create order
    server.post(`${apiPrefix}/orders`, (schema, { requestBody }) => {
        const data = JSON.parse(requestBody)
        if (Array.isArray(data.items)) {
            data.totalAmount = data.items.reduce(
                (sum: number, it: any) =>
                    sum +
                    calculateLineTotal({
                        unitPrice: Number(it.unitPrice ?? it.price) || 0,
                        qty: Number(it.qty) || 0,
                        unitOfMeasure: it.unitOfMeasure ?? it.pricingMethod,
                        pricingMethod: it.pricingMethod,
                        customAttributes: it.customAttributes,
                    }),
                0,
            )
        }
        if (!data.date) {
            data.date = Math.floor(Date.now() / 1000)
        }
        if (!data.status && data.status !== 0) {
            data.status = 0
        }
        schema.db.ordersData.insert(data)
        return true
    })

    // CRUD: save order comment
    server.patch(`${apiPrefix}/orders/:id/comment`, (schema, { params, requestBody }) => {
        const { id } = params
        const { comment } = JSON.parse(requestBody)
        schema.db.ordersData.update({ id }, { comment })
        return true
    })
}
