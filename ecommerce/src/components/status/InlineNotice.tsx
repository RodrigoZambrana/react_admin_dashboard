"use client";

import type { ReactNode } from "react";

type InlineNoticeProps = {
  tone?: "info" | "warning" | "error";
  icon?: ReactNode;
  text: string;
};

const palette = {
  info: {
    color: "#1d4ed8",
    background: "rgba(191, 219, 254, 0.45)",
    border: "rgba(96, 165, 250, 0.6)",
    icon: "ℹ️",
  },
  warning: {
    color: "#b45309",
    background: "rgba(254, 243, 199, 0.55)",
    border: "rgba(251, 191, 36, 0.6)",
    icon: "⚠️",
  },
  error: {
    color: "#991b1b",
    background: "rgba(254, 226, 226, 0.55)",
    border: "rgba(248, 113, 113, 0.55)",
    icon: "⛔️",
  },
} as const;

export function InlineNotice({ tone = "info", icon, text }: InlineNoticeProps) {
  const theme = palette[tone];
  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        fontSize: 13,
        borderRadius: 8,
        color: theme.color,
        background: theme.background,
        border: `1px solid ${theme.border}`,
      }}
    >
      <span aria-hidden="true">{icon ?? theme.icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default InlineNotice;
