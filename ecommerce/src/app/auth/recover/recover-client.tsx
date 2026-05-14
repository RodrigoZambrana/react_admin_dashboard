"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import { AuthApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/http";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { resolvePublicRecaptchaToken } from "@/lib/security/public-recaptcha";

export default function RecoverClient() {
  const router = useRouter();
  const [method, setMethod] = useState<"sms" | "email">("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const recaptchaToken = await resolvePublicRecaptchaToken("auth_recover");
      if (method === "sms") {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (!normalizedPhone) {
          setError("Ingresa un teléfono válido.");
          return;
        }
        const response = await AuthApi.recover({
          method,
          phone: normalizedPhone,
          recaptchaToken
        });
        router.push(
          `/auth/reset-password?method=sms&phone=${encodeURIComponent(normalizedPhone)}&length=${response.otpLength ?? 4}`,
        );
        return;
      }

      if (!email.trim()) {
        setError("Ingresa un email válido.");
        return;
      }

      await AuthApi.recover({ method, email: email.trim(), recaptchaToken });
      setSuccess("Si el correo existe, enviamos un enlace para restablecer la contraseña.");
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos iniciar la recuperación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Recuperación"
      title="Elegí cómo recuperar tu cuenta"
      subtitle="Podés usar un código por SMS o un enlace enviado por email.">
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={choiceStyle(method === "sms")}>
            <input
              type="radio"
              name="method"
              value="sms"
              checked={method === "sms"}
              onChange={() => setMethod("sms")}
            />
            <div>
              <strong>SMS</strong>
              <p style={muted}>Recibí un código de un solo uso en tu teléfono.</p>
            </div>
          </label>
          <label style={choiceStyle(method === "email")}>
            <input
              type="radio"
              name="method"
              value="email"
              checked={method === "email"}
              onChange={() => setMethod("email")}
            />
            <div>
              <strong>Email</strong>
              <p style={muted}>Recibí un enlace seguro para restablecer la contraseña.</p>
            </div>
          </label>
        </div>

        {method === "sms" ? (
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#334155" }}>Teléfono</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+598 99 000 000"
              style={inputStyle}
            />
          </label>
        ) : (
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#334155" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              style={inputStyle}
            />
          </label>
        )}

        {error ? <p style={errorStyle}>{error}</p> : null}
        {success ? <p style={successStyle}>{success}</p> : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Procesando..." : "Continuar"}
        </button>
      </form>
    </AuthShell>
  );
}

const inputStyle: import("react").CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
};

const buttonStyle: import("react").CSSProperties = {
  height: 52,
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: import("react").CSSProperties = {
  margin: 0,
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: "12px 14px",
  borderRadius: 14,
};

const successStyle: import("react").CSSProperties = {
  margin: 0,
  color: "#166534",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  padding: "12px 14px",
  borderRadius: 14,
};

const choiceStyle = (active: boolean): import("react").CSSProperties => ({
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "14px 16px",
  borderRadius: 18,
  border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
  background: active ? "rgba(15, 23, 42, 0.04)" : "white",
  cursor: "pointer",
});

const muted: import("react").CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};
