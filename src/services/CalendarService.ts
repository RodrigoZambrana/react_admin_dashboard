import ApiService from './ApiService'

export async function apiGetCalendarActivityDetails<
    T,
    U extends Record<string, unknown>,
>(params: U) {
    return ApiService.fetchData<T>({
        url: '/calendar/activity',
        method: 'get',
        params,
    })
}

