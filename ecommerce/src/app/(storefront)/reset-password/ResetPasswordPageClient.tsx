"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as yup from "yup";

import Box from "@component/Box";
import Container from "@component/Container";
import TextField from "@component/text-field";
import { Button } from "@component/buttons";
import { H1, Paragraph, Small } from "@component/Typography";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useToast } from "@/contexts/ToastContext";
import { useTranslation } from "@/state/i18n-context";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { resolveStorefrontRecaptchaToken } from "@/lib/security/storefront-recaptcha";

type FormValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslation();
  const toast = useToast();
  const storefrontConfig = useStorefrontConfig();
  const [completed, setCompleted] = useState(false);

  const token = searchParams?.get("token")?.trim() ?? "";

  const validationSchema = useMemo(
    () =>
      yup.object({
        password: yup
          .string()
          .required(
            t("account.resetPassword.errors.passwordRequired", {
              defaultMessage: "Debes ingresar una nueva contraseña."
            })
          )
          .min(
            10,
            t("account.resetPassword.errors.passwordLength", {
              defaultMessage: "La contraseña debe tener al menos 10 caracteres."
            })
          ),
        confirmPassword: yup
          .string()
          .required(
            t("account.resetPassword.errors.confirmRequired", {
              defaultMessage: "Debes repetir la contraseña."
            })
          )
          .oneOf(
            [yup.ref("password")],
            t("Passwords must match", { defaultMessage: "Passwords must match" })
          )
      }),
    [t]
  );

  const { values, errors, touched, handleBlur, handleChange, handleSubmit, isSubmitting } =
    useFormik<FormValues>({
      initialValues: { password: "", confirmPassword: "" },
      validationSchema,
      onSubmit: async (formValues) => {
        if (!token) {
          toast.error({
            title: t("account.resetPassword.errors.invalidTokenTitle", {
              defaultMessage: "Enlace inválido"
            }),
            description: t("account.resetPassword.errors.invalidToken", {
              defaultMessage:
                "El enlace de restablecimiento es inválido o ya venció. Solicita uno nuevo."
            })
          });
          return;
        }

        try {
          const recaptchaToken = await resolveStorefrontRecaptchaToken(
            storefrontConfig,
            "storefront_password_reset"
          );
          await StorefrontApi.resetPasswordByEmail(token, formValues.password, recaptchaToken);
          setCompleted(true);
          toast.success({
            title: t("account.resetPassword.success.title", {
              defaultMessage: "Contraseña actualizada"
            }),
            description: t("account.resetPassword.success.description", {
              defaultMessage: "Ya puedes iniciar sesión con tu nueva contraseña."
            })
          });
          window.setTimeout(() => {
            router.push("/");
          }, 1200);
        } catch (cause) {
          const message = isApiError(cause)
            ? t(extractApiErrorMessage(cause), { defaultMessage: extractApiErrorMessage(cause) })
            : cause instanceof Error
              ? cause.message
              : t("account.resetPassword.errors.generic", {
                  defaultMessage: "No pudimos restablecer la contraseña."
                });
          toast.error({
            title: t("account.resetPassword.errors.title", {
              defaultMessage: "No pudimos restablecer la contraseña"
            }),
            description: message
          });
        }
      }
    });

  return (
    <Container mt="3rem" mb="4rem" style={{ maxWidth: 640 }}>
      <H1 mb="0.75rem">
        {t("account.resetPassword.title", { defaultMessage: "Definir nueva contraseña" })}
      </H1>

      <Paragraph color="text.muted" mb="1.5rem">
        {t("account.resetPassword.body", {
          defaultMessage: "Ingresa una nueva contraseña para recuperar el acceso a tu cuenta."
        })}
      </Paragraph>

      {!token ? (
        <Small color="error.main">
          {t("account.resetPassword.errors.invalidToken", {
            defaultMessage:
              "El enlace de restablecimiento es inválido o ya venció. Solicita uno nuevo."
          })}
        </Small>
      ) : (
        <form onSubmit={handleSubmit} data-testid="auth-reset-password-form">
          <TextField
            fullWidth
            mb="0.75rem"
            name="password"
            type="password"
            data-testid="auth-reset-password"
            label={t("account.resetPassword.fields.password", {
              defaultMessage: "Nueva contraseña"
            })}
            value={values.password}
            onChange={handleChange}
            onBlur={handleBlur}
            errorText={touched.password ? errors.password : undefined}
            disabled={isSubmitting || completed}
          />

          <TextField
            fullWidth
            name="confirmPassword"
            type="password"
            data-testid="auth-reset-password-confirm"
            label={t("account.resetPassword.fields.confirmPassword", {
              defaultMessage: "Confirmar contraseña"
            })}
            value={values.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            errorText={touched.confirmPassword ? errors.confirmPassword : undefined}
            disabled={isSubmitting || completed}
          />

          <Box mt="1.25rem">
            <Button
              type="submit"
              color="primary"
              variant="contained"
              data-testid="auth-reset-password-submit"
              disabled={isSubmitting || completed}>
              {completed
                ? t("account.resetPassword.actions.completed", {
                    defaultMessage: "Contraseña actualizada"
                  })
                : t("account.resetPassword.actions.submit", {
                    defaultMessage: "Guardar contraseña"
                  })}
            </Button>
          </Box>
        </form>
      )}
    </Container>
  );
}
