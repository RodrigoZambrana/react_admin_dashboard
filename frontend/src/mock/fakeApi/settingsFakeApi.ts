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

    // Email categories
    server.get(`${apiPrefix}/settings/email/categories`, (schema) => {
        return (schema.db as any).emailSettingsData || []
    })

    server.put(`${apiPrefix}/settings/email/categories/:category`, (schema, request) => {
        const category = String(request.params.category || '').toUpperCase()
        const body = JSON.parse(request.requestBody || '{}')
        const emailSettingsDb = (schema.db as any).emailSettingsData
        const existing = emailSettingsDb?.findBy ? emailSettingsDb.findBy({ category }) : null
        const existingList: any[] =
            emailSettingsDb?.all && typeof emailSettingsDb.all === 'function'
                ? emailSettingsDb.all()
                : Array.isArray(emailSettingsDb)
                  ? emailSettingsDb
                  : []
        const nextId = existingList.length ? Math.max(...existingList.map((item) => item.id ?? 0)) + 1 : 1
        const payload = {
            ...(existing || {
                id: nextId,
                category,
            }),
            fromAddress: body.fromAddress ?? existing?.fromAddress ?? 'desarrollo@software-strategy.com',
            fromName: body.fromName ?? existing?.fromName ?? 'Software Strategy',
            adminRecipients: body.adminRecipients ?? existing?.adminRecipients ?? [],
            cc: body.cc ?? existing?.cc ?? [],
            bcc: body.bcc ?? existing?.bcc ?? [],
            enabled: typeof body.enabled === 'boolean' ? body.enabled : existing?.enabled ?? true,
            updatedAt: new Date().toISOString(),
        }
        if (existing) {
            emailSettingsDb.update({ category }, payload)
            return payload
        }
        emailSettingsDb.insert(payload)
        return payload
    })

    // Email provider configuration
    server.get(`${apiPrefix}/settings/email/config`, (schema) => {
        const collection = (schema.db as any).emailProviderConfigData
        const existing = collection?.first ? collection.first() : collection?.[0]
        if (!existing) {
            return {
                provider: 'DEV',
                fromAddress: 'noreply@example.com',
                fromName: 'Demo Sender',
                smtp: null,
            }
        }
        const sanitized = {
            provider: existing.provider,
            fromAddress: existing.fromAddress,
            fromName: existing.fromName,
            smtp: existing.smtp
                ? {
                      ...existing.smtp,
                      password: null,
                  }
                : null,
        }
        return sanitized
    })

    server.put(`${apiPrefix}/settings/email/config`, (schema, request) => {
        const collection = (schema.db as any).emailProviderConfigData
        const body = JSON.parse(request.requestBody || '{}')
        const existing = collection?.first ? collection.first() : collection?.[0]
        const id = existing?.id ?? 1
        const provider = String(body.provider || existing?.provider || 'DEV').toUpperCase()
        const currentSmtp = existing?.smtp ?? null
        const nextSmtp =
            provider === 'SMTP'
                ? {
                      host: body.smtp?.host ?? currentSmtp?.host ?? '',
                      port: body.smtp?.port ?? currentSmtp?.port ?? 587,
                      secure: body.smtp?.secure ?? currentSmtp?.secure ?? false,
                      allowInvalidCerts: body.smtp?.allowInvalidCerts ?? currentSmtp?.allowInvalidCerts ?? false,
                      user: body.smtp?.user ?? currentSmtp?.user ?? null,
                      password:
                          body.smtp?.password !== undefined && body.smtp?.password !== null && body.smtp?.password !== ''
                              ? body.smtp?.password
                              : currentSmtp?.password ?? null,
                  }
                : null

        const record = {
            id,
            provider,
            fromAddress: body.fromAddress ?? existing?.fromAddress ?? 'noreply@example.com',
            fromName: body.fromName ?? existing?.fromName ?? 'Demo Sender',
            smtp: nextSmtp,
        }

        if (collection?.update) {
            collection.update({ id }, record)
        } else if (collection?.insert) {
            collection.insert(record)
        }

        return {
            provider: record.provider,
            fromAddress: record.fromAddress,
            fromName: record.fromName,
            smtp: record.smtp
                ? {
                      ...record.smtp,
                      password: null,
                  }
                : null,
        }
    })

    server.post(`${apiPrefix}/settings/email/config/test`, () => ({ ok: true }))

    // Inbox accounts
    server.get(`${apiPrefix}/inbox/accounts`, (schema, request) => {
        const accounts = (schema.db as any).inboxAccountsData || []
        const channel = String(request.queryParams?.channel || '').trim().toUpperCase()
        const includeInactive =
            request.queryParams?.includeInactive === 'true' ||
            request.queryParams?.includeInactive === true

        return accounts.filter((account: any) => {
            if (channel && String(account.channel || '').trim().toUpperCase() !== channel) {
                return false
            }
            if (!includeInactive && account.active === false) {
                return false
            }
            return true
        })
    })

    server.post(`${apiPrefix}/inbox/accounts`, (schema, request) => {
        const body = JSON.parse(request.requestBody || '{}')
        const collection = (schema.db as any).inboxAccountsData
        const nextId =
            collection?.all && typeof collection.all === 'function'
                ? collection.all().length + 1
                : Array.isArray(collection)
                  ? collection.length + 1
                  : 1
        const record = {
            id: `acc_${nextId}`,
            channel: 'EMAIL',
            address: String(body.address || '').trim().toLowerCase(),
            displayName: body.displayName ?? null,
            active: body.active !== undefined ? Boolean(body.active) : true,
            metadata: body.metadata ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        collection.insert(record)
        return record
    })

    server.put(`${apiPrefix}/inbox/accounts/:accountId`, (schema, request) => {
        const body = JSON.parse(request.requestBody || '{}')
        const collection = (schema.db as any).inboxAccountsData
        const existing = collection.findBy({ id: request.params.accountId })
        if (!existing) {
            return null
        }
        const payload = {
            ...existing,
            address:
                body.address !== undefined
                    ? String(body.address || '').trim().toLowerCase()
                    : existing.address,
            displayName:
                body.displayName !== undefined
                    ? body.displayName ?? null
                    : existing.displayName,
            active:
                body.active !== undefined ? Boolean(body.active) : existing.active,
            metadata:
                body.metadata !== undefined ? body.metadata ?? null : existing.metadata,
            updatedAt: new Date().toISOString(),
        }
        collection.update({ id: request.params.accountId }, payload)
        return payload
    })

    server.del(`${apiPrefix}/inbox/accounts/:accountId`, (schema, request) => {
        const collection = (schema.db as any).inboxAccountsData
        const existing = collection.findBy({ id: request.params.accountId })
        if (!existing) {
            return null
        }
        const payload = {
            ...existing,
            active: false,
            updatedAt: new Date().toISOString(),
        }
        collection.update({ id: request.params.accountId }, payload)
        return payload
    })

    // Email rules
    server.get(`${apiPrefix}/settings/email/rules`, (schema) => {
        return (schema.db as any).emailRoleRulesData || []
    })

    server.get(`${apiPrefix}/settings/email/rules/options`, () => {
        return ['SUPERADMIN', 'ADMIN', 'OPS', 'SALES', 'FINANCE', 'USER']
    })

    server.post(`${apiPrefix}/settings/email/rules`, (schema, request) => {
        const body = JSON.parse(request.requestBody || '{}')
        const roleRulesDb = (schema.db as any).emailRoleRulesData
        const existingList: any[] =
            roleRulesDb?.all && typeof roleRulesDb.all === 'function'
                ? roleRulesDb.all()
                : Array.isArray(roleRulesDb)
                  ? roleRulesDb
                  : []
        const nextId = existingList.length ? Math.max(...existingList.map((item) => item.id ?? 0)) + 1 : 1
        const record = {
            id: nextId,
            role: body.role ?? 'ADMIN',
            categories: Array.from(new Set(body.categories ?? ['ORDERS'])),
            enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        roleRulesDb.insert(record)
        return record
    })

    server.put(`${apiPrefix}/settings/email/rules/:id`, (schema, request) => {
        const id = Number(request.params.id)
        const body = JSON.parse(request.requestBody || '{}')
        const roleRulesDb = (schema.db as any).emailRoleRulesData
        const existing = roleRulesDb.findBy({ id })
        if (!existing) {
            return null
        }
        const payload = {
            ...existing,
            role: body.role ?? existing.role,
            categories: Array.from(new Set(body.categories ?? existing.categories)),
            enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
            updatedAt: new Date().toISOString(),
        }
        roleRulesDb.update({ id }, payload)
        return payload
    })

    server.del(`${apiPrefix}/settings/email/rules/:id`, (schema, request) => {
        const id = Number(request.params.id)
        ;(schema.db as any).emailRoleRulesData.remove({ id })
        return { ok: true }
    })

    // Email logs
    server.get(`${apiPrefix}/settings/email/logs`, (schema, request) => {
        const take = Number(request.queryParams['take'] ?? 25)
        const cursorParam = request.queryParams['cursor']
        const categoryParam = request.queryParams['category']
        const statusParam = request.queryParams['status']
        const recipientParam = request.queryParams['recipientType']
        const searchParam = (request.queryParams['search'] || '').toLowerCase()
        const fromParam = request.queryParams['from']
        const toParam = request.queryParams['to']

        const fromDate = fromParam ? new Date(fromParam) : null
        const toDate = toParam ? new Date(toParam) : null

        let logs: any[] = ((schema.db as any).emailLogsData || []).slice()
        logs.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        if (categoryParam) {
            const normalized = String(categoryParam).toUpperCase()
            logs = logs.filter((log) => log.category === normalized)
        }
        if (statusParam) {
            const normalized = String(statusParam).toUpperCase()
            logs = logs.filter((log) => log.status === normalized)
        }
        if (recipientParam) {
            const normalized = String(recipientParam).toUpperCase()
            logs = logs.filter((log) => log.recipientType === normalized)
        }
        if (searchParam) {
            logs = logs.filter((log) => {
                const haystack = `${log.subject} ${log.toAddress}`.toLowerCase()
                return haystack.includes(searchParam)
            })
        }
        if (fromDate && !Number.isNaN(fromDate.getTime())) {
            logs = logs.filter((log) => new Date(log.createdAt).getTime() >= fromDate.getTime())
        }
        if (toDate && !Number.isNaN(toDate.getTime())) {
            logs = logs.filter((log) => new Date(log.createdAt).getTime() <= toDate.getTime())
        }
        let startIndex = 0
        if (cursorParam) {
            const cursor = Number(cursorParam)
            const cursorIndex = logs.findIndex((log) => log.id === cursor)
            if (cursorIndex >= 0) {
                startIndex = cursorIndex + 1
            }
        }
        const paged = logs.slice(startIndex, startIndex + take)
        const nextCursor =
            startIndex + take < logs.length ? logs[startIndex + take]?.id ?? null : null
        return {
            logs: paged,
            nextCursor,
        }
    })

    // Email test send
    server.post(`${apiPrefix}/email/test`, (schema, request) => {
        const body = JSON.parse(request.requestBody || '{}')
        const emailLogsDb = (schema.db as any).emailLogsData
        const existingList: any[] =
            emailLogsDb?.all && typeof emailLogsDb.all === 'function'
                ? emailLogsDb.all()
                : Array.isArray(emailLogsDb)
                  ? emailLogsDb
                  : []
        const nextId = existingList.length ? Math.max(...existingList.map((item) => item.id ?? 0)) + 1 : 100
        const newLog = {
            id: nextId,
            category: (body.category || 'ORDERS').toUpperCase(),
            templateId: null,
            locale: body.locale || 'en',
            recipientType: (body.variant === 'ADMIN' ? 'ADMIN' : 'CUSTOMER') as 'ADMIN' | 'CUSTOMER',
            toAddress: body.to || 'desarrollo@software-strategy.com',
            ccAddresses: [],
            bccAddresses: [],
            subject: `[Test] ${body.category ?? 'Email test'}`,
            status: 'QUEUED',
            providerMessageId: null,
            errorMessage: null,
            attempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAttemptAt: null,
        }
        emailLogsDb.insert(newLog)
        return {
            ok: true,
            message: 'Test email queued successfully.',
        }
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
