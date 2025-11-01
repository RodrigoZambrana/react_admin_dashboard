type BrowserSentry = {
    captureException: (error: unknown, context?: Record<string, unknown>) => void
    captureMessage?: (message: string, context?: Record<string, unknown>) => void
}

const resolveSentry = (): BrowserSentry | null => {
    if (typeof window === 'undefined') {
        return null
    }
    const globalScope = window as unknown as { Sentry?: BrowserSentry }
    return globalScope.Sentry ?? null
}

export function reportException(error: unknown, context: Record<string, unknown> = {}) {
    const sentry = resolveSentry()
    if (sentry?.captureException) {
        sentry.captureException(error, { extra: context })
        return
    }
    if (import.meta.env.MODE !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[observability] exception', context, error)
    }
}

export function reportMessage(message: string, context: Record<string, unknown> = {}) {
    const sentry = resolveSentry()
    if (sentry?.captureMessage) {
        sentry.captureMessage(message, { extra: context })
        return
    }
    if (import.meta.env.MODE !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[observability] message', message, context)
    }
}
