"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useFormik, type FormikHelpers } from "formik";
import * as yup from "yup";

import FlexBox from "@component/FlexBox";
import TextField from "@component/text-field";
import { Button, IconButton } from "@component/buttons";
import { H3, H5, H6, SemiSpan, Small } from "@component/Typography";
import Divide from "./components/Divide";
import SocialLinks from "./components/SocialLinks";
import { StyledRoot } from "./styles";
import useVisibility from "./useVisibility";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { resolveStorefrontRecaptchaToken } from "@/lib/security/storefront-recaptcha";
import { looksLikePhoneNumber } from "@/lib/utils/phone";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { useSession } from "@/state/session-context";
import { useTranslation } from "@/state/i18n-context";

const defaultValidationSchema = yup.object({
  identifier: yup
    .string()
    .required("Email or phone number is required")
    .test("identifier-format", "Please enter a valid email or phone number", (value) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return false;
      }
      return yup.string().email().isValidSync(trimmed) || looksLikePhoneNumber(trimmed);
    }),
  password: yup.string().required("Password is required")
});

export type LoginFormValues = yup.InferType<typeof defaultValidationSchema>;

const defaultInitialValues: LoginFormValues = {
  identifier: "",
  password: ""
};

type LoginProps = {
  title?: string;
  subtitle?: string;
  onSubmit?: (
    values: LoginFormValues,
    formikHelpers: FormikHelpers<LoginFormValues>,
    meta: { recaptchaToken?: string }
  ) => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
  registerHref?: string;
  registerLabel?: string;
  forgotPasswordHref?: string;
  forgotPasswordLabel?: string;
  onGoogleSignIn?: () => Promise<void> | void;
  googleSubmitting?: boolean;
  googleEnabled?: boolean;
};

export default function Login({
  title,
  subtitle,
  onSubmit,
  submitting,
  errorMessage,
  registerHref = "/account/register",
  registerLabel = "Sign Up",
  forgotPasswordHref = "/",
  forgotPasswordLabel = "Reset It",
  onGoogleSignIn,
  googleSubmitting,
  googleEnabled = true
}: LoginProps) {
  const router = useRouter();
  const t = useTranslation();
  const storefrontConfig = useStorefrontConfig();
  const { login, clearError } = useSession();
  const { passwordVisibility, togglePasswordVisibility } = useVisibility();

  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const managesSubmitting = submitting === undefined;

  const effectiveSubmitting = submitting ?? internalSubmitting;
  const effectiveGoogleSubmitting = Boolean(googleSubmitting);
  const resolvedTitle =
    title ??
    t("auth.login.modalTitle", {
      defaultMessage: "Bienvenido"
    });
  const resolvedSubtitle =
    subtitle ??
    t("auth.login.modalSubtitle", {
      defaultMessage: "Iniciá sesión con tu correo, teléfono y contraseña"
    });

  const handleGoogleSignIn = useCallback(() => {
    if (!onGoogleSignIn) return;
    void onGoogleSignIn();
  }, [onGoogleSignIn]);

  const { values, errors, touched, handleBlur, handleChange, handleSubmit } = useFormik<
    LoginFormValues
  >({
    initialValues: defaultInitialValues,
    validationSchema: defaultValidationSchema,
    onSubmit: async (formValues, helpers) => {
      const submitHandler =
        onSubmit ??
        (async (
          submittedValues: LoginFormValues,
          helpers: FormikHelpers<LoginFormValues>,
          meta: { recaptchaToken?: string }
        ) => {
          clearError();
          const trimmedIdentifier = submittedValues.identifier.trim();
          let payloadIdentifier = trimmedIdentifier;

          if (looksLikePhoneNumber(trimmedIdentifier)) {
            const normalized = normalizePhoneNumber(trimmedIdentifier);
            if (!normalized) {
              helpers.setFieldError("identifier", "Enter a valid phone number");
              return;
            }
            payloadIdentifier = normalized;
          }

          await login(payloadIdentifier, submittedValues.password, meta.recaptchaToken);
          router.push("/account/profile");
        });

      if (managesSubmitting) {
        setInternalSubmitting(true);
      }

      try {
        const recaptchaToken = await resolveStorefrontRecaptchaToken(
          storefrontConfig,
          "storefront_login"
        );
        await submitHandler(formValues, helpers, { recaptchaToken });
      } finally {
        if (managesSubmitting) {
          setInternalSubmitting(false);
        }
      }
    }
  });

  return (
    <StyledRoot boxShadow="large" borderRadius={8}>
      <form className="content" onSubmit={handleSubmit} data-testid="auth-login-form">
        <H3 textAlign="center" mb="0.5rem">
          {resolvedTitle}
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2.25rem">
          {resolvedSubtitle}
        </H5>

        <TextField
          fullWidth
          mb="0.75rem"
          name="identifier"
          type="text"
          data-testid="auth-login-identifier"
          onBlur={handleBlur}
          value={values.identifier}
          onChange={handleChange}
          placeholder={t("auth.login.identifierPlaceholder", {
            defaultMessage: "tu@email.com o +598 99 000 000"
          })}
          label={t("auth.login.identifierLabel", {
            defaultMessage: "Correo electrónico o teléfono"
          })}
          errorText={touched.identifier ? errors.identifier : undefined}
        />

        <TextField
          mb="1rem"
          fullWidth
          name="password"
          label="Password"
          data-testid="auth-login-password"
          autoComplete="current-password"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="*********"
          value={values.password}
          errorText={touched.password ? errors.password : undefined}
          type={passwordVisibility ? "text" : "password"}
          endAdornment={
            <IconButton
              p="0.25rem"
              mr="0.25rem"
              type="button"
              onClick={togglePasswordVisibility}
              color={passwordVisibility ? "gray.700" : "gray.600"}>
              {passwordVisibility ? <IconEyeOff stroke={1.5} /> : <IconEye stroke={1.5} />}
            </IconButton>
          }
        />

        {errorMessage ? (
          <Small color="error.main" display="block" mb="1rem" data-testid="auth-login-error">
            {errorMessage}
          </Small>
        ) : null}

        <Button
          mb="1.65rem"
          variant="contained"
          color="primary"
          type="submit"
          data-testid="auth-login-submit"
          fullWidth
          disabled={effectiveSubmitting}>
          {effectiveSubmitting
            ? t("auth.login.submitting", { defaultMessage: "Ingresando..." })
            : t("auth.login.submit", { defaultMessage: "Iniciar sesión" })}
        </Button>

        <Divide />

        <SocialLinks
          onGoogleClick={handleGoogleSignIn}
          googleDisabled={effectiveSubmitting}
          googleLoading={effectiveGoogleSubmitting}
          googleEnabled={googleEnabled}
        />

        <FlexBox justifyContent="center" mb="1.25rem">
          <SemiSpan>{t("auth.login.registerPrompt", { defaultMessage: "¿No tenés cuenta?" })}</SemiSpan>
          <Link href={registerHref}>
            <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
              {registerLabel}
            </H6>
          </Link>
        </FlexBox>
      </form>

      <FlexBox justifyContent="center" bg="gray.200" py="19px">
        <SemiSpan>{t("auth.login.forgotPrompt", { defaultMessage: "¿Olvidaste tu contraseña?" })}</SemiSpan>
        <Link href={forgotPasswordHref}>
          <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
            {forgotPasswordLabel}
          </H6>
        </Link>
      </FlexBox>
    </StyledRoot>
  );
}
