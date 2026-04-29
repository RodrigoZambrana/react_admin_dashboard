"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";
import { AuthApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/http";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const method = (searchParams?.get("method") === "sms" ? "sms" : "email") as "sms" | "email";
  const initialPhone = useMemo(() => searchParams?.get("phone") ?? "", [searchParams]);
  const initialToken = useMemo(() => searchParams?.get("token") ?? "", [searchParams]);
  const otpLength = Number(searchParams?.get("length") ?? 4) || 4;
  const [phone, setPhone] = useState(initialPhone);
  const [token, setToken] = useState(initialToken);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      if (method === "sms") {
        if (!phone.trim() || code.trim().length < otpLength) {
          setError(`Ingresá el teléfono y el código SMS de ${otpLength} dígitos.`);
          return;
        }
        await AuthApi.resetPassword({
          method: "sms",
          phone: phone.trim(),
          code: code.trim(),
          password,
        });
      } else {
        if (!token.trim()) {
          setError("Falta el token de recuperación.");
          return;
        }
        await AuthApi.resetPassword({
          method: "email",
          token: token.trim(),
          password,
        });
      }

      setSuccess("Contraseña actualizada correctamente.");
      window.setTimeout(() => router.push("/"), 1200);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : "No pudimos actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Recuperación"
      title="Definir nueva contraseña"
      subtitle="Usá el código SMS o el token del email para cambiar tu contraseña de forma segura.">
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        {method === "sms" ? (
          <>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, color: "#334155" }}>Teléfono</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, color: "#334155" }}>Código SMS</span>
              <OtpInput value={code} onChange={setCode} autoFocus length={otpLength} />
            </div>
          </>
        ) : (
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#334155" }}>Token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Token del email"
              style={inputStyle}
            />
          </label>
        )}

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Nueva contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#334155" }}>Confirmar contraseña</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="********"
            style={inputStyle}
          />
        </label>

        {error ? <p style={errorStyle}>{error}</p> : null}
        {success ? <p style={successStyle}>{success}</p> : null}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Guardando..." : "Guardar contraseña"}
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
