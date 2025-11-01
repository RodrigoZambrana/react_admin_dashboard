import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import httpClient from '@/lib/httpClient'

const ApiService = {
    fetchData<Response = unknown, Request = Record<string, unknown>>(
        param: AxiosRequestConfig<Request>,
    ) {
        return httpClient.request<Response, Request>(param)
    },
}

export default ApiService
