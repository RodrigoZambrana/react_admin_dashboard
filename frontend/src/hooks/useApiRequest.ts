import { useCallback, useEffect, useRef, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import apiClient, { ApiError, CircuitOpenError } from '@/lib/httpClient'
import { createCorrelationId } from '@/lib/httpClient'

interface RequestContext {
    signal: AbortSignal
    correlationId: string
}

export interface UseApiRequestOptions<TData, TTransformed = TData> {
    initialData?: TTransformed
    enabled?: boolean
    select?: (data: TData) => TTransformed
    keepPreviousData?: boolean
    watch?: readonly unknown[]
}

export interface UseApiRequestResult<TData> {
    data: TData | undefined
    error: ApiError | undefined
    isLoading: boolean
    isStale: boolean
    correlationId: string | undefined
    refetch: () => Promise<void>
    resetError: () => void
    isAutoRefreshing: boolean
}

type RequestFactory<TData> = (ctx: RequestContext) => Promise<TData>

export function axiosRequestFactory<TData = unknown>(
    config: AxiosRequestConfig,
): RequestFactory<TData> {
    return async ({ correlationId, signal }) => {
        const response = await apiClient.request<TData>(
            { ...config, signal },
            { correlationId },
        )
        return response.data
    }
}

export function useApiRequest<TData, TTransformed = TData>(
    requestFactory: RequestFactory<TData>,
    options: UseApiRequestOptions<TData, TTransformed> = {},
): UseApiRequestResult<TTransformed> {
    const {
        enabled = true,
        watch = [],
        initialData,
        select,
        keepPreviousData = true,
    } = options

    const controllerRef = useRef<AbortController | null>(null)
    const inFlightRef = useRef<boolean>(false)

    const [data, setData] = useState<TTransformed | undefined>(initialData)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    const [isLoading, setIsLoading] = useState<boolean>(enabled)
    const [isStale, setIsStale] = useState<boolean>(false)
    const [correlationId, setCorrelationId] = useState<string | undefined>(undefined)
    const lastSuccessfulDataRef = useRef<TTransformed | undefined>(initialData)

    const execute = useCallback(async () => {
        if (!enabled) {
            return
        }

        controllerRef.current?.abort()
        const controller = new AbortController()
        controllerRef.current = controller
        const nextCorrelationId = createCorrelationId()
        setCorrelationId(nextCorrelationId)
        setIsLoading(true)
        inFlightRef.current = true

        try {
            const payload = await requestFactory({
                signal: controller.signal,
                correlationId: nextCorrelationId,
            })
            const transformed = select ? select(payload) : ((payload as unknown) as TTransformed)
            lastSuccessfulDataRef.current = transformed
            setData(transformed)
            setError(undefined)
            setIsStale(false)
        } catch (rawError) {
            if (rawError instanceof ApiError) {
                if (rawError.isCancellation) {
                    return
                }
                setError(rawError)
                if (keepPreviousData && lastSuccessfulDataRef.current !== undefined) {
                    setData(lastSuccessfulDataRef.current)
                    setIsStale(true)
                } else {
                    setData(undefined)
                }
                if (rawError instanceof CircuitOpenError && keepPreviousData && lastSuccessfulDataRef.current !== undefined) {
                    setIsStale(true)
                }
            } else if (rawError instanceof DOMException && rawError.name === 'AbortError') {
                return
            } else {
                throw rawError
            }
        } finally {
            inFlightRef.current = false
            if (!controller.signal.aborted) {
                setIsLoading(false)
            }
        }
    }, [enabled, keepPreviousData, requestFactory, select])

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false)
            return () => controllerRef.current?.abort()
        }
        execute()
        return () => controllerRef.current?.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, watch)

    const refetch = useCallback(async () => {
        await execute()
    }, [execute])

    const resetError = useCallback(() => {
        setError(undefined)
    }, [])

    return {
        data,
        error,
        isLoading,
        isStale,
        correlationId,
        refetch,
        resetError,
        isAutoRefreshing: inFlightRef.current,
    }
}

export default useApiRequest
