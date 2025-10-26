import ApiService from './ApiService'

type QueryParams = Record<string, unknown>

export async function apiGetProductionOrders<T>(params?: QueryParams) {
    return ApiService.fetchData<T>({
        url: '/production-orders',
        method: 'get',
        params,
    })
}

export async function apiGetProductionOrdersSummary<T>() {
    return ApiService.fetchData<T>({
        url: '/production-orders/summary',
        method: 'get',
    })
}

export async function apiGetProductionOrdersStats<T>() {
    return ApiService.fetchData<T>({
        url: '/production-orders/stats',
        method: 'get',
    })
}

export async function apiGetProductionOrder<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/production-orders/${id}`,
        method: 'get',
    })
}

export async function apiCreateProductionOrder<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/production-orders',
        method: 'post',
        data,
    })
}

export async function apiUpdateProductionOrder<T, U extends Record<string, unknown>>(id: number, data: U) {
    return ApiService.fetchData<T>({
        url: `/production-orders/${id}`,
        method: 'put',
        data,
    })
}

export async function apiDeleteProductionOrder<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/production-orders/${id}`,
        method: 'delete',
    })
}
