"use client";

import * as yup from "yup";
import { Formik } from "formik";
import { useCallback, useMemo } from "react";

import Box from "@component/Box";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";
import Typography from "@component/Typography";

import { useSession } from "@/state/session-context";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import type { CustomerProfile } from "@/types/storefront";
import { normalizePhoneNumber, looksLikePhoneNumber } from "@/lib/utils/phone";
import { useI18n, useTranslation } from "@/state/i18n-context";

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

interface ProfileEditFormProps {
  profile: CustomerProfile;
  onUpdated?: (profile: CustomerProfile) => void;
}

const translateProfileError = (message: string, t: ReturnType<typeof useTranslation>) => {
  switch (message) {
    case "Email is already in use":
      return t("account.profile.edit.errors.emailInUse", {
        defaultMessage: "El correo electrónico ya está registrado en otra cuenta."
      });
    case "Phone number is already in use":
      return t("account.profile.edit.errors.phoneInUse", {
        defaultMessage: "El número de teléfono ya está registrado en otra cuenta."
      });
    case "Invalid phone number":
      return t("auth.register.errors.invalidPhone", {
        defaultMessage: "Ingresa un número de teléfono válido."
      });
    default:
      return message;
  }
};

export default function ProfileEditForm({ profile, onUpdated }: ProfileEditFormProps) {
  const { session } = useSession();
  const { locale } = useI18n();
  const t = useTranslation();

  const validationSchema = useMemo(
    () =>
      yup.object().shape({
        firstName: yup
          .string()
          .trim()
          .required(
            t("First name is required", { defaultMessage: "First name is required" }),
          ),
        lastName: yup.string().trim().nullable(),
        email: yup
          .string()
          .trim()
          .test(
            "email-or-empty",
            t("Enter a valid email", { defaultMessage: "Enter a valid email" }),
            (value) => {
              if (!value || value.trim().length === 0) {
                return true;
              }

              return yup.string().email().isValidSync(value.trim());
            },
          ),
        phone: yup
          .string()
          .trim()
          .required(
            t("auth.register.errors.phoneRequired", {
              defaultMessage: "Debes ingresar un número de teléfono."
            }),
          )
          .test(
            "phone-format",
            t("Enter a valid phone number", { defaultMessage: "Enter a valid phone number" }),
            (value) => {
              if (!value) {
                return false;
              }

              return looksLikePhoneNumber(value);
            },
          ),
      }),
    [t],
  );

  const INITIAL_VALUES: FormValues = {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? ""
  };

  const handleFormSubmit = useCallback(
    async (
      values: FormValues,
      helpers: {
        setSubmitting: (next: boolean) => void;
        setStatus: (status: { type: "success" | "error"; message: string } | null) => void;
      }
    ) => {
      if (!session?.accessToken) {
        helpers.setStatus({
          type: "error",
          message: t("account.profile.edit.errors.sessionRequired", {
            defaultMessage: "Necesitas iniciar sesión para actualizar tu perfil."
          })
        });
        helpers.setSubmitting(false);
        return;
      }

      helpers.setStatus(null);
      try {
        const normalizedPhone = values.phone ? normalizePhoneNumber(values.phone) : null;
        if (!normalizedPhone) {
          helpers.setStatus({
            type: "error",
            message: t("auth.register.errors.invalidPhone", {
              defaultMessage: "Ingresa un número de teléfono válido."
            })
          });
          helpers.setSubmitting(false);
          return;
        }

        const trimmedEmail = values.email.trim();
        const normalizedEmail = trimmedEmail ? trimmedEmail.toLowerCase() : null;

        const payload = {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim() || null,
          email: normalizedEmail,
          phone: normalizedPhone,
          locale
        } as const;

        const updated = await StorefrontApi.updateAccountProfile(session.accessToken, payload);
        helpers.setStatus({
          type: "success",
          message: t("account.profile.edit.success", {
            defaultMessage: "Perfil actualizado correctamente."
          })
        });
        onUpdated?.(updated);
      } catch (cause) {
        const message = isApiError(cause)
          ? translateProfileError(extractApiErrorMessage(cause), t)
          : cause instanceof Error
            ? translateProfileError(cause.message, t)
            : t("account.profile.edit.errors.generic", {
                defaultMessage: "No pudimos actualizar tu perfil."
              });
        helpers.setStatus({ type: "error", message });
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [locale, onUpdated, session?.accessToken, t]
  );

  return (
    <>
      <FlexBox alignItems="center" mb="22px">
        <Avatar src={profile.avatarUrl ?? "/assets/images/faces/ralph.png"} size={64} borderRadius={12} />

        <Box ml="12px">
          <Typography fontSize="13px" color="text.muted">
            {profile.avatarUrl
              ? t("account.profile.edit.avatar.current", {
                  defaultMessage: "Se está mostrando tu foto actual."
                })
              : t("account.profile.edit.avatar.fallback", {
                  defaultMessage: "Se muestra la foto por defecto hasta que haya una imagen disponible."
                })}
          </Typography>
          <Typography fontSize="12px" color="text.muted" mt="0.35rem">
            {t("account.profile.edit.avatar.note", {
              defaultMessage:
                "Si ingresaste con Google y tu cuenta tiene foto, se mostrará aquí automáticamente. En caso contrario usamos la imagen por defecto."
            })}
          </Typography>
        </Box>
      </FlexBox>

      <Formik
        onSubmit={handleFormSubmit}
        initialValues={INITIAL_VALUES}
        validationSchema={validationSchema}
        enableReinitialize
      >
        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, status }) => (
          <form onSubmit={handleSubmit}>
            <Box mb="30px">
              <Grid container horizontal_spacing={6} vertical_spacing={4}>
                <Grid item md={6} xs={12}>
                  <TextField
                    fullWidth
                    name="firstName"
                    label={t("First name")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.firstName}
                    errorText={touched.firstName ? errors.firstName : undefined}
                  />
                </Grid>

                <Grid item md={6} xs={12}>
                  <TextField
                    fullWidth
                    name="lastName"
                    label={t("Last name")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.lastName}
                    errorText={touched.lastName ? errors.lastName : undefined}
                  />
                </Grid>

                <Grid item md={6} xs={12}>
                  <TextField
                    fullWidth
                    name="email"
                    type="email"
                    label={t("account.profile.edit.fields.emailOptional", {
                      defaultMessage: "Correo electrónico (opcional)"
                    })}
                    onBlur={handleBlur}
                    value={values.email}
                    onChange={handleChange}
                    errorText={touched.email ? errors.email : undefined}
                  />
                  <Typography fontSize="12px" color="text.muted" mt="0.35rem">
                    {t("account.profile.edit.emailHint", {
                      defaultMessage: "Opcional. Si lo informas, debe ser único en el sistema."
                    })}
                  </Typography>
                </Grid>

                <Grid item md={6} xs={12}>
                  <TextField
                    fullWidth
                    label={t("Phone number")}
                    name="phone"
                    onBlur={handleBlur}
                    value={values.phone}
                    onChange={handleChange}
                    errorText={touched.phone ? errors.phone : undefined}
                  />
                  <Typography fontSize="12px" color="text.muted" mt="0.35rem">
                    {t("account.profile.edit.phoneHint", {
                      defaultMessage:
                        "Obligatorio. Puedes ingresarlo con o sin +598 o con 0 inicial; el sistema lo normaliza."
                    })}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {status?.message && (
              <Typography mb="1rem" fontSize="14px" color={status.type === "error" ? "error.main" : "success.main"}>
                {status.message}
              </Typography>
            )}

            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
              {t("account.profile.edit.submit", { defaultMessage: "Guardar cambios" })}
            </Button>
          </form>
        )}
      </Formik>
    </>
  );
}
