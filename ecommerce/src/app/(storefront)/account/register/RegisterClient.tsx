"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useFormik } from "formik";
import * as yup from "yup";

import { useSession } from "@/state/session-context";
import { normalizePhoneNumber } from "@/lib/utils/phone";

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

const formSchema = yup.object({
  firstName: yup.string().trim().required("First name is required"),
  lastName: yup.string().trim().required("Last name is required"),
  email: yup.string().email("Enter a valid email").required("Email is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .min(6, "Enter a valid phone number"),
  password: yup.string().required("Password is required").min(8, "Use at least 8 characters"),
  confirmPassword: yup
    .string()
    .required("Confirm your password")
    .oneOf([yup.ref("password")], "Passwords must match"),
  agreement: yup
    .bool()
    .oneOf([true], "You must accept the Terms & Conditions to continue")
    .required()
});

type FormValues = yup.InferType<typeof formSchema>;

export default function RegisterClient() {
  const router = useRouter();
  const { register, error, clearError } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const togglePassword = () => setShowPassword((prev) => !prev);

  const handleFormSubmit = async (values: FormValues) => {
    clearError();
    const normalizedPhone = normalizePhoneNumber(values.phone);
    if (!normalizedPhone) {
      setFieldError("phone", "Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: normalizedPhone
      });
      router.replace("/");
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
    initialValues,
    validationSchema: formSchema,
    onSubmit: handleFormSubmit
  });

  return (
    <StyledRoot mx="auto" my="2rem" boxShadow="large" borderRadius={8}>
      <form className="content" onSubmit={handleSubmit}>
        <H3 textAlign="center" mb="0.5rem">
          Create your account
        </H3>

        <H5 fontWeight="600" fontSize="12px" color="gray.800" textAlign="center" mb="2.25rem">
          Fill in the details below to access the storefront dashboard.
        </H5>

        <TextField
          fullWidth
          name="firstName"
          mb="0.75rem"
          label="First name"
          onBlur={handleBlur}
          value={values.firstName}
          onChange={handleChange}
          placeholder="Jane"
          errorText={touched.firstName && errors.firstName}
          disabled={submitting}
        />

        <TextField
          fullWidth
          name="lastName"
          mb="0.75rem"
          label="Last name"
          onBlur={handleBlur}
          value={values.lastName}
          onChange={handleChange}
          placeholder="Doe"
          errorText={touched.lastName && errors.lastName}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="0.75rem"
          name="email"
          type="email"
          onBlur={handleBlur}
          value={values.email}
          onChange={handleChange}
          placeholder="you@example.com"
          label="Email address"
          errorText={touched.email && errors.email}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="0.75rem"
          name="phone"
          onBlur={handleBlur}
          value={values.phone}
          onChange={handleChange}
          placeholder="+1 (555) 000-0000"
          label="Phone number"
          errorText={touched.phone && errors.phone}
          disabled={submitting}
        />

        <TextField
          fullWidth
          mb="0.75rem"
          name="password"
          label="Password"
          placeholder="********"
          onBlur={handleBlur}
          value={values.password}
          onChange={handleChange}
          errorText={touched.password && errors.password}
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
          placeholder="********"
          label="Confirm password"
          onBlur={handleBlur}
          onChange={handleChange}
          value={values.confirmPassword}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          errorText={touched.confirmPassword && errors.confirmPassword}
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
          color="secondary"
          onChange={handleChange}
          checked={values.agreement}
          disabled={submitting}
          label={
            <FlexBox>
              <SemiSpan>By creating an account, you agree to our </SemiSpan>
              <H6 ml="0.5rem" borderBottom="1px solid" borderColor="gray.900">
                Terms & Conditions
              </H6>
            </FlexBox>
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
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <FlexBox justifyContent="center" bg="gray.200" py="19px">
        <SemiSpan>Already registered?</SemiSpan>
        <Button
          variant="text"
          color="secondary"
          ml="0.25rem"
          px={0}
          type="button"
          onClick={() => router.push("/account/login")}>
          <H6 borderBottom="1px solid" borderColor="secondary.main">
            Log in
          </H6>
        </Button>
      </FlexBox>
    </StyledRoot>
  );
}
