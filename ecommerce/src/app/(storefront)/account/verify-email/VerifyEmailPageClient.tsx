"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Container from "@component/Container";
import { H1, Paragraph, Small } from "@component/Typography";
import { Button } from "@component/buttons";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useTranslation } from "@/state/i18n-context";
import Link from "next/link";

type VerificationState = "idle" | "loading" | "success" | "error";

export default function VerifyEmailPageClient() {
  const searchParams = useSearchParams();
  const t = useTranslation();
  const [state, setState] = useState<VerificationState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const token = searchParams?.get("token")?.trim() ?? "";

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage(
        t("account.verifyEmail.errors.invalidToken", {
          defaultMessage: "El enlace de verificación es inválido o ya venció."
        })
      );
      return;
    }

    let cancelled = false;
    setState("loading");

    const run = async () => {
      try {
        await StorefrontApi.confirmEmailVerification(token);
        if (cancelled) return;
        setState("success");
        setMessage(
          t("account.verifyEmail.success", {
            defaultMessage: "Tu correo electrónico fue verificado correctamente."
          })
        );
      } catch (cause) {
        if (cancelled) return;
        const resolved = isApiError(cause)
          ? t(extractApiErrorMessage(cause), { defaultMessage: extractApiErrorMessage(cause) })
          : cause instanceof Error
            ? cause.message
            : t("account.verifyEmail.errors.invalidToken", {
                defaultMessage: "El enlace de verificación es inválido o ya venció."
              });
        setState("error");
        setMessage(resolved);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [t, token]);

  return (
    <Container mt="3rem" mb="4rem" style={{ maxWidth: 640 }}>
      <H1 mb="0.75rem">
        {t("account.verifyEmail.title", { defaultMessage: "Verificar correo electrónico" })}
      </H1>

      {state === "loading" ? (
        <Paragraph color="text.muted">
          {t("account.verifyEmail.loading", {
            defaultMessage: "Estamos confirmando tu correo electrónico..."
          })}
        </Paragraph>
      ) : (
        <Paragraph color={state === "error" ? "error.main" : "text.muted"}>{message}</Paragraph>
      )}

      {(state === "success" || state === "error") && (
        <Small display="block" mt="1rem">
          <Link href="/">{t("account.verifyEmail.actions.home", { defaultMessage: "Volver al inicio" })}</Link>
        </Small>
      )}
    </Container>
  );
}
