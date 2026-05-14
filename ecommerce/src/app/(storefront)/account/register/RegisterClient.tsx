"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as yup from "yup";

import { useSession } from "@/state/session-context";
import { useI18n, useTranslation } from "@/state/i18n-context";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { resolveStorefrontRecaptchaToken } from "@/lib/security/storefront-recaptcha";

import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import CheckBox from "@component/CheckBox";
import TextField from "@component/text-field";
import { Button, IconButton } from "@component/buttons";
import { H3, H5, H6, SemiSpan, Small } from "@component/Typography";
import { StyledRoot } from "@sections/auth/styles";

const initialValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  agreement: false
};

type FormValues = typeof initialValues;

export default function RegisterClient() {
  const router = useRouter();
  const { register, error, clearError } = useSession();
  const storefrontConfig = useStorefrontConfig();
  const { locale } = useI18n();
  const t = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const formSchema = useMemo(
    () =>
      yup.object({
        firstName: yup
          .string()
          .trim()
          .required(t("First name is required", { defaultMessage: "First name is required" })),
        lastName: yup
          .string()
          .trim()
          .required(t("Last name is required", { defaultMessage: "Last name is required" })),
        email: yup
          .string()
          .trim()
          .test("email-or-empty", t("Enter a valid email", { defaultMessage: "Enter a valid email" }), (value) => {
            if (!value || value.trim().length === 0) return true;
            return yup.string().email().isValidSync(value.trim());
          }),
        phone: yup
          .string()
          .trim()
          .test("phone-or-empty", t("Enter a valid phone number", { defaultMessage: "Enter a valid phone number" }), (value) => {
            if (!value || value.trim().length === 0) return true;
            return value.trim().length >= 6;
          }),
        password: yup
          .string()
          .required(t("Password is required", { defaultMessage: "Password is required" }))
          .min(8, t("Use at least 8 characters", { defaultMessage: "Use at least 8 characters" })),
        confirmPassword: yup
          .string()
          .required(t("Confirm your password", { defaultMessage: "Confirm your password" }))
          .oneOf([yup.ref("password")], t("Passwords must match", { defaultMessage: "Passwords must match" })),
        agreement: yup
          .bool()
          .oneOf(
            [true],
            t("auth.register.errors.termsRequired", {
              defaultMessage: "Debes aceptar los términos y condiciones para continuar."
            }),
          )
          .required(),
      }),
    [t],
  );

  const togglePassword = () => setShowPassword((prev) => !prev);

  const handleFormSubmit = async (values: FormValues) => {
    clearError();
    const email = values.email.trim();
    const phone = values.phone.trim();
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    if (!email && !phone) {
      const contactMessage = t("auth.register.errors.contactRequired", {
        defaultMessage: "Debes ingresar un correo o un teléfono."
      });
      setFieldError("email", contactMessage);
      setFieldError("phone", contactMessage);
      return;
    }
    if (phone && !normalizedPhone) {
      setFieldError(
        "phone",
        t("Enter a valid phone number", { defaultMessage: "Enter a valid phone number" }),
      );
      return;
    }
    setSubmitting(true);
    try {
      await register({
        email: email || undefined,
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: normalizedPhone ?? undefined,
        locale,
        recaptchaToken: await resolveStorefrontRecaptchaToken(
          storefrontConfig,
          "storefront_register"
        )
      });
      router.replace("/account/profile");
    } catch (err) {
      // session context provides the error message; nothing else to do here
    } finally {
      setSubmitting(false);
    }
  };

  const {
    values,
    errors,
    touched,
    handleBlur,
    handleChange,
    handleSubmit,
    setFieldError
  } = useFormik<FormValues>({
    enableReinitialize: true,
    initialValues,
    validationSchema: formSchema,
    onSubmit: handleFormSubmit
  });

  return (
    <StyledRoot mx="auto" my="2rem" boxShadow="large" borderRadius={8}>
      <form className="content" onSubmit={handleSubmit} data-testid="auth-register-form">
        <H3 textAlign="center" mb="0.5rem">
          {t("auth.register.title", { defaultMessage: "Creá tu cuenta" })}
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2.25rem">
          {t("auth.register.subtitle", {
            defaultMessage: "Registrate con correo o teléfono para guardar pedidos, presupuestos y seguimiento."
          })}
        </H5>

        <Small color="text.muted" display="block" mb="1rem">
          {t("auth.register.contactRule", {
            defaultMessage:
              "Podés crear tu cuenta con correo, con teléfono o con ambos. Si la validación por SMS no está activa, el alta continúa igual."
          })}
        </Small>

        {storefrontConfig.integrations?.recaptcha?.enabled ? (
          <Small color="text.muted" display="block" mb="1rem">
            {t("auth.signIn.recaptchaMessage", {
              defaultMessage: "reCAPTCHA Enterprise protege esta acción."
            })}
          </Small>
        ) : null}

        <TextField
          fullWidth
          name="firstName"
          mb="0.75rem"
          data-testid="auth-register-first-name"
          label={t("First name")}
          onBlur={handleBlur}
          value={values.firstName}
          onChange={handleChange}
          placeholder={t("auth.register.placeholders.firstName", { defaultMessage: "Jane" })}
          errorText={touched.firstName ? errors.firstName : undefined}
          disabled={submitting}
        />

        <TextField
          fullWidth
          name="lastName"
          mb="0.75rem"
          data-testid="auth-register-last-name"
          label={t("Last name")}
          onBlur={handleBlur}
          value={values.lastName}
          onChange={handleChange}
          placeholder={t("auth.register.placeholders.lastName", { defaultMessage: "Doe" })}
          errorText={touched.lastName ? errors.lastName : undefined}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="0.75rem"
          name="email"
          type="email"
          data-testid="auth-register-email"
          onBlur={handleBlur}
          value={values.email}
          onChange={handleChange}
          placeholder={t("auth.register.placeholders.email", { defaultMessage: "you@example.com" })}
          label={t("auth.register.fields.emailOptional", {
            defaultMessage: "Correo electrónico"
          })}
          errorText={touched.email ? errors.email : undefined}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="0.75rem"
          name="phone"
          data-testid="auth-register-phone"
          onBlur={handleBlur}
          value={values.phone}
          onChange={handleChange}
          placeholder={t("auth.register.placeholders.phone", { defaultMessage: "+598 99 000 000" })}
          label={t("Phone number", { defaultMessage: "Teléfono" })}
          errorText={touched.phone ? errors.phone : undefined}
          disabled={submitting}
        />

        <Small color="text.muted" display="block" mb="0.75rem">
          {t("auth.register.phoneHint", {
            defaultMessage: "Ingresalo con o sin +598. Lo usamos para contactarte y recuperar acceso si hace falta."
          })}
        </Small>

        <TextField
          fullWidth
          mb="0.75rem"
          name="password"
          data-testid="auth-register-password"
          label={t("Password", { defaultMessage: "Password" })}
          placeholder={t("auth.register.placeholders.password", { defaultMessage: "********" })}
          onBlur={handleBlur}
          value={values.password}
          onChange={handleChange}
          errorText={touched.password ? errors.password : undefined}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          disabled={submitting}
          endAdornment={
            <IconButton
              p="0.25rem"
              mr="0.25rem"
              type="button"
              color={showPassword ? "gray.700" : "gray.600"}
              onClick={togglePassword}>
              {showPassword ? (
                <Icon variant="small" defaultColor="currentColor">
                  eye-alt
                </Icon>
              ) : (
                <Icon variant="small" defaultColor="currentColor">
                  eye
                </Icon>
              )}
            </IconButton>
          }
        />

        <TextField
          mb="1rem"
          fullWidth
          name="confirmPassword"
          data-testid="auth-register-confirm-password"
          placeholder="********"
          label={t("auth.register.confirmPassword", { defaultMessage: "Confirm password" })}
          onBlur={handleBlur}
          onChange={handleChange}
          value={values.confirmPassword}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          errorText={touched.confirmPassword ? errors.confirmPassword : undefined}
          disabled={submitting}
          endAdornment={
            <IconButton
              p="0.25rem"
              mr="0.25rem"
              type="button"
              color={showPassword ? "gray.700" : "gray.600"}
              onClick={togglePassword}>
              {showPassword ? (
                <Icon variant="small" defaultColor="currentColor">
                  eye-alt
                </Icon>
              ) : (
                <Icon variant="small" defaultColor="currentColor">
                  eye
                </Icon>
              )}
            </IconButton>
          }
        />

        <CheckBox
          mb="1.5rem"
          name="agreement"
          data-testid="auth-register-agreement"
          color="secondary"
          onChange={handleChange}
          checked={values.agreement}
          disabled={submitting}
          onBlur={handleBlur}
          label={
            <FlexBox>
              <SemiSpan>
                {t("auth.register.termsPrefix", {
                  defaultMessage: "By creating an account, you agree to our"
                })}{" "}
              </SemiSpan>
              <Link href="/terms-and-conditions">
                <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
                  {t("auth.register.terms", { defaultMessage: "Terms & Conditions" })}
                </H6>
              </Link>
            </FlexBox>
          }
        />
        {touched.agreement && errors.agreement ? (
          <Small color="error.main" display="block" mb="1rem">
            {errors.agreement}
          </Small>
        ) : null}

        {error ? (
          <Small color="error.main" display="block" mb="1rem" data-testid="auth-register-error">
            {error}
          </Small>
        ) : null}

        <Button
          mb="1.65rem"
          variant="contained"
          color="primary"
          type="submit"
          data-testid="auth-register-submit"
          fullWidth
          disabled={submitting}>
          {submitting
            ? t("auth.register.creating", { defaultMessage: "Creating account..." })
            : t("auth.register.submit", { defaultMessage: "Create account" })}
        </Button>
      </form>

      <FlexBox justifyContent="center" bg="gray.200" py="19px">
        <SemiSpan>{t("auth.register.alreadyRegistered", { defaultMessage: "Already registered?" })}</SemiSpan>
        <Button
          variant="text"
          color="secondary"
          ml="0.25rem"
          px={0}
          type="button"
          onClick={() => router.push("/account/login")}>
          <H6 borderBottom="1px solid" borderColor="secondary.main">
            {t("auth.register.login", { defaultMessage: "Log in" })}
          </H6>
        </Button>
      </FlexBox>
    </StyledRoot>
  );
}
