import { useEffect, useRef, useState, type ReactNode } from "react";

export interface LoadingWithTimeoutProps {
  isLoading: boolean;
  timeoutMs?: number;
  slowMessage?: string;
  children?: ReactNode;
  fallback?: ReactNode;
}

export function LoadingWithTimeout({
  isLoading,
  timeoutMs = 7_000,
  slowMessage = "Esto está tardando más de lo normal…",
  children,
  fallback,
}: LoadingWithTimeoutProps) {
  const timerRef = useRef<number | undefined>(undefined);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsSlow(false);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      return;
    }

    timerRef.current = window.setTimeout(() => setIsSlow(true), timeoutMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [isLoading, timeoutMs]);

  if (!isLoading) {
    return null;
  }

  if (children) {
    return <>{children}</>;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid rgba(37, 99, 235, 0.2)",
        background: "rgba(239, 246, 255, 0.6)",
        color: "#1d4ed8",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "20px" }}>
        ⏳
      </span>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>Cargando…</p>
        {isSlow ? (
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#1e3a8a" }}>
            {fallback ?? slowMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default LoadingWithTimeout;
