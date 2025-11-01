import { createApi } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosRequestConfig } from 'axios'
import httpClient, { isApiError, ApiError } from '@/lib/httpClient'

const axiosBaseQuery =
    (): BaseQueryFn<
        {
            url: string
            method: AxiosRequestConfig['method']
            data?: AxiosRequestConfig['data']
            params?: AxiosRequestConfig['params']
        },
        unknown,
        unknown
    > =>
    async (request) => {
        try {
            const response = await httpClient.request(request)
            return response
        } catch (error) {
            if (isApiError(error)) {
                const apiError = error as ApiError
                return {
                    error: {
                        status: apiError.status,
                        data: {
                            message: apiError.message,
                            code: apiError.code,
                            correlationId: apiError.correlationId,
                            details: apiError.details,
                        },
                    },
                }
            }
            throw error
        }
    }

const RtkQueryService = createApi({
    reducerPath: 'rtkApi',
    baseQuery: axiosBaseQuery(),
    endpoints: () => ({}),
})

export default RtkQueryService
