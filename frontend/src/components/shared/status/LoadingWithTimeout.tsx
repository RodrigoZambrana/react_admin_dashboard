import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface LoadingWithTimeoutProps {
    isLoading: boolean
    timeoutMs?: number
    slowMessage?: string
    children?: ReactNode
    fallback?: ReactNode
}

export function LoadingWithTimeout({
    isLoading,
    timeoutMs = 7_000,
    slowMessage = 'Esto está tardando más de lo normal…',
    children,
    fallback,
}: LoadingWithTimeoutProps) {
    const timerRef = useRef<number | undefined>(undefined)
    const [isSlow, setIsSlow] = useState(false)

    useEffect(() => {
        if (!isLoading) {
            setIsSlow(false)
            if (timerRef.current) {
                window.clearTimeout(timerRef.current)
                timerRef.current = undefined
            }
            return
        }

        timerRef.current = window.setTimeout(() => setIsSlow(true), timeoutMs)

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current)
            }
        }
    }, [isLoading, timeoutMs])

    if (!isLoading) {
        return null
    }

    if (children) {
        return <>{children}</>
    }

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: 12,
                border: '1px solid rgba(59, 130, 246, 0.2)',
                background: 'rgba(219, 234, 254, 0.6)',
                color: '#1d4ed8',
            }}
        >
            <span aria-hidden="true" style={{ fontSize: 20 }}>
                ⏳
            </span>
            <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Cargando…</p>
                {isSlow ? (
                    <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>{fallback ?? slowMessage}</p>
                ) : null}
            </div>
        </div>
    )
}

export default LoadingWithTimeout
