import ApiService from './ApiService'

export async function apiGetExpensesDashboardData<
    T extends Record<string, unknown>,
>() {
    return ApiService.fetchData<T>({
        url: '/expenses/dashboard',
        method: 'post',
    })
}

export async function apiGetExpenses<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchData<T>({
        url: '/expenses',
        method: 'get',
        params,
    })
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
    return ApiService.fetchData<T>({
        url: '/expenses/detail',
        method: 'get',
        params,
    })
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
