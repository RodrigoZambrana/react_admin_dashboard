"use client";

import type { PropsWithChildren } from "react";

type AuthShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle: string;
}>;

export default function AuthShell({ eyebrow, title, subtitle, children }: AuthShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        background:
          "radial-gradient(circle at top left, rgba(255, 183, 94, 0.28), transparent 35%), radial-gradient(circle at top right, rgba(9, 105, 218, 0.2), transparent 32%), linear-gradient(180deg, #0f172a 0%, #111827 52%, #f8fafc 52%, #f8fafc 100%)",
      }}>
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 460px)",
          gap: 24,
          alignItems: "center",
        }}>
        <div
          style={{
            color: "white",
            padding: "24px 16px",
          }}>
          {eyebrow ? (
            <p
              style={{
                margin: 0,
                marginBottom: 16,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontSize: 12,
                color: "rgba(255,255,255,0.74)",
              }}>
              {eyebrow}
            </p>
          ) : null}
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.4rem, 5vw, 4.8rem)",
              lineHeight: 0.95,
              fontWeight: 800,
              letterSpacing: "-0.06em",
            }}>
            {title}
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: 560,
              fontSize: 18,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.82)",
            }}>
            {subtitle}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 28,
            }}>
            {[
              "Phone OTP verification",
              "SMS and email recovery",
              "Redis-backed rate limiting",
            ].map((item) => (
              <span
                key={item}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 28,
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 24px 80px rgba(15, 23, 42, 0.22)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            overflow: "hidden",
          }}>
          <div
            style={{
              padding: "28px 28px 20px",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0) 100%)",
              borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
            }}>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#64748b",
              }}>
              {eyebrow ?? "Authentication"}
            </p>
            <h2 style={{ margin: "10px 0 8px", fontSize: 28, lineHeight: 1.1, color: "#0f172a" }}>
              {title}
            </h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{subtitle}</p>
          </div>
          <div style={{ padding: 28 }}>{children}</div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 960px) {
          section {
            grid-template-columns: 1fr !important;
          }
          h1 {
            max-width: none !important;
          }
        }
      `}</style>
    </main>
  );
}
