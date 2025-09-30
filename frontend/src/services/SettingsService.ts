import ApiService from './ApiService'

export async function apiGetOrderStatuses<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/order-statuses',
        method: 'get',
    })
}

export async function apiCreateOrderStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/order-statuses/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateOrderStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/order-statuses/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteOrderStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/order-statuses/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetProductStatuses<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/product-statuses',
        method: 'get',
    })
}

export async function apiCreateProductStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/product-statuses/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateProductStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/product-statuses/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteProductStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/product-statuses/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetCustomerStatuses<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/customer-statuses',
        method: 'get',
    })
}

export async function apiCreateCustomerStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/customer-statuses/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateCustomerStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/customer-statuses/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteCustomerStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/customer-statuses/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetExpenseStatuses<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/expense-statuses',
        method: 'get',
    })
}

export async function apiCreateExpenseStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/expense-statuses/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateExpenseStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/expense-statuses/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteExpenseStatus<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/expense-statuses/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetProductCategories<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/product-categories',
        method: 'get',
    })
}

export async function apiCreateProductCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/product-categories/create',
        method: 'post',
        data,
    })
}

export async function apiUpdateProductCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/product-categories/update',
        method: 'put',
        data,
    })
}

export async function apiDeleteProductCategory<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/product-categories/delete',
        method: 'delete',
        data,
    })
}

// Payment methods
export async function apiGetPaymentMethods<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/payment-methods',
        method: 'get',
    })
}

export async function apiCreatePaymentMethod<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/payment-methods/create',
        method: 'post',
        data,
    })
}

export async function apiGetSystemConfig<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/system-config',
        method: 'get',
    })
}

export async function apiUpdateSystemConfig<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/system-config',
        method: 'put',
        data,
    })
}

export async function apiUpdatePaymentMethod<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/payment-methods/update',
        method: 'put',
        data,
    })
}

export async function apiDeletePaymentMethod<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/settings/payment-methods/delete',
        method: 'delete',
        data,
    })
}

export async function apiGetCountries<T>() {
    return ApiService.fetchData<T>({
        url: '/settings/countries',
        method: 'get',
    })
}

export async function apiGetCities<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/settings/cities',
        method: 'get',
        params,
    })
}
