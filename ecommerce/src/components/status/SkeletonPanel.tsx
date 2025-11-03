"use client";

import type { ReactNode } from "react";

type SkeletonPanelProps = {
  lines?: number;
  height?: number;
  accessory?: ReactNode;
};

export function SkeletonPanel({ lines = 3, height = 12, accessory }: SkeletonPanelProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(226, 232, 240, 0.6)",
        background: "rgba(248, 250, 252, 0.9)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: "40%", height: height + 6, background: "rgba(203, 213, 225, 0.6)", borderRadius: 6 }} />
        {accessory ? accessory : <div style={{ width: 60, height: height + 6, background: "rgba(203, 213, 225, 0.35)", borderRadius: 6 }} />}
      </div>
      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            style={{
              width: `${Math.max(30, 100 - index * 10)}%`,
              height,
              background: "linear-gradient(90deg, rgba(226,232,240,0.5) 25%, rgba(203,213,225,0.7) 50%, rgba(226,232,240,0.5) 75%)",
              borderRadius: 6,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default SkeletonPanel;
