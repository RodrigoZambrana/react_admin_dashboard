import type { AxiosRequestConfig } from 'axios'
import httpClient, { type HttpRequestOptions } from '@/lib/httpClient'

const ApiService = {
    fetchData<Response = unknown, Request = Record<string, unknown>>(
        param: AxiosRequestConfig<Request>,
        options?: HttpRequestOptions,
    ) {
        return httpClient.request<Response, Request>(param, options)
    },
}

export default ApiService
