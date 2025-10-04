import wildCardSearch from '@/utils/wildCardSearch'
import sortBy, { Primer } from '@/utils/sortBy'
import paginate from '@/utils/paginate'
import type { Server } from 'miragejs'

const generateId = () => `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const enrichCustomerPhones = (customer: any) => {
    if (!customer) {
        return customer
    }
    const existingPhones: string[] = Array.isArray(customer.phoneNumbers)
        ? customer.phoneNumbers
        : []
    const personalPhones: string[] = Array.isArray(
        customer.personalInfo?.phoneNumbers,
    )
        ? customer.personalInfo?.phoneNumbers
        : []
    const legacyPhone =
        customer.phoneNumber || customer.personalInfo?.phoneNumber || ''
    const aggregated = Array.from(
        new Set([
            ...existingPhones,
            ...personalPhones,
            ...(legacyPhone ? [legacyPhone] : []),
        ].filter((phone) => typeof phone === 'string' && phone.trim().length > 0)),
    )

    return {
        ...customer,
        phoneNumber: aggregated[0] || customer.phoneNumber || '',
        phoneNumbers: aggregated,
        personalInfo: {
            ...customer.personalInfo,
            phoneNumber:
                aggregated[0] || customer.personalInfo?.phoneNumber || '',
            phoneNumbers: aggregated,
        },
    }
}

const normalizeEventPayload = (payload: Record<string, unknown>) => {
    const now = new Date().toISOString()
    const id = String(payload.id || generateId())
    const extendedProps = {
        ...(payload.extendedProps as Record<string, unknown> | undefined),
    }

    if (extendedProps && extendedProps.description && !extendedProps.detail) {
        extendedProps.detail = extendedProps.description
        delete extendedProps.description
    }

    return {
        id,
        title: payload.title,
        start: payload.start,
        end: payload.end,
        allDay: payload.allDay ?? false,
        eventColor: payload.eventColor || 'blue',
        groupId: payload.groupId,
        extendedProps,
        createdAt: payload.createdAt || now,
        updatedAt: now,
    }
}

export default function crmFakeApi(server: Server, apiPrefix: string) {
    server.get(`${apiPrefix}/crm/dashboard`, (schema) => {
        return schema.db.crmDashboardData[0]
    })

    server.get(`${apiPrefix}/crm/calendar`, (schema) => schema.db.eventsData)

    server.post(`${apiPrefix}/crm/calendar`, (schema, { requestBody }) => {
        const payload = JSON.parse(requestBody)
        const event = normalizeEventPayload(payload)
        schema.db.eventsData.insert(event)
        return schema.db.eventsData
    })

    server.put(`${apiPrefix}/crm/calendar/:id`, (schema, { params, requestBody }) => {
        const payload = JSON.parse(requestBody)
        const id = String(params.id || payload.id)
        const normalized = normalizeEventPayload({ ...payload, id })
        const existing = schema.db.eventsData.findBy({ id })
        if (existing) {
            schema.db.eventsData.update({ id }, normalized)
        } else {
            schema.db.eventsData.insert(normalized)
        }
        return schema.db.eventsData
    })

    server.post(`${apiPrefix}/crm/customers`, (schema, { requestBody }) => {
        const body = JSON.parse(requestBody)
        const { pageIndex, pageSize, sort, query, filterData } = body
        const { order, key } = sort
        const users = schema.db.userDetailData
        const sanitizeUsers = users.filter((elm) => typeof elm !== 'function')
        let data = sanitizeUsers
        let total = users.length

        if (
            filterData &&
            filterData.statusId !== undefined &&
            filterData.statusId !== null &&
            filterData.statusId !== ''
        ) {
            data = data.filter((item: any) => {
                const current = item.statusId ?? item.status
                return (
                    String(current ?? '').toLowerCase() ===
                    String(filterData.statusId ?? '').toLowerCase()
                )
            })
            total = data.length
        }

        if (key && order) {
            if (key !== 'lastOnline') {
                data.sort(
                    sortBy(key, order === 'desc', (a) =>
                        (a as string).toUpperCase(),
                    ),
                )
            } else {
                data.sort(sortBy(key, order === 'desc', parseInt as Primer))
            }
        }

        if (query) {
            data = wildCardSearch(data, query)
            total = data.length
        }

        data = paginate(data, pageSize, pageIndex)

        const responseData = {
            data: data.map(enrichCustomerPhones),
            total: total,
        }
        return responseData
    })

    server.get(`${apiPrefix}/crm/customers-statistic`, () => {
        return {
            totalCustomers: {
                value: 2420,
                growShrink: 17.2,
            },
            activeCustomers: {
                value: 1897,
                growShrink: 32.7,
            },
            newCustomers: {
                value: 241,
                growShrink: -2.3,
            },
        }
    })

    server.get(
        `${apiPrefix}/crm/customer-details`,
        (schema, { queryParams }) => {
            const id = queryParams.id
            const user = schema.db.userDetailData.find(id as string)
            return enrichCustomerPhones(user)
        },
    )

    server.del(
        `${apiPrefix}/crm/customer/delete`,
        (schema, { requestBody }) => {
            const { id } = JSON.parse(requestBody)
            schema.db.userDetailData.remove({ id })
            return {}
        },
    )

    server.put(`${apiPrefix}/crm/customers`, (schema, { requestBody }) => {
        const data = JSON.parse(requestBody)
        const { id } = data
        schema.db.userDetailData.update({ id }, enrichCustomerPhones(data))
        return {}
    })

    server.get(`${apiPrefix}/crm/mails`, (schema, { queryParams }) => {
        const { category } = queryParams
        let data = schema.db.mailData

        if (category === 'sentItem') {
            data = schema.db.mailData.where({ group: 'sentItem' })
        }

        if (category === 'deleted') {
            data = schema.db.mailData.where({ group: 'deleted' })
        }

        if (category === 'draft') {
            data = schema.db.mailData.where({ group: 'draft' })
        }

        if (category === 'starred') {
            data = schema.db.mailData.where({ starred: true })
        }

        if (
            category === 'work' ||
            category === 'private' ||
            category === 'important'
        ) {
            data = schema.db.mailData.where({ label: category })
        }

        return data
    })

    server.get(`${apiPrefix}/crm/mail`, (schema, { queryParams }) => {
        const id = queryParams.id
        const mail = schema.db.mailData.find(id as string)
        return mail
    })
}
