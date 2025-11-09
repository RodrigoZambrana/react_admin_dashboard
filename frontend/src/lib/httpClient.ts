import { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, isAxiosError } from 'axios'
import BaseService from '@/services/BaseService'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY_DELAYS_MS = [500, 1_500]
const CIRCUIT_FAILURE_THRESHOLD = 5
const CIRCUIT_FAILURE_WINDOW_MS = 60_000
const CIRCUIT_OPEN_INTERVAL_MS = 45_000
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

type CircuitState = 'closed' | 'open' | 'half_open'

interface CircuitEntry {
    state: CircuitState
    failureCount: number
    firstFailureAt: number
    nextAttemptAt: number
    openedAt?: number
}

export interface StandardErrorBody {
    code: string
    httpStatus: number
    message: string
    details?: unknown
    correlationId?: string
    timestamp?: string
}

export interface StandardErrorEnvelope {
    ok: false
    error: StandardErrorBody
}

export interface HttpRequestOptions {
    timeoutMs?: number
    retryDelaysMs?: number[]
    circuitId?: string
    correlationId?: string
    onRetry?: (attempt: number, error: ApiError) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const generateCorrelationId = () =>
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2)

const mapStatusToCode = (status: number): string => {
    switch (status) {
        case 401:
            return 'AUTH.UNAUTHORIZED'
        case 403:
            return 'AUTH.FORBIDDEN'
        case 404:
            return 'NOT_FOUND'
        case 408:
            return 'BACKEND.TIMEOUT'
        case 409:
            return 'CONFLICT'
        case 422:
            return 'VALIDATION.FAILED'
        case 429:
            return 'RATE.LIMITED'
        case 503:
            return 'DB.CONNECTION'
        case 504:
            return 'BACKEND.TIMEOUT'
        default:
            return 'UNKNOWN'
    }
}

const isRetryable = (status: number, code?: string, isNetworkError = false, isTimeout = false): boolean => {
    if (isNetworkError || isTimeout) {
        return true
    }
    if (status === 0) {
        return true
    }
    if (RETRYABLE_STATUS.has(status)) {
        return true
    }
    if (!code) {
        return false
    }
    return ['RATE.LIMITED', 'BACKEND.TIMEOUT', 'DB.TIMEOUT', 'DB.CONNECTION', 'DB.PANIC'].includes(code)
}

const affectsCircuit = (
    status: number,
    code?: string,
    isNetworkError = false,
    isTimeout = false,
    isCancellation = false,
): boolean => {
    if (isCancellation) {
        return false
    }
    if (isNetworkError || isTimeout) {
        return true
    }
    if (status === 0) {
        return true
    }
    if (RETRYABLE_STATUS.has(status)) {
        return true
    }
    if (!code) {
        return status >= 500
    }
    return ['RATE.LIMITED', 'BACKEND.TIMEOUT', 'DB.TIMEOUT', 'DB.CONNECTION', 'DB.PANIC', 'UNKNOWN'].includes(code) || status >= 500
}

export class ApiError extends Error {
    status: number
    code: string
    details?: unknown
    correlationId?: string
    timestamp?: string
    retryAfter?: number
    retryable: boolean
    affectsCircuit: boolean
    isNetworkError: boolean
    isTimeout: boolean
    isCancellation: boolean

    constructor(params: {
        status: number
        code?: string
        message: string
        details?: unknown
        correlationId?: string
        timestamp?: string
        retryAfter?: number
        retryable?: boolean
        affectsCircuit?: boolean
        isNetworkError?: boolean
        isTimeout?: boolean
        isCancellation?: boolean
    }) {
        super(params.message)
        this.status = params.status
        this.code = params.code ?? mapStatusToCode(params.status)
        this.details = params.details
        this.correlationId = params.correlationId
        this.timestamp = params.timestamp
        this.retryAfter = params.retryAfter
        this.isNetworkError = params.isNetworkError ?? false
        this.isTimeout = params.isTimeout ?? false
        this.isCancellation = params.isCancellation ?? false
        this.retryable =
            params.retryable ?? isRetryable(params.status, params.code, this.isNetworkError, this.isTimeout)
        this.affectsCircuit =
            params.affectsCircuit ?? affectsCircuit(params.status, params.code, this.isNetworkError, this.isTimeout, this.isCancellation)
    }

    static fromEnvelope(envelope: StandardErrorEnvelope, fallbackStatus: number, correlationId?: string, retryAfter?: number) {
        const { error } = envelope
        return new ApiError({
            status: error.httpStatus ?? fallbackStatus,
            code: error.code ?? mapStatusToCode(fallbackStatus),
            message: error.message ?? 'errors.unknown',
            details: error.details,
            correlationId: error.correlationId ?? correlationId,
            timestamp: error.timestamp,
            retryAfter,
            retryable: isRetryable(error.httpStatus ?? fallbackStatus, error.code),
            affectsCircuit: affectsCircuit(error.httpStatus ?? fallbackStatus, error.code),
        })
    }
}

export class CircuitOpenError extends ApiError {
    readonly nextAttemptAt: number
    readonly circuitId: string

    constructor(params: { circuitId: string; correlationId: string; nextAttemptAt: number }) {
        super({
            status: 503,
            code: 'CIRCUIT.OPEN',
            message: 'errors.circuitOpen',
            correlationId: params.correlationId,
            details: { nextAttemptAt: params.nextAttemptAt },
            retryable: true,
            affectsCircuit: false,
        })
        this.nextAttemptAt = params.nextAttemptAt
        this.circuitId = params.circuitId
    }
}

class CircuitBreaker {
    private circuits = new Map<string, CircuitEntry>()

    async execute<T>(key: string, correlationId: string, fn: () => Promise<T>): Promise<T> {
        const entry = this.circuits.get(key) ?? this.createEntry(key)
        const now = Date.now()

        if (entry.state === 'open') {
            if (now < entry.nextAttemptAt) {
                throw new CircuitOpenError({ circuitId: key, correlationId, nextAttemptAt: entry.nextAttemptAt })
            }
            entry.state = 'half_open'
        }

        try {
            const result = await fn()
            this.onSuccess(key)
            return result
        } catch (error) {
            this.onFailure(key, error, now)
            throw error
        }
    }

    private createEntry(key: string): CircuitEntry {
        const entry: CircuitEntry = {
            state: 'closed',
            failureCount: 0,
            firstFailureAt: 0,
            nextAttemptAt: 0,
        }
        this.circuits.set(key, entry)
        return entry
    }

    private onSuccess(key: string) {
        const entry = this.circuits.get(key)
        if (!entry) return
        entry.state = 'closed'
        entry.failureCount = 0
        entry.firstFailureAt = 0
        entry.nextAttemptAt = 0
    }

    private onFailure(key: string, error: unknown, now: number) {
        const entry = this.circuits.get(key) ?? this.createEntry(key)
        if (!(error instanceof ApiError)) {
            return
        }

        if (!error.affectsCircuit) {
            entry.state = 'closed'
            entry.failureCount = 0
            entry.firstFailureAt = 0
            entry.nextAttemptAt = 0
            return
        }

        if (entry.state === 'half_open') {
            entry.state = 'open'
            entry.failureCount = 0
            entry.firstFailureAt = now
            entry.nextAttemptAt = now + CIRCUIT_OPEN_INTERVAL_MS
            entry.openedAt = now
            return
        }

        if (!entry.firstFailureAt || now - entry.firstFailureAt > CIRCUIT_FAILURE_WINDOW_MS) {
            entry.firstFailureAt = now
            entry.failureCount = 1
        } else {
            entry.failureCount += 1
        }

        if (entry.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
            entry.state = 'open'
            entry.openedAt = now
            entry.nextAttemptAt = now + CIRCUIT_OPEN_INTERVAL_MS
            entry.failureCount = 0
            entry.firstFailureAt = 0
        }
    }
}

class HttpClient {
    private readonly breaker = new CircuitBreaker()

    constructor(private readonly instance: AxiosInstance) {}

    async request<Response = unknown, Request = unknown>(
        config: AxiosRequestConfig<Request>,
        options: HttpRequestOptions = {},
    ): Promise<AxiosResponse<Response, Request>> {
        const correlationId = options.correlationId ?? generateCorrelationId()
        const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

        const preparedConfig: AxiosRequestConfig<Request> = {
            ...config,
            timeout: timeoutMs,
            headers: {
                ...(config.headers ?? {}),
                'X-Correlation-Id': correlationId,
            },
        }

        const circuitId = options.circuitId ?? this.buildCircuitKey(preparedConfig)

        return this.breaker.execute(circuitId, correlationId, async () => {
            return this.requestWithRetries<Response, Request>(preparedConfig, {
                correlationId,
                retryDelays,
                timeoutMs,
                method: (preparedConfig.method ?? 'get').toUpperCase(),
                onRetry: options.onRetry,
            })
        })
    }

    private buildCircuitKey(config: AxiosRequestConfig): string {
        const method = (config.method ?? 'GET').toUpperCase()
        const baseURL = config.baseURL ?? this.instance.defaults.baseURL ?? ''
        const target = config.url ?? '/'
        try {
            const resolved = new URL(target, baseURL || 'http://localhost')
            return `${method}::${resolved.pathname}`
        } catch {
            return `${method}::${target}`
        }
    }

    private async requestWithRetries<Response, Request>(
        config: AxiosRequestConfig<Request>,
        meta: {
            correlationId: string
            retryDelays: number[]
            timeoutMs: number
            method: string
            onRetry?: (attempt: number, error: ApiError) => void
        },
    ): Promise<AxiosResponse<Response, Request>> {
        const maxAttempts = meta.retryDelays.length + 1
        let attempt = 0
        let lastError: ApiError | undefined

        while (attempt < maxAttempts) {
            try {
                return await this.performRequest<Response, Request>(config, meta.correlationId)
            } catch (error) {
                if (!(error instanceof ApiError)) {
                    throw error
                }

                lastError = error
                const remaining = maxAttempts - attempt - 1
                if (!this.shouldRetry(error, remaining, meta.method)) {
                    throw error
                }
                const delay = meta.retryDelays[Math.min(attempt, meta.retryDelays.length - 1)]
                if (meta.onRetry) {
                    meta.onRetry(attempt + 1, error)
                }
                await sleep(delay)
                attempt += 1
            }
        }

        throw lastError ?? new ApiError({ status: 500, message: 'errors.unknown' })
    }

    private shouldRetry(error: ApiError, remainingAttempts: number, method: string) {
        if (remainingAttempts <= 0) {
            return false
        }
        if (error.isCancellation) {
            return false
        }
        const upperMethod = method.toUpperCase()
        const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(upperMethod)
        if (!isIdempotent && !(upperMethod === 'POST' && error.status === 429)) {
            return false
        }
        return error.retryable
    }

    private async performRequest<Response, Request>(
        config: AxiosRequestConfig<Request>,
        correlationId: string,
    ): Promise<AxiosResponse<Response, Request>> {
        try {
            return await this.instance.request<Response, Request>(config)
        } catch (error) {
            throw this.normalizeAxiosError(error, correlationId)
        }
    }

    private normalizeAxiosError(error: unknown, correlationId: string): ApiError {
        if (error instanceof ApiError) {
            return error
        }
        if (!isAxiosError(error)) {
            if (error instanceof Error) {
                return new ApiError({
                    status: 500,
                    code: 'UNKNOWN',
                    message: 'errors.unknown',
                    details: { reason: error.message },
                    correlationId,
                    retryable: false,
                })
            }
            throw error
        }

        const axiosError = error as AxiosError

        if (axiosError.code === AxiosError.ERR_CANCELED) {
            return new ApiError({
                status: 499,
                code: 'CLIENT.CANCELLED',
                message: 'errors.requestCancelled',
                correlationId,
                retryable: false,
                affectsCircuit: false,
                isCancellation: true,
            })
        }

        if (axiosError.code === 'ECONNABORTED') {
            return new ApiError({
                status: 408,
                code: 'BACKEND.TIMEOUT',
                message: 'errors.timeout',
                correlationId,
                retryable: true,
                affectsCircuit: true,
                isTimeout: true,
            })
        }

        if (!axiosError.response) {
            return new ApiError({
                status: 0,
                code: 'NETWORK.OFFLINE',
                message: 'errors.networkOffline',
                correlationId,
                retryable: true,
                affectsCircuit: true,
                isNetworkError: true,
            })
        }

        const { status = 500, data, headers } = axiosError.response
        const retryAfterHeader = headers?.['retry-after'] ?? headers?.['Retry-After']
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined
        const responseCorrelationId =
            headers?.['x-correlation-id'] ?? headers?.['x-request-id'] ?? correlationId

        if (data && typeof data === 'object' && (data as StandardErrorEnvelope).ok === false) {
            return ApiError.fromEnvelope(data as StandardErrorEnvelope, status, responseCorrelationId, retryAfter)
        }

        return new ApiError({
            status,
            code: mapStatusToCode(status),
            message: 'errors.requestFailed',
            correlationId: responseCorrelationId,
            retryAfter,
            retryable: isRetryable(status),
            affectsCircuit: affectsCircuit(status),
        })
    }
}

const httpClient = new HttpClient(BaseService)

export const apiClient = httpClient

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export const createCorrelationId = generateCorrelationId

export default httpClient
