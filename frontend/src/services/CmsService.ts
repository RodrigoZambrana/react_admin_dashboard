import ApiService from './ApiService'

export async function apiGetCmsSections<T>() {
    return ApiService.fetchData<T>({
        url: '/cms/sections',
        method: 'get',
    })
}

export async function apiGetCmsEntries<T>(params?: Record<string, unknown>) {
    return ApiService.fetchData<T>({
        url: '/cms/entries',
        method: 'get',
        params,
    })
}

export async function apiCreateCmsSection<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/cms/sections',
        method: 'post',
        data,
    })
}

export async function apiUpdateCmsSection<T, U extends Record<string, unknown>>(id: number, data: U) {
    return ApiService.fetchData<T>({
        url: `/cms/sections/${id}`,
        method: 'put',
        data,
    })
}

export async function apiDeleteCmsSection<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/cms/sections/${id}`,
        method: 'delete',
    })
}

export async function apiCreateCmsEntry<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/cms/entries',
        method: 'post',
        data,
    })
}

export async function apiUpdateCmsEntry<T, U extends Record<string, unknown>>(id: number, data: U) {
    return ApiService.fetchData<T>({
        url: `/cms/entries/${id}`,
        method: 'put',
        data,
    })
}

export async function apiDeleteCmsEntry<T>(id: number) {
    return ApiService.fetchData<T>({
        url: `/cms/entries/${id}`,
        method: 'delete',
    })
}
