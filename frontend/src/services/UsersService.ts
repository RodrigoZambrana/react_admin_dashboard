import ApiService from './ApiService'

export async function apiGetUsers<T>() {
    return ApiService.fetchData<T>({
        url: '/users',
        method: 'get',
    })
}

type Payload = Record<string, unknown> | FormData

const isFormData = (data: Payload): data is FormData =>
    typeof FormData !== 'undefined' && data instanceof FormData

export async function apiCreateUser<T, U extends Payload>(data: U) {
    return ApiService.fetchData<T>({
        url: '/users',
        method: 'post',
        data,
        headers: isFormData(data)
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
    })
}

export async function apiUpdateUser<T, U extends Payload>(id: string, data: U) {
    return ApiService.fetchData<T>({
        url: `/users/${id}`,
        method: 'put',
        data,
        headers: isFormData(data)
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
    })
}

export async function apiUpdateUserPassword<T>(
    id: string,
    data: { password: string },
) {
    return ApiService.fetchData<T>({
        url: `/users/${id}/password`,
        method: 'put',
        data,
    })
}

export async function apiDeleteUser<T>(id: string) {
    return ApiService.fetchData<T>({
        url: `/users/${id}`,
        method: 'delete',
    })
}
