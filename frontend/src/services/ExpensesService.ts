import ApiService from './ApiService'

export type ExpenseAttachment = {
    id: string
    name: string
    type?: string
    size?: number
    url?: string
    content?: string
}

const mapApiAttachmentToDto = (attachment: any): ExpenseAttachment => ({
    id: String(attachment.id),
    name: attachment.name,
    type: attachment.mimeType ?? attachment.type ?? undefined,
    size: attachment.size ?? undefined,
    url: attachment.url ?? undefined,
    content: attachment.content ?? undefined,
})

const mapExpenseRecord = (expense: any) => {
    if (!expense || typeof expense !== 'object') {
        return expense
    }
    const record = { ...expense }
    if (record.taxCreditEligible === undefined || record.taxCreditEligible === null) {
        record.taxCreditEligible = true
    } else {
        record.taxCreditEligible = Boolean(record.taxCreditEligible)
    }
    if (Array.isArray(record.attachments)) {
        record.attachments = record.attachments.map(mapApiAttachmentToDto)
    }
    return record
}

export async function apiGetExpensesDashboardData<
    T extends Record<string, unknown>,
    U extends Record<string, unknown>,
>(data?: U) {
    const response = await ApiService.fetchData<T>({
        url: '/expenses/dashboard',
        method: 'post',
        data,
    })
    const payload = response.data as any
    if (payload?.latestExpensesData && Array.isArray(payload.latestExpensesData)) {
        payload.latestExpensesData = payload.latestExpensesData.map(mapExpenseRecord)
    }
    return response
}

export async function apiGetExpenses<T, U extends Record<string, unknown>>(
    params: U,
) {
    const response = await ApiService.fetchData<T>({
        url: '/expenses',
        method: 'get',
        params,
    })
    const payload = response.data as any
    if (payload?.data && Array.isArray(payload.data)) {
        payload.data = payload.data.map(mapExpenseRecord)
    }
    return response
}

export async function apiDeleteExpenses<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/expenses/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetExpense<T, U extends Record<string, unknown>>(
    params: U,
) {
    const response = await ApiService.fetchData<T>({
        url: '/expenses/detail',
        method: 'get',
        params,
    })
    if (response.data) {
        return {
            ...response,
            data: mapExpenseRecord(response.data),
        }
    }
    return response
}

export async function apiCreateExpense<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/expenses/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateExpense<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/expenses/update',
        method: 'put',
        data,
    })
}

export async function apiGetExpenseCategories<T>() {
    return ApiService.fetchData<T>({
        url: '/expenses/categories',
        method: 'get',
    })
}

export async function apiCreateExpenseCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/expenses/categories/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateExpenseCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/expenses/categories/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteExpenseCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/expenses/categories/delete',
        method: 'delete',
        data,
    })
}

export async function apiFetchExpenseAttachment(
    id: string,
    options: { mode?: 'inline' | 'attachment' } = {},
) {
    return ApiService.fetchData<Blob>({
        url: `/expenses/attachments/${id}`,
        method: 'get',
        params: options.mode ? { mode: options.mode } : undefined,
        responseType: 'blob',
    })
}

export async function apiDeleteExpenseAttachment(id: string) {
    await ApiService.fetchData({
        url: `/expenses/attachments/${id}`,
        method: 'delete',
    })
    return id
}
