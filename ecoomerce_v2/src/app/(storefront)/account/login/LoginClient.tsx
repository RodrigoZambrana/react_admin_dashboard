"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useFormik } from "formik";
import * as yup from "yup";

import { useSession } from "@/state/session-context";
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";

import FlexBox from "@component/FlexBox";
import TextField from "@component/text-field";
import { Button, IconButton } from "@component/buttons";
import { H3, H5, H6, SemiSpan, Small } from "@component/Typography";
import { StyledRoot } from "@sections/auth/styles";

const initialValues = {
  identifier: "",
  password: ""
};

const formSchema = yup.object({
  identifier: yup
    .string()
    .required("Email or phone number is required")
    .test("trimmed", "Please enter a valid email or phone number", (value) =>
      Boolean(value?.trim().length)
    ),
  password: yup.string().required("Password is required").min(8, "Use at least 8 characters")
});

type FormValues = yup.InferType<typeof formSchema>;

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => searchParams.get("next") ?? "/market-1", [searchParams]);

  const { login, status, isAuthenticated, error, clearError } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const togglePassword = () => setShowPassword((previous) => !previous);

  const handleFormSubmit = async (values: FormValues) => {
    clearError();
    const trimmedIdentifier = values.identifier.trim();
    let payloadIdentifier = trimmedIdentifier;
    if (looksLikePhoneNumber(trimmedIdentifier)) {
      const normalized = normalizePhoneNumber(trimmedIdentifier);
      if (!normalized) {
        setFieldError("identifier", "Enter a valid phone number");
        return;
      }
      payloadIdentifier = normalized;
    }
    setSubmitting(true);
    try {
      await login(payloadIdentifier, values.password);
      router.replace(redirectTo);
    } catch (err) {
      // error is handled in the session context; just stop the loader
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
    initialValues,
    validationSchema: formSchema,
    onSubmit: handleFormSubmit
  });

  if (status === "authenticated" && isAuthenticated) {
    router.replace(redirectTo);
    return null;
  }

  return (
    <StyledRoot boxShadow="large" borderRadius={8}>
      <form className="content" onSubmit={handleSubmit}>
        <H3 textAlign="center" mb="0.5rem">
          Welcome Back
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2.25rem">
          Log in with your email or phone number. Use the shared customer password provided by the
          team.
        </H5>

        <TextField
          fullWidth
          mb="0.75rem"
          name="identifier"
          onBlur={handleBlur}
          value={values.identifier}
          onChange={handleChange}
          placeholder="you@example.com or +1 (555) 000-0000"
          label="Email or Phone Number"
          errorText={touched.identifier && errors.identifier}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="1rem"
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="********"
          autoComplete="current-password"
          onBlur={handleBlur}
          value={values.password}
          onChange={handleChange}
          errorText={touched.password && errors.password}
          disabled={submitting}
          endAdornment={
            <IconButton
              p="0.25rem"
              mr="0.25rem"
              type="button"
              onClick={togglePassword}
              color={showPassword ? "gray.700" : "gray.600"}>
              {showPassword ? <IconEyeOff stroke={1.5} /> : <IconEye stroke={1.5} />}
            </IconButton>
          }
        />

        {error ? (
          <Small color="error.main" display="block" mb="1rem">
            {error}
          </Small>
        ) : null}

        <Button
          mb="1.65rem"
          variant="contained"
          color="primary"
          type="submit"
          fullWidth
          disabled={submitting}>
          {submitting ? "Signing in..." : "Login"}
        </Button>

        <FlexBox justifyContent="center" mb="1.25rem">
          <SemiSpan>Need an account?</SemiSpan>
          <Button
            variant="text"
            color="secondary"
            ml="0.25rem"
            px={0}
            type="button"
            onClick={() => router.push("/account/register")}>
            <H6 borderBottom="1px solid" borderColor="secondary.main">
              Create one
            </H6>
          </Button>
        </FlexBox>

        <FlexBox justifyContent="center">
          <SemiSpan>Forgot your password?</SemiSpan>
          <Button
            variant="text"
            color="secondary"
            ml="0.25rem"
            px={0}
            type="button"
            onClick={() => router.push("/account/forgot-password")}>
            <H6 borderBottom="1px solid" borderColor="secondary.main">
              Reset it
            </H6>
          </Button>
        </FlexBox>
      </form>
    </StyledRoot>
  );
}
