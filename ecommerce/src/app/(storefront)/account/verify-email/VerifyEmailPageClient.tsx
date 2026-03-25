"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import Box from "@component/Box";
import { Button } from "@component/buttons";
import { H3, H5, Paragraph, Small } from "@component/Typography";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useTranslation } from "@/state/i18n-context";
import { StyledRoot } from "@sections/auth/styles";

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
    <StyledRoot mx="auto" my="2rem">
      <div className="content">
        <H3 textAlign="center" mb="0.5rem">
          {t("account.verifyEmail.title", { defaultMessage: "Verificar correo electrónico" })}
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2rem">
          {t("account.verifyEmail.subtitle", {
            defaultMessage: "Confirma tu correo para activar las comunicaciones de tu cuenta."
          })}
        </H5>

        <Box
          border="1px solid"
          borderColor={state === "error" ? "error.main" : state === "success" ? "success.main" : "gray.300"}
          borderRadius={12}
          p="1rem"
          mb="1rem">
          {state === "loading" ? (
            <Paragraph color="text.muted" textAlign="center" my="0px">
              {t("account.verifyEmail.loading", {
                defaultMessage: "Estamos confirmando tu correo electrónico..."
              })}
            </Paragraph>
          ) : (
            <Paragraph
              color={state === "error" ? "error.main" : state === "success" ? "success.main" : "text.muted"}
              textAlign="center"
              my="0px">
              {message}
            </Paragraph>
          )}
        </Box>

        {(state === "success" || state === "error") && (
          <>
            <Box mb="0.75rem">
              <Link href="/">
                <Button fullWidth color="primary" variant="contained">
                  {t("account.verifyEmail.actions.home", { defaultMessage: "Volver al inicio" })}
                </Button>
              </Link>
            </Box>

            <Small display="block" color="text.muted" textAlign="center" mb="1rem">
              {state === "success"
                ? t("account.verifyEmail.help.success", {
                    defaultMessage: "Ya puedes continuar navegando y recibir correos transaccionales en tu cuenta."
                  })
                : t("account.verifyEmail.help.error", {
                    defaultMessage: "Si el problema continúa, solicita un nuevo correo de verificación desde tu perfil."
                  })}
            </Small>
          </>
        )}
      </div>
    </StyledRoot>
  );
}
