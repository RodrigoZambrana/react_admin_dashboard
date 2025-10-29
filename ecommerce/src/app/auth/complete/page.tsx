"use client";

import { useEffect, useState } from "react";

import { StorefrontApi } from "@/lib/api/storefront";
import { env } from "@/lib/env";
import type { AuthSession } from "@/types/storefront";

const MESSAGE_TYPE = "storefront:google-auth";
const COMPLETING_MESSAGE = "Finalizando el inicio de sesión con Google…";
const ERROR_MESSAGE =
  "No pudimos completar el inicio de sesión. Puedes cerrar esta ventana e intentarlo nuevamente.";

async function fetchSession(): Promise<AuthSession> {
  return StorefrontApi.getCurrentSession();
}

const normalizeReturnPath = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/")) {
    return null;
  }
  return trimmed;
};

export default function AuthCompletePage() {
  const [statusText, setStatusText] = useState(COMPLETING_MESSAGE);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") ?? "error";
    const state = params.get("state") ?? null;
    const returnPath = normalizeReturnPath(params.get("returnPath"));
    const errorMessage = params.get("message") ?? ERROR_MESSAGE;
    const errorCode = params.get("error") ?? undefined;

    if (status !== "success") {
      setStatusText(errorMessage);
    }

    const resolveTargetOrigin = (): string => {
      const candidates: string[] = [];
      if (typeof env.publicSiteOrigin === "string" && env.publicSiteOrigin.length > 0) {
        candidates.push(env.publicSiteOrigin);
      }
      if (typeof document !== "undefined" && typeof document.referrer === "string" && document.referrer.length > 0) {
        try {
          candidates.push(new URL(document.referrer).origin);
        } catch (error) {
          console.warn("[google-auth][bridge] Unable to parse document.referrer origin", error);
        }
      }
      if (typeof window !== "undefined" && window.location?.origin) {
        candidates.push(window.location.origin);
      }
      const target = candidates.find((origin) => origin && origin !== "null");
      return target ?? "*";
    };

    const notifyOpener = async () => {
      let payload:
        | {
            type: string;
            status: "success";
            session: AuthSession;
            returnPath: string | null;
            state: string | null;
          }
        | {
            type: string;
            status: "error";
            message: string;
            errorCode?: string;
            returnPath: string | null;
            state: string | null;
          };

      if (status === "success") {
        try {
          console.log("[google-auth][bridge] status=success, fetching session", { state, returnPath });
          const session = await fetchSession();
          setStatusText("Sesión iniciada correctamente. Puedes cerrar esta ventana.");
          payload = {
            type: MESSAGE_TYPE,
            status: "success",
            session,
            returnPath,
            state,
          };
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "No pudimos recuperar tu sesión desde el servidor.";
          setStatusText(message);
          console.error("[google-auth][bridge] Failed to fetch session", error);
          payload = {
            type: MESSAGE_TYPE,
            status: "error",
            message,
            returnPath,
            state,
          };
        }
      } else {
        payload = {
          type: MESSAGE_TYPE,
          status: "error",
          message: errorMessage,
          errorCode,
          returnPath,
          state,
        };
        console.warn("[google-auth][bridge] Received error status from backend", payload);
      }

      const targetOrigin = resolveTargetOrigin();

      try {
        if (window.opener && typeof window.opener.postMessage === "function") {
          console.log("[google-auth][bridge] Posting message to opener", { payload, targetOrigin });
          window.opener.postMessage(payload, targetOrigin);
        } else if (window.parent && window.parent !== window && typeof window.parent.postMessage === "function") {
          console.log("[google-auth][bridge] Posting message to parent", { payload, targetOrigin });
          window.parent.postMessage(payload, targetOrigin);
        }
      } catch (error) {
        console.warn("[auth] Failed to deliver Google auth result to opener", error);
      } finally {
        setTimeout(() => {
          try {
            window.close();
          } catch (error) {
            console.warn("[auth] Unable to close Google auth bridge window", error);
          }
        }, 100);
      }
    };

    void notifyOpener();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        padding: "1.5rem",
        textAlign: "center"
      }}>
      <h1 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Google Sign-In</h1>
      <p style={{ fontSize: "0.95rem", maxWidth: "24rem" }}>{statusText}</p>
    </div>
  );
}
