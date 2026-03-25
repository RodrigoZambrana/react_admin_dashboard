import ApiService from './ApiService'

export async function apiGetQaCatalog<T>() {
    return ApiService.fetchData<T>({
        url: '/qa/catalog',
        method: 'get',
    })
}

export async function apiGetQaRuns<T>(params?: { limit?: number }) {
    return ApiService.fetchData<T>({
        url: '/qa/runs',
        method: 'get',
        params,
    })
}

export async function apiGetLatestQaRun<T>() {
    return ApiService.fetchData<T>({
        url: '/qa/runs/latest',
        method: 'get',
    })
}

export async function apiGetQaRunDetails<T>(id: string) {
    return ApiService.fetchData<T>({
        url: `/qa/runs/${id}`,
        method: 'get',
    })
}
