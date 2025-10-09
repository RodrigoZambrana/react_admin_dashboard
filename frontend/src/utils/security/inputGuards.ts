import DOMPurify from 'dompurify'
import { INJECTION_PATTERNS } from '@/constants/security.constant'

const sanitizeOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_TRUSTED_TYPE: false,
}

export class UnsafeInputError extends Error {
    path?: string

    constructor(path?: string) {
        super('Input contains potentially unsafe content.')
        this.name = 'UnsafeInputError'
        this.path = path
    }
}

export const sanitizeString = (value: string): string => {
    const sanitized = DOMPurify.sanitize(value, sanitizeOptions)
    return typeof sanitized === 'string' ? sanitized.trim() : ''
}

export const isSuspiciousString = (value: string): boolean => {
    if (!value) {
        return false
    }
    const normalized = value
        .replace(/\s+/g, ' ')
        .toUpperCase()
    return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))
}

const shouldRejectBasedOnDiff = (original: string, sanitized: string) => {
    if (original === sanitized) {
        return false
    }
    const cleanedOriginal = original.trim()

    if (!cleanedOriginal) {
        return false
    }

    const diffIntroducesHtml =
        /<[^>]+>/.test(cleanedOriginal) || /javascript:/i.test(cleanedOriginal)

    return diffIntroducesHtml
}

export const ensureSafeString = (value: string, path?: string): string => {
    const sanitized = sanitizeString(value)
    if (isSuspiciousString(sanitized) || shouldRejectBasedOnDiff(value, sanitized)) {
        throw new UnsafeInputError(path)
    }
    return sanitized
}

type Sanitizable =
    | string
    | number
    | boolean
    | null
    | undefined
    | File
    | Blob
    | Date
    | Record<string, unknown>
    | Sanitizable[]

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Object.prototype.toString.call(value) === '[object Object]'

export const sanitizePayload = <T extends Sanitizable>(
    payload: T,
    currentPath = '',
): T => {
    if (payload === null || payload === undefined) {
        return payload
    }

    if (typeof payload === 'string') {
        return ensureSafeString(payload, currentPath) as T
    }

    if (Array.isArray(payload)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return payload.map((item, index) =>
            sanitizePayload(item as Sanitizable, `${currentPath}[${index}]`),
        ) as any
    }

    if (isPlainObject(payload)) {
        const result: Record<string, unknown> = {}
        Object.entries(payload).forEach(([key, value]) => {
            const nextPath = currentPath ? `${currentPath}.${key}` : key
            result[key] = sanitizePayload(value as Sanitizable, nextPath)
        })
        return result as T
    }

    return payload
}

export const sanitizeFormData = (formData: FormData) => {
    const sanitized = new FormData()
    for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
            sanitized.append(key, ensureSafeString(value, key))
        } else {
            sanitized.append(key, value)
        }
    }
    return sanitized
}
