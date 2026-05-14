"use client";

import { useState } from "react";
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
  email: string;
};

const initialValues: FormValues = {
  email: ""
};

export default function ForgotPasswordPageClient() {
  const t = useTranslation();
  const toast = useToast();
  const storefrontConfig = useStorefrontConfig();
  const [submitted, setSubmitted] = useState(false);

  const validationSchema = yup.object({
    email: yup
      .string()
      .trim()
      .email(
        t("account.forgotPassword.errors.invalidEmail", {
          defaultMessage: "Ingresa un correo electrónico válido."
        })
      )
      .required(
        t("account.forgotPassword.errors.emailRequired", {
          defaultMessage: "Debes ingresar un correo electrónico."
        })
      )
  });

  const { values, errors, touched, handleBlur, handleChange, handleSubmit, isSubmitting } =
    useFormik<FormValues>({
      initialValues,
      validationSchema,
      onSubmit: async (formValues) => {
        try {
          const recaptchaToken = await resolveStorefrontRecaptchaToken(
            storefrontConfig,
            "storefront_password_forgot"
          );
          await StorefrontApi.requestPasswordRecoveryByEmail(
            formValues.email.trim().toLowerCase(),
            recaptchaToken
          );
          setSubmitted(true);
          toast.success({
            title: t("account.forgotPassword.success.title", {
              defaultMessage: "Revisa tu correo"
            }),
            description: t("account.forgotPassword.success.description", {
              defaultMessage:
                "Si existe una cuenta con ese correo, enviamos un enlace seguro para restablecer la contraseña."
            })
          });
        } catch (cause) {
          const message = isApiError(cause)
            ? t(extractApiErrorMessage(cause), { defaultMessage: extractApiErrorMessage(cause) })
            : cause instanceof Error
              ? cause.message
              : t("account.forgotPassword.errors.generic", {
                  defaultMessage: "No pudimos iniciar la recuperación de contraseña."
                });
          toast.error({
            title: t("account.forgotPassword.errors.title", {
              defaultMessage: "No pudimos continuar"
            }),
            description: message
          });
        }
      }
    });

  return (
    <Container mt="3rem" mb="4rem" style={{ maxWidth: 640 }}>
      <H1 mb="0.75rem">
        {t("account.forgotPassword.title", { defaultMessage: "Restablecer contraseña" })}
      </H1>

      <Paragraph color="text.muted" mb="1rem">
        {t("account.forgotPassword.body", {
          defaultMessage:
            "Por ahora este proceso está disponible únicamente para cuentas con correo electrónico."
        })}
      </Paragraph>

      {storefrontConfig.integrations?.recaptcha?.enabled ? (
        <Paragraph color="text.muted" mb="1rem">
          {t("auth.signIn.recaptchaMessage", {
            defaultMessage: "reCAPTCHA Enterprise protege esta acción."
          })}
        </Paragraph>
      ) : null}

      <Paragraph color="text.muted" mb="1.5rem">
        {t("account.forgotPassword.phoneOnlyHint", {
          defaultMessage:
            "Si tu cuenta fue creada solo con teléfono, comunícate por una vía de soporte. Te enviaremos una nueva clave y luego deberás cambiarla de inmediato."
        })}
      </Paragraph>

      <form onSubmit={handleSubmit} data-testid="auth-forgot-password-form">
        <TextField
          fullWidth
          name="email"
          type="email"
          data-testid="auth-forgot-password-email"
          label={t("account.forgotPassword.fields.email", {
            defaultMessage: "Correo electrónico"
          })}
          placeholder={t("account.forgotPassword.placeholders.email", {
            defaultMessage: "tu@email.com"
          })}
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          errorText={touched.email ? errors.email : undefined}
          disabled={isSubmitting || submitted}
        />

        <Box mt="1.25rem">
          <Button
            type="submit"
            color="primary"
            variant="contained"
            data-testid="auth-forgot-password-submit"
            disabled={isSubmitting || submitted}>
            {submitted
              ? t("account.forgotPassword.actions.sent", { defaultMessage: "Correo enviado" })
              : t("account.forgotPassword.actions.submit", {
                  defaultMessage: "Enviar enlace"
                })}
          </Button>
        </Box>
      </form>

      {submitted ? (
        <Small display="block" color="success.main" mt="1rem">
          {t("account.forgotPassword.success.inline", {
            defaultMessage:
              "Si el correo existe en el sistema, recibirás un enlace de recuperación en los próximos minutos."
          })}
        </Small>
      ) : null}
    </Container>
  );
}
