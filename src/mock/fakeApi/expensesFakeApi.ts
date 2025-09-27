import wildCardSearch from '@/utils/wildCardSearch'
import sortBy, { Primer } from '@/utils/sortBy'
import paginate from '@/utils/paginate'
import type { Server } from 'miragejs'

export default function expensesFakeApi(server: Server, apiPrefix: string) {
    server.post(`${apiPrefix}/expenses/dashboard`, (schema) => {
        return schema.db.expensesDashboardData[0]
    })

    server.get(`${apiPrefix}/expenses`, (schema, { queryParams }) => {
        const { pageIndex, pageSize, query } = queryParams
        const order = queryParams['sort[order]']
        const key = queryParams['sort[key]']
        const expenses = schema.db.expensesData
        const sanitized = expenses.filter((elm) => typeof elm !== 'function')
        let data = sanitized
        let total = expenses.length

        if (key) {
            if ((key === 'date' || key === 'status' || key === 'amount') && order) {
                data.sort(sortBy(key, order === 'desc', parseInt as Primer))
            } else if (order) {
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

        const responseData = { data, total }
        return responseData
    })

    server.del(`${apiPrefix}/expenses/delete`, (schema, { requestBody }) => {
        const { id } = JSON.parse(requestBody)
        const ids: string[] = Array.isArray(id) ? id : [id]
        ids.forEach((elm: string) => {
            schema.db.expensesData.remove({ id: elm })
        })
        return true
    })

    server.get(`${apiPrefix}/expenses/detail`, (schema, { queryParams }) => {
        const { id } = queryParams
        const expense = schema.db.expensesData.find(id as string)
        return expense
    })

    server.post(`${apiPrefix}/expenses/create`, (schema, { requestBody }) => {
        const data = JSON.parse(requestBody)
        schema.db.expensesData.insert(data)
        return true
    })

    server.put(`${apiPrefix}/expenses/update`, (schema, { requestBody }) => {
        const data = JSON.parse(requestBody)
        const { id } = data
        schema.db.expensesData.update({ id }, data)
        return true
    })

    // Categories endpoints
    server.get(`${apiPrefix}/expenses/categories`, (schema) => {
        const categories = schema.db.expenseCategoriesData
        return categories
    })

    server.post(
        `${apiPrefix}/expenses/categories/create`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            schema.db.expenseCategoriesData.insert(data)
            return true
        },
    )

    server.put(
        `${apiPrefix}/expenses/categories/update`,
        (schema, { requestBody }) => {
            const data = JSON.parse(requestBody)
            const { id } = data
            schema.db.expenseCategoriesData.update({ id }, data)
            return true
        },
    )

    server.del(
        `${apiPrefix}/expenses/categories/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            const ids: string[] = Array.isArray(id) ? id : [id]
            ids.forEach((elm: string) => {
                schema.db.expenseCategoriesData.remove({ id: elm })
            })
            return true
        },
    )
}
