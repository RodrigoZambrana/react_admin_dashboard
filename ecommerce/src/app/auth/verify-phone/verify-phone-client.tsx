"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";
import { AuthApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/http";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyPhoneClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = useMemo(() => searchParams?.get("phone") ?? "", [searchParams]);
  const otpLength = Number(searchParams?.get("length") ?? 4) || 4;
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!secondsLeft) {
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!phone.trim()) {
      setError("Ingresa tu teléfono.");
      return;
    }
    if (code.trim().length < otpLength) {
      setError(`Ingresa el código de ${otpLength} dígitos.`);
      return;
    }
    setLoading(true);
    try {
      await AuthApi.verifyOtp({ phone: phone.trim(), code: code.trim() });
      setSuccess("Cuenta activada correctamente.");
      window.setTimeout(() => router.push("/"), 1000);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos validar el código.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setSuccess(null);
    if (!phone.trim()) {
      setError("Ingresa tu teléfono.");
      return;
    }
    setResending(true);
    try {
      await AuthApi.sendOtp({ phone: phone.trim(), type: "verification" });
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setSuccess("Enviamos un nuevo código por SMS.");
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos reenviar el código.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Verificación"
      title="Confirma tu número"
      subtitle={`Ingresa el código OTP de ${otpLength} dígitos que te enviamos por SMS para activar la cuenta.`}>
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

        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Código OTP</span>
          <OtpInput value={code} onChange={setCode} autoFocus length={otpLength} />
        </div>

        {error ? <p style={errorStyle}>{error}</p> : null}
        {success ? <p style={successStyle}>{success}</p> : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Validando..." : "Validar código"}
        </button>

        <button
          type="button"
          onClick={resend}
          disabled={resending || secondsLeft > 0}
          style={secondaryButtonStyle}>
          {resending
            ? "Reenviando..."
            : secondsLeft > 0
              ? `Reenviar en ${secondsLeft}s`
              : "Reenviar código"}
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

const secondaryButtonStyle: import("react").CSSProperties = {
  height: 48,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#0f172a",
  fontSize: 15,
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
