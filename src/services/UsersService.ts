import ApiService from './ApiService'

export async function apiGetUsers<T>() {
    return ApiService.fetchData<T>({
        url: '/users',
        method: 'get',
    })
}

export async function apiCreateUser<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/users',
        method: 'post',
        data,
    })
}

export async function apiUpdateUser<T, U extends Record<string, unknown>>(id: string, data: U) {
    return ApiService.fetchData<T>({
        url: `/users/${id}`,
        method: 'put',
        data,
    })
}
