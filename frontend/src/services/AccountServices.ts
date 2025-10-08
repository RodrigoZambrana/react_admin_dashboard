import ApiService from './ApiService'

export async function apiGetAccountSettingData<T>() {
    return ApiService.fetchData<T>({
        url: '/account/setting',
        method: 'get',
    })
}

export async function apiGetAccountSettingIntegrationData<T>() {
    return ApiService.fetchData<T>({
        url: '/account/setting/integration',
        method: 'get',
    })
}

export async function apiGetAccountSettingBillingData<T>() {
    return ApiService.fetchData<T>({
        url: '/account/setting/billing',
        method: 'get',
    })
}

export async function apiGetAccountInvoiceData<
    T,
    U extends Record<string, unknown>,
>(params: U) {
    return ApiService.fetchData<T>({
        url: '/account/invoice',
        method: 'get',
        params,
    })
}

export async function apiGetAccountLogData<
    T,
    U extends Record<string, unknown>,
>(data: U) {
    return ApiService.fetchData<T>({
        url: '/account/log',
        method: 'post',
        data,
    })
}

export async function apiGetAccountFormData<T>() {
    return ApiService.fetchData<T>({
        url: '/account/form',
        method: 'get',
    })
}

type ProfilePayload = Record<string, unknown> | FormData

const isFormData = (data: ProfilePayload): data is FormData =>
    typeof FormData !== 'undefined' && data instanceof FormData

export async function apiUpdateAccountProfile<T, U extends ProfilePayload>(data: U) {
    return ApiService.fetchData<T>({
        url: '/account/setting/profile',
        method: 'put',
        data,
        headers: isFormData(data)
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
    })
}

export async function apiUpdateAccountPassword<T, U extends Record<string, unknown>>(data: U) {
    return ApiService.fetchData<T>({
        url: '/account/setting/password',
        method: 'put',
        data,
    })
}
