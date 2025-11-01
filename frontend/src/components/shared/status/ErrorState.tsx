import type { ReactNode } from 'react'
import { ApiError } from '@/lib/httpClient'

export interface ErrorStateProps {
    title?: string
    description?: string
    error?: ApiError
    correlationId?: string
    onRetry?: () => void
    retryLabel?: string
    actionSlot?: ReactNode
}

export function ErrorState({
    title = 'Algo salió mal',
    description = 'Intentá nuevamente en unos segundos.',
    error,
    correlationId,
    onRetry,
    retryLabel = 'Reintentar',
    actionSlot,
}: ErrorStateProps) {
    const visibleCorrelationId = correlationId ?? error?.correlationId
    const retryAfterSeconds = error?.retryAfter

    return (
        <section
            role="alert"
            aria-live="assertive"
            style={{
                borderRadius: 12,
                border: '1px solid rgba(220, 38, 38, 0.25)',
                background: 'rgba(254, 226, 226, 0.5)',
                padding: 24,
                color: '#7f1d1d',
            }}
        >
            <header style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ fontSize: 26, marginTop: 2 }}>
                    ⚠️
                </span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
                    <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                        {description}
                        {error?.code ? (
                            <span style={{ marginLeft: 4, fontWeight: 600 }}>
                                ({error.code})
                            </span>
                        ) : null}
                    </p>
                </div>
            </header>
            <div style={{ marginTop: 14, fontSize: 12 }}>
                {visibleCorrelationId ? (
                    <p>
                        ID de seguimiento:{' '}
                        <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace' }}>
                            {visibleCorrelationId}
                        </code>
                    </p>
                ) : null}
                {retryAfterSeconds ? (
                    <p>
                        Podés reintentar en <strong>{Math.ceil(retryAfterSeconds)}s</strong>.
                    </p>
                ) : null}
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {onRetry ? (
                    <button
                        type="button"
                        onClick={onRetry}
                        style={{
                            border: '1px solid rgba(220,38,38,0.45)',
                            borderRadius: 8,
                            padding: '8px 18px',
                            background: '#fff',
                            color: '#7f1d1d',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {retryLabel}
                    </button>
                ) : null}
                {actionSlot}
            </div>
        </section>
    )
}

export default ErrorState
