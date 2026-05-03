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
export const PUBLIC_BASE_PATH = APP_PREFIX_PATH

const isAbsoluteUrl = (value: string): boolean => /^(?:https?:)?\/\//u.test(value)

const normalizeAssetPathSegments = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed.length) {
        return null
    }

    if (trimmed.startsWith('data:')) {
        return trimmed
    }

    try {
        const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
        const { pathname } = url
        if (pathname.startsWith('/img/')) {
            return publicAssetPath(pathname.slice(1))
        }
    } catch {
        // Fall through to path-based normalization below.
    }

    if (trimmed.startsWith('/img/') || trimmed.startsWith('img/')) {
        return publicAssetPath(trimmed)
    }

    return isAbsoluteUrl(trimmed) ? trimmed : null
}

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

export const publicAssetPath = (...segments: string[]): string => {
    const suffix = segments
        .flatMap((segment) => segment.split('/'))
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/')

    if (!suffix) {
        return PUBLIC_BASE_PATH
    }

    return `${PUBLIC_BASE_PATH}/${suffix.replace(/^\/+/u, '')}`
}

export const normalizeAdminAssetSrc = (value: string): string => {
    const normalized = normalizeAssetPathSegments(value)
    return normalized ?? value.trim()
}
