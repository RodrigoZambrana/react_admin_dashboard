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
import type { CustomerProfile } from "@/types/storefront";

const VALIDATION_SCHEMA = yup.object().shape({
  firstName: yup.string().required("required"),
  lastName: yup.string().required("required"),
  email: yup.string().email("invalid email").required("required"),
  phone: yup.string().nullable()
});

interface ProfileEditFormProps {
  profile: CustomerProfile;
  onUpdated?: (profile: CustomerProfile) => void;
}

export default function ProfileEditForm({ profile, onUpdated }: ProfileEditFormProps) {
  const { session } = useSession();

  const INITIAL_VALUES = {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? ""
  };

  const handleFormSubmit = useCallback(
    async (
      values: typeof INITIAL_VALUES,
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
        const updated = await StorefrontApi.updateAccountProfile(session.accessToken, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phone: values.phone ? values.phone.trim() : undefined
        });
        helpers.setStatus({ type: "success", message: "Profile updated successfully." });
        onUpdated?.(updated);
      } catch (cause) {
        const message = isApiError(cause)
          ? cause.payload?.message ?? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to update profile.";
        helpers.setStatus({ type: "error", message });
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [onUpdated, session?.accessToken]
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

      <Formik onSubmit={handleFormSubmit} initialValues={INITIAL_VALUES} validationSchema={VALIDATION_SCHEMA}>
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
                    errorText={touched.firstName && errors.firstName}
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
                    errorText={touched.lastName && errors.lastName}
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
                    errorText={touched.email && errors.email}
                    disabled
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
                    errorText={touched.phone && errors.phone}
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

