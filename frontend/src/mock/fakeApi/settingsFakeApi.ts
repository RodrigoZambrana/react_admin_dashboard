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

const defaultCustomerStatuses = [
    { id: 1, name: 'Active', color: '#10b981' },
    { id: 2, name: 'Suspended', color: '#f59e0b' },
    { id: 3, name: 'Blocked', color: '#ef4444' },
]

export default function settingsFakeApi(server: Server, apiPrefix: string) {

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
    server.get(`${apiPrefix}/settings/customer-statuses`, () => {
        return defaultCustomerStatuses
    })

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

    // Payment methods (read-only)
    server.get(`${apiPrefix}/payment-methods`, (schema) => {
        return (schema.db as any).paymentMethodsData || []
    })

    // Order statuses (read-only)
    server.get(`${apiPrefix}/order-statuses`, (schema, request) => {
        const data: any[] = (schema.db as any).orderStatusesData || []
        const documentType = request.queryParams['documentType']
        if (documentType) {
            return data.filter((status) =>
                Array.isArray(status.documentTypes)
                    ? status.documentTypes.includes(documentType.toUpperCase())
                    : true,
            )
        }
        return data
    })

    // Email templates
    server.get(`${apiPrefix}/settings/email/templates`, (schema) => {
        return (schema.db as any).emailTemplatesData || []
    })

    server.get(`${apiPrefix}/settings/email/templates/:id`, (schema, request) => {
        const id = Number(request.params.id)
        return (schema.db as any).emailTemplatesData.findBy({ id }) || null
    })

    server.put(`${apiPrefix}/settings/email/templates/:id`, (schema, request) => {
        const id = Number(request.params.id)
        const data = JSON.parse(request.requestBody || '{}')
        const existing = (schema.db as any).emailTemplatesData.findBy({ id })
        if (!existing) {
            return null
        }
        const payload = {
            ...existing,
            subject: data.subject ?? existing.subject,
            body: data.body ?? existing.body,
            active: data.active ?? existing.active,
            updatedAt: new Date().toISOString(),
        }
        return (schema.db as any).emailTemplatesData.update({ id }, payload)
    })

    server.post(`${apiPrefix}/settings/email/templates/:id/preview`, (schema, request) => {
        const id = Number(request.params.id)
        const template = (schema.db as any).emailTemplatesData.findBy({ id })
        const body = JSON.parse(request.requestBody || '{}')
        const scenarioLabel = body.scenarioKey || 'default'
        const baseSubject = template?.subject?.replace(/\{\{.*?\}\}/g, 'MOCK') ?? 'Preview message'
        return {
            subject: `[Preview] ${baseSubject}`,
            html: `<div style="padding:16px;font-family:Arial,sans-serif;"><h2>Mock preview for template ${id}</h2><p>Scenario: ${scenarioLabel}</p><p>This content is generated by the Mirage mock API.</p></div>`,
            text: `Mock preview for template ${id} (scenario: ${scenarioLabel})`,
        }
    })

    server.get(`${apiPrefix}/settings/email/templates/:id/samples`, (schema, request) => {
        const locale = (request.queryParams['locale'] || 'en').toLowerCase()
        const isSpanish = locale.startsWith('es')
        const translate = (en: string, es: string) => (isSpanish ? es : en)
        return {
            options: [
                { key: 'order.received', label: translate('Order received (basic)', 'Pedido recibido (básico)') },
                { key: 'order.paid', label: translate('Order paid', 'Pedido pagado') },
                { key: 'order.delivered', label: translate('Order delivered', 'Pedido entregado') },
                { key: 'order.cancelled', label: translate('Order cancelled', 'Pedido cancelado') },
                { key: 'order.cash', label: translate('Cash on delivery', 'Pago en efectivo') },
                { key: 'order.large', label: translate('Large order with services', 'Pedido grande con servicios') },
                { key: 'budget.created', label: translate('Budget draft', 'Presupuesto borrador') },
                { key: 'budget.sent', label: translate('Budget sent to customer', 'Presupuesto enviado al cliente') },
                { key: 'budget.accepted', label: translate('Budget accepted', 'Presupuesto aceptado') },
                { key: 'budget.converted', label: translate('Budget converted to order', 'Presupuesto convertido en pedido') },
                { key: 'budget.expired', label: translate('Budget expired', 'Presupuesto expirado') },
                { key: 'budget.cancelled', label: translate('Budget cancelled', 'Presupuesto cancelado') },
            ],
        }
    })

    server.get(`${apiPrefix}/settings/email/metrics`, (schema) => {
        return (schema.db as any).emailMetricsData || {
            totals: { attempts: 0, sent: 0, failed: 0 },
            perCategory: {},
            perTemplate: {},
        }
    })
}
