import type { ReactNode } from "react";
import { ApiError } from "@/lib/http";
import { useTranslation } from "@/state/i18n-context";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: ApiError;
  correlationId?: string;
  retryLabel?: string;
  onRetry?: () => void;
  actionSlot?: ReactNode;
  icon?: ReactNode;
}

export function ErrorState({
  title,
  description,
  error,
  correlationId,
  retryLabel,
  onRetry,
  actionSlot,
  icon,
}: ErrorStateProps) {
  const t = useTranslation();
  const resolvedTitle = title ?? t("errorState.title", { defaultMessage: "Something went wrong" });
  const resolvedDescription =
    description ??
    t("errorState.description", { defaultMessage: "Please try again in a few seconds." });
  const resolvedRetryLabel =
    retryLabel ?? t("errorState.retry", { defaultMessage: "Try again" });
  const visibleCorrelationId = correlationId ?? error?.correlationId;
  const retryAfterSeconds = error?.retryAfter;

  return (
    <section
      role="alert"
      aria-live="assertive"
      style={{
        borderRadius: "12px",
        border: "1px solid rgba(185, 28, 28, 0.25)",
        background: "rgba(254, 226, 226, 0.35)",
        padding: "24px",
        color: "#7f1d1d",
        boxShadow: "0 6px 16px rgba(127, 29, 29, 0.08)",
      }}
    >
      <header style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {icon ?? (
          <span aria-hidden="true" style={{ fontSize: "28px", marginTop: "2px" }}>
            ⚠️
          </span>
        )}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{resolvedTitle}</h2>
          <p style={{ marginTop: "8px", fontSize: "14px", lineHeight: 1.6, color: "#9f1239" }}>
            {resolvedDescription}
            {error?.code ? (
              <span style={{ marginLeft: "4px", fontWeight: 600, color: "#7f1d1d" }}>
                ({error.code})
              </span>
            ) : null}
          </p>
        </div>
      </header>
      <div style={{ marginTop: "16px", fontSize: "12px", color: "#991b1b" }}>
        {visibleCorrelationId ? (
          <p>
            {t("errorState.correlationId", { defaultMessage: "Tracking ID" })}:{" "}
            <code style={{ fontFamily: "ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace" }}>
              {visibleCorrelationId}
            </code>
          </p>
        ) : null}
        {retryAfterSeconds ? (
          <p>
            {t("errorState.retryAfter", { defaultMessage: "You can retry in" })}{" "}
            <strong>{Math.ceil(retryAfterSeconds)}s</strong>.
          </p>
        ) : null}
        {error?.details && typeof error.details === "string" ? <p style={{ marginTop: "4px" }}>{error.details}</p> : null}
      </div>
      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              appearance: "none",
              borderRadius: "8px",
              border: "1px solid rgba(185, 28, 28, 0.55)",
              background: "#fff",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#7f1d1d",
              cursor: "pointer",
            }}
          >
            {resolvedRetryLabel}
          </button>
        ) : null}
        {actionSlot}
      </div>
    </section>
  );
}

export default ErrorState;
