"use client";

import * as yup from "yup";
import { Formik } from "formik";
import { useCallback } from "react";
import { IconCamera } from "@tabler/icons-react";

import Box from "@component/Box";
import Hidden from "@component/hidden";
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
import { useI18n } from "@/state/i18n-context";

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const VALIDATION_SCHEMA = yup.object().shape({
  firstName: yup.string().trim().required("First name is required"),
  lastName: yup.string().trim().nullable(),
  email: yup
    .string()
    .trim()
    .email("Please enter a valid email")
    .nullable()
    .test("contact-required", "Please provide an email or phone number", function (value) {
      const phone = (this.parent as FormValues).phone;
      const hasEmail = Boolean(value && value.trim());
      const hasPhone = Boolean(phone && phone.trim());
      return hasEmail || hasPhone;
    }),
  phone: yup
    .string()
    .nullable()
    .test("phone-format", "Please enter a valid phone number", (value) => {
      if (!value) {
        return true;
      }
      return looksLikePhoneNumber(value);
    }),
});

interface ProfileEditFormProps {
  profile: CustomerProfile;
  onUpdated?: (profile: CustomerProfile) => void;
}

export default function ProfileEditForm({ profile, onUpdated }: ProfileEditFormProps) {
  const { session } = useSession();
  const { locale } = useI18n();

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
        helpers.setStatus({ type: "error", message: "You need to be logged in to update your profile." });
        helpers.setSubmitting(false);
        return;
      }

      helpers.setStatus(null);
      try {
        const normalizedPhone = values.phone ? normalizePhoneNumber(values.phone) : null;
        if (values.phone && !normalizedPhone) {
          helpers.setStatus({ type: "error", message: "Please enter a valid phone number." });
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
        helpers.setStatus({ type: "success", message: "Profile updated successfully." });
        onUpdated?.(updated);
      } catch (cause) {
        const message = isApiError(cause)
          ? extractApiErrorMessage(cause)
          : cause instanceof Error
            ? cause.message
            : "Unable to update profile.";
        helpers.setStatus({ type: "error", message });
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [locale, onUpdated, session?.accessToken]
  );

  return (
    <>
      <FlexBox alignItems="flex-end" mb="22px">
        <Avatar src={profile.avatarUrl ?? "/assets/images/faces/ralph.png"} size={64} borderRadius={12} />

        <Box ml="-20px" zIndex={1}>
          <label htmlFor="profile-image">
            <Button p="6px" as="span" size="small" height="auto" color="primary" borderRadius="50%">
              <IconCamera size={18} />
            </Button>
          </label>
        </Box>

        <Hidden>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="profile-image"
            onChange={(event) => console.log(event.target.files)}
          />
        </Hidden>
      </FlexBox>

      <Formik
        onSubmit={handleFormSubmit}
        initialValues={INITIAL_VALUES}
        validationSchema={VALIDATION_SCHEMA}
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
                    label="First Name"
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
                    label="Last Name"
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
                    label="Email"
                    onBlur={handleBlur}
                    value={values.email}
                    onChange={handleChange}
                    errorText={touched.email ? errors.email : undefined}
                  />
                </Grid>

                <Grid item md={6} xs={12}>
                  <TextField
                    fullWidth
                    label="Phone"
                    name="phone"
                    onBlur={handleBlur}
                    value={values.phone}
                    onChange={handleChange}
                    errorText={touched.phone ? errors.phone : undefined}
                  />
                </Grid>

              </Grid>
            </Box>

            {status?.message && (
              <Typography mb="1rem" fontSize="14px" color={status.type === "error" ? "error.main" : "success.main"}>
                {status.message}
              </Typography>
            )}

            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
              Save Changes
            </Button>
          </form>
        )}
      </Formik>
    </>
  );
}
