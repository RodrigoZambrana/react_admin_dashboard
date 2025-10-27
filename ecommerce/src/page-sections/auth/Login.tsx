"use client";

import { useState } from "react";
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

const defaultValidationSchema = yup.object({
  identifier: yup
    .string()
    .required("Email or phone number is required")
    .test("trimmed", "Please enter a valid email or phone number", (value) =>
      Boolean(value?.trim().length)
    ),
  password: yup.string().required("Password is required")
});

export type LoginFormValues = yup.InferType<typeof defaultValidationSchema>;

const defaultInitialValues: LoginFormValues = {
  identifier: "091284204",
  password: "Storefront@2024"
};

type LoginProps = {
  title?: string;
  subtitle?: string;
  onSubmit?: (
    values: LoginFormValues,
    formikHelpers: FormikHelpers<LoginFormValues>
  ) => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
  registerHref?: string;
  registerLabel?: string;
  forgotPasswordHref?: string;
  forgotPasswordLabel?: string;
};

export default function Login({
  title = "Welcome To Ecommerce",
  subtitle = "Log in with email & password",
  onSubmit,
  submitting,
  errorMessage,
  registerHref = "/signup",
  registerLabel = "Sign Up",
  forgotPasswordHref = "/",
  forgotPasswordLabel = "Reset It"
}: LoginProps) {
  const router = useRouter();
  const { passwordVisibility, togglePasswordVisibility } = useVisibility();

  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const managesSubmitting = submitting === undefined;

  const effectiveSubmitting = submitting ?? internalSubmitting;

  const { values, errors, touched, handleBlur, handleChange, handleSubmit } = useFormik<
    LoginFormValues
  >({
    initialValues: defaultInitialValues,
    validationSchema: defaultValidationSchema,
    onSubmit: async (formValues, helpers) => {
      const submitHandler =
        onSubmit ??
        (async () => {
          router.push("/profile");
        });

      if (managesSubmitting) {
        setInternalSubmitting(true);
      }

      try {
        await submitHandler(formValues, helpers);
      } finally {
        if (managesSubmitting) {
          setInternalSubmitting(false);
        }
      }
    }
  });

  return (
    <StyledRoot boxShadow="large" borderRadius={8}>
      <form className="content" onSubmit={handleSubmit}>
        <H3 textAlign="center" mb="0.5rem">
          {title}
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2.25rem">
          {subtitle}
        </H5>

        <TextField
          fullWidth
          mb="0.75rem"
          name="identifier"
          type="text"
          onBlur={handleBlur}
          value={values.identifier}
          onChange={handleChange}
          placeholder="you@example.com or +1 (555) 000-0000"
          label="Email or Phone Number"
          errorText={touched.identifier && errors.identifier}
        />

        <TextField
          mb="1rem"
          fullWidth
          name="password"
          label="Password"
          autoComplete="current-password"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="*********"
          value={values.password}
          errorText={touched.password && errors.password}
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
          <Small color="error.main" display="block" mb="1rem">
            {errorMessage}
          </Small>
        ) : null}

        <Button
          mb="1.65rem"
          variant="contained"
          color="primary"
          type="submit"
          fullWidth
          disabled={effectiveSubmitting}>
          {effectiveSubmitting ? "Signing in..." : "Login"}
        </Button>

        <Divide />

        <SocialLinks />

        <FlexBox justifyContent="center" mb="1.25rem">
          <SemiSpan>Don’t have account?</SemiSpan>
          <Link href={registerHref}>
            <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
              {registerLabel}
            </H6>
          </Link>
        </FlexBox>
      </form>

      <FlexBox justifyContent="center" bg="gray.200" py="19px">
        <SemiSpan>Forgot your password?</SemiSpan>
        <Link href={forgotPasswordHref}>
          <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
            {forgotPasswordLabel}
          </H6>
        </Link>
      </FlexBox>
    </StyledRoot>
  );
}
