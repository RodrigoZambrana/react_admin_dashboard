import ApiService from './ApiService'

export async function apiGetAccountingDashboardData<
    T extends Record<string, unknown>,
    U extends Record<string, unknown>,
>(data?: U) {
    return ApiService.fetchData<T>({
        url: '/accounting/dashboard',
        method: 'post',
        data,
    })
}

export async function apiGetPayments<T, U extends Record<string, unknown>>(params?: U) {
    return ApiService.fetchData<T>({
        url: '/accounting/payments',
        method: 'get',
        params,
    })
}

export async function apiGetPayment<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/accounting/payments/${id}`,
        method: 'get',
    })
}

export async function apiCreatePayment<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/accounting/payments',
        method: 'post',
        data,
    })
}

export async function apiUpdatePayment<T, U extends Record<string, unknown>>(id: number, data: U) {
    return ApiService.fetchData<T>({
        url: `/accounting/payments/${id}`,
        method: 'put',
        data,
    })
}

export async function apiDeletePayment<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/accounting/payments/${id}`,
        method: 'delete',
    })
}
