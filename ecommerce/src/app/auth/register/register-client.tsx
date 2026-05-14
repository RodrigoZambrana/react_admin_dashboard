"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import { AuthApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/http";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { resolvePublicRecaptchaToken } from "@/lib/security/public-recaptcha";

export default function RegisterClient() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      setError("Ingresa un teléfono válido.");
      return;
    }
    if (password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await resolvePublicRecaptchaToken("auth_register");
      const response = await AuthApi.register({
        phone: normalizedPhone,
        email: email.trim() || undefined,
        password,
        recaptchaToken,
      });
      router.push(
        `/auth/verify-phone?phone=${encodeURIComponent(normalizedPhone)}&length=${response.verification.otpLength}`,
      );
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Cuenta"
      title="Alta con teléfono"
      subtitle="Crea tu cuenta con tu número principal. El sistema enviará un código OTP por SMS para activar el acceso.">
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Teléfono</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+598 99 000 000"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Email opcional</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            style={inputStyle}
          />
        </label>

        {error ? <p style={errorStyle}>{error}</p> : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </AuthShell>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)",
};

const buttonStyle: CSSProperties = {
  height: 52,
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: "12px 14px",
  borderRadius: 14,
};
