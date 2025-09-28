import type { Server } from 'miragejs'

const pickRandomColor = () => {
    const colors = [
        'blue-500',
        'violet-500',
        'indigo-500',
        'teal-500',
        'cyan-500',
        'fuchsia-500',
        'rose-500',
        'lime-500',
    ]
    return colors[Math.floor(Math.random() * colors.length)]
}

export default function settingsFakeApi(server: Server, apiPrefix: string) {
    // Order statuses
    server.get(`${apiPrefix}/settings/order-statuses`, (schema) => {
        return schema.db.orderStatusesData
    })

    server.post(
        `${apiPrefix}/settings/order-statuses/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            if (!data.color) data.color = pickRandomColor()
            schema.db.orderStatusesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/order-statuses/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.orderStatusesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/order-statuses/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: number[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm: number) => {
                schema.db.orderStatusesData.remove({ id: elm })
            })
            return true
        },
    )

    // Product statuses
    server.get(`${apiPrefix}/settings/product-statuses`, (schema) => {
        return schema.db.productStatusesData
    })

    server.post(
        `${apiPrefix}/settings/product-statuses/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            if (!data.color) data.color = pickRandomColor()
            schema.db.productStatusesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/product-statuses/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.productStatusesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/product-statuses/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: number[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm: number) => {
                schema.db.productStatusesData.remove({ id: elm })
            })
            return true
        },
    )

    // Product categories
    server.get(`${apiPrefix}/settings/product-categories`, (schema) => {
        return schema.db.productCategoriesData
    })

    server.post(
        `${apiPrefix}/settings/product-categories/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            schema.db.productCategoriesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/product-categories/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.productCategoriesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/product-categories/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: (string | number)[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm) => {
                schema.db.productCategoriesData.remove({ id: elm })
            })
            return true
        },
    )

    // Customer statuses
    server.get(`${apiPrefix}/settings/customer-statuses`, (schema) => {
        return schema.db.customerStatusesData
    })

    server.post(
        `${apiPrefix}/settings/customer-statuses/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            if (!data.color) data.color = pickRandomColor()
            schema.db.customerStatusesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/customer-statuses/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.customerStatusesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/customer-statuses/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: (string | number)[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm) => {
                schema.db.customerStatusesData.remove({ id: elm })
            })
            return true
        },
    )

    // Expense statuses
    server.get(`${apiPrefix}/settings/expense-statuses`, (schema) => {
        return schema.db.expenseStatusesData
    })

    server.post(
        `${apiPrefix}/settings/expense-statuses/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            if (!data.color) data.color = pickRandomColor()
            schema.db.expenseStatusesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/expense-statuses/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.expenseStatusesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/expense-statuses/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: (string | number)[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm) => {
                schema.db.expenseStatusesData.remove({ id: elm })
            })
            return true
        },
    )

    // Payment methods
    server.get(`${apiPrefix}/settings/payment-methods`, (schema) => {
        return (schema.db as any).paymentMethodsData || []
    })

    server.post(
        `${apiPrefix}/settings/payment-methods/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            ;(schema.db as any).paymentMethodsData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/settings/payment-methods/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            ;(schema.db as any).paymentMethodsData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/settings/payment-methods/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: (string | number)[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm) => {
                ;(schema.db as any).paymentMethodsData.remove({ id: elm })
            })
            return true
        },
    )
}
