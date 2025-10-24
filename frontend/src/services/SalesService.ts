import ApiService from './ApiService'

export type SalesDocumentResource = 'orders' | 'budgets'

const documentEndpoint = (resource: SalesDocumentResource) =>
    resource === 'budgets' ? '/budgets' : '/orders'

export async function apiGetSalesDashboardData<
    T extends Record<string, unknown>,
    U extends Record<string, unknown>,
>(data?: U) {
    return ApiService.fetchData<T>({
        url: '/sales/dashboard',
        method: 'post',
        data,
    })
}

export async function apiGetSalesProducts<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/sales/products',
        method: 'post',
        data,
    })
}

export async function apiExportSalesProducts<
    T = Blob,
    U extends Record<string, unknown> = Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/sales/products/export',
        method: 'post',
        data,
        responseType: 'blob',
    })
}

export async function apiImportSalesProducts<T>(data: FormData) {
    return ApiService.fetchData<T>({
        url: '/sales/products/import',
        method: 'post',
        data,
    })
}

export async function apiDeleteSalesProducts<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/sales/products/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetSalesProduct<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/sales/product',
        method: 'get',
        params,
    })
}

export async function apiPutSalesProduct<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/sales/products/update',
        method: 'put',
        data,
    })
}

export async function apiCreateSalesProduct<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/sales/products/create',
        method: 'post',
        data,
    })
}

export async function apiGetSalesOrders<T, U extends Record<string, unknown>>(
    params: U,
    resource: SalesDocumentResource = 'orders',
) {
    return ApiService.fetchData<T>({
        url: documentEndpoint(resource),
        method: 'get',
        params,
    })
}

export async function apiDeleteSalesOrders<
    T,
    U extends Record<string, unknown>,
>(data: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: documentEndpoint(resource),
        method: 'delete',
        data,
    })
}

export async function apiExportSalesOrders<
    T = Blob,
    U extends Record<string, unknown> = Record<string, unknown>,
>(params: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/export`,
        method: 'get',
        params,
        responseType: 'blob',
    })
}

export async function apiImportSalesOrders<T>(data: FormData, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/import`,
        method: 'post',
        data,
    })
}

export async function apiGetSalesOrderDetails<
    T,
    U extends Record<string, unknown>,
>(params: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${(params as any).id}/details`,
        method: 'get',
    })
}

export async function apiUpdateSalesOrderStatus<
    T,
    U extends Record<string, unknown>,
>(data: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${(data as any).id}/status`,
        method: 'put',
        data,
    })
}

export async function apiUpdateSalesOrderPaymentMethod<
    T,
    U extends Record<string, unknown>,
>(data: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${(data as any).id}/payment-method`,
        method: 'put',
        data,
    })
}

export async function apiPersistSalesDocumentFile<
    T,
>(id: number, data: FormData, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${id}/document`,
        method: 'post',
        data,
    })
}

// Orders CRUD
export async function apiGetSalesOrder<T, U extends Record<string, unknown>>(
    params: U,
    resource: SalesDocumentResource = 'orders',
) {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${(params as any).id}/details`,
        method: 'get',
    })
}

export async function apiCreateSalesOrder<
    T,
    U extends Record<string, unknown>,
>(data: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: documentEndpoint(resource),
        method: 'post',
        data,
    })
}

export async function apiSaveSalesOrder<
    T,
    U extends Record<string, unknown>,
>(data: U, resource: SalesDocumentResource = 'orders') {
    return ApiService.fetchData<T>({
        url: `${documentEndpoint(resource)}/${(data as any).id}`,
        method: 'put',
        data,
    })
}

export async function apiSendBudget<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/budgets/${id}/send`,
        method: 'post',
    })
}

export async function apiConfirmBudget<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/budgets/${id}/confirm`,
        method: 'post',
    })
}
