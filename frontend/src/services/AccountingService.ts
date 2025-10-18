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

