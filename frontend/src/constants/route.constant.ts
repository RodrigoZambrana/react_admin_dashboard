const normalizePrefix = (value: string | undefined): string => {
    if (!value) {
        return '/app'
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return '/app'
    }

    const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return prefixed === '/' ? '/app' : prefixed.replace(/\/+$/u, '')
}

export const ROOT = '/'
export const APP_PREFIX_PATH = normalizePrefix(import.meta.env.VITE_APP_PREFIX_PATH)
export const AUTH_PREFIX_PATH = '/auth'

export const appPath = (...segments: string[]): string => {
    const suffix = segments
        .flatMap((segment) => segment.split('/'))
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/')

    if (!suffix) {
        return APP_PREFIX_PATH
    }

    return `${APP_PREFIX_PATH}/${suffix.replace(/^\/+/u, '')}`
}
