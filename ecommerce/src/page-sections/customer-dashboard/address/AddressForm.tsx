"use client";

import { useEffect, useMemo } from "react";
import * as yup from "yup";
import { Formik, FormikHelpers, useFormikContext } from "formik";
import { useRouter } from "next/navigation";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";
import TextArea from "@component/textarea";
import CheckBox from "@component/CheckBox";
import Typography from "@component/Typography";

import CountrySelect from "@/components/country-city/CountrySelect";
import CitySelect from "@/components/country-city/CitySelect";
import { deriveCountryCode, useCountryCityData } from "@/lib/country-city";
import { StorefrontApi, StorefrontAddressInput, isApiError } from "@/lib/api/storefront";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import Address from "@models/address.model";
import { useToast } from "@/contexts/ToastContext";

const VALIDATION_SCHEMA = yup.object({
  label: yup.string().nullable(),
  street: yup.string().required("Street is required"),
  number: yup
    .string()
    .matches(/^\d+$/, {
      message: "Please enter numbers only.",
      excludeEmptyString: true
    })
    .required("Number is required"),
  corner: yup.string().nullable(),
  apartment: yup.string().nullable(),
  city: yup.string().required("City is required"),
  country: yup.string().required("Country is required"),
  countryCode: yup
    .string()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .notRequired(),
  comments: yup.string().nullable(),
  isPrimary: yup.boolean()
});

export type AddressFormValues = yup.InferType<typeof VALIDATION_SCHEMA>;

type AddressFormProps = { address?: Address };
type FormStatus = { error?: string };

const parseLine1 = (line1?: string | null) => {
  if (!line1) {
    return { street: "", number: "" };
  }
  const trimmed = line1.trim();
  if (!trimmed) {
    return { street: "", number: "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { street: trimmed, number: "" };
  }
  const last = parts[parts.length - 1];
  if (/^\d+[A-Za-z-]*$/.test(last)) {
    return {
      street: parts.slice(0, -1).join(" "),
      number: last
    };
  }
  return { street: trimmed, number: "" };
};

const parseLine2 = (line2?: string | null) => {
  if (!line2) return { apartment: "", corner: "", comments: "" };
  const tokens = line2.split(",").map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return { apartment: "", corner: "", comments: "" };
  }
  const [first, second, ...rest] = tokens;
  return {
    apartment: first || "",
    corner: second || "",
    comments: rest.join(", ")
  };
};

const buildInitialValues = (address?: Address): AddressFormValues => {
  const { street, number } =
    address?.street || address?.number
      ? {
          street: address?.street ?? "",
          number: address?.number ?? ""
        }
      : parseLine1(address?.line1);
  const line2Parsed =
    address?.apartment || address?.corner || address?.comments
      ? {
          apartment: address?.apartment ?? "",
          corner: address?.corner ?? "",
          comments: address?.comments ?? ""
        }
      : parseLine2(address?.line2);

  const country = address?.state || address?.country || "";
  const countryCode = address?.countryCode || (country ? deriveCountryCode(country) : "");

  return {
    label: address?.label ?? "",
    street: address?.street ?? street ?? "",
    number: address?.number ?? number ?? "",
    corner: address?.corner ?? line2Parsed.corner ?? "",
    apartment: address?.apartment ?? line2Parsed.apartment ?? "",
    city: address?.city ?? "",
    country,
    countryCode,
    comments: address?.comments ?? line2Parsed.comments ?? "",
    isPrimary: address?.isPrimary ?? true
  };
};

function AddressFormFields({ address }: { address?: Address }) {
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
    setFieldValue,
    status
  } = useFormikContext<AddressFormValues>();
  const { rows, countries, getFirstCityForCountry } = useCountryCityData();

  useEffect(() => {
    if (!rows || rows.length === 0) return;
    if (values.country && values.city) return;

    const hasUruguay = rows.some(
      (row) => (row.country_name ?? "").trim().toLowerCase() === "uruguay"
    );
    const preferredCountry = (() => {
      if (values.country) return values.country;
      if (address?.state) return address.state;
      if (address?.country) return address.country;
      if (hasUruguay) return "Uruguay";
      return countries[0] ?? "";
    })();

    if (preferredCountry) {
      const nextCity = getFirstCityForCountry(preferredCountry);
      const nextCode = deriveCountryCode(preferredCountry);
      if (!values.country) {
        setFieldValue("country", preferredCountry, false);
      }
      if (!values.countryCode) {
        setFieldValue("countryCode", nextCode, false);
      }
      if (!values.city && nextCity) {
        setFieldValue("city", nextCity, false);
      }
    }
  }, [
    rows,
      countries,
    values.country,
    values.city,
    values.countryCode,
    address?.state,
    address?.country,
    setFieldValue,
    getFirstCityForCountry
  ]);

  const labelError = touched.label && typeof errors.label === "string" ? errors.label : undefined;
  const streetError = touched.street && typeof errors.street === "string" ? errors.street : undefined;
  const numberError = touched.number && typeof errors.number === "string" ? errors.number : undefined;
  const cityError = touched.city && typeof errors.city === "string" ? errors.city : undefined;
  const countryError =
    touched.country && typeof errors.country === "string" ? errors.country : undefined;
  const cornerError = touched.corner && typeof errors.corner === "string" ? errors.corner : undefined;
  const apartmentError =
    touched.apartment && typeof errors.apartment === "string" ? errors.apartment : undefined;
  const commentsError =
    touched.comments && typeof errors.comments === "string" ? errors.comments : undefined;

  return (
    <form onSubmit={handleSubmit}>
      <Box mb="30px">
        <Grid container horizontal_spacing={6} vertical_spacing={4}>
          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="label"
              label="Label"
              placeholder="Home, Office, etc."
              onBlur={handleBlur}
              value={values.label ?? ""}
              onChange={handleChange}
              errorText={labelError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <CheckBox
              checked={Boolean(values.isPrimary)}
              onChange={(event) => setFieldValue("isPrimary", event.target.checked)}
              label="Use as primary address"
              mt="1.75rem"
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="street"
              label="Street"
              placeholder="Enter street name"
              onBlur={handleBlur}
              value={values.street}
              onChange={handleChange}
              errorText={streetError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="number"
              label="Number"
              placeholder="House or building number"
              onBlur={handleBlur}
              value={values.number}
              onChange={handleChange}
              errorText={numberError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="corner"
              label="Corner"
              placeholder="Nearest cross street"
              onBlur={handleBlur}
              value={values.corner ?? ""}
              onChange={handleChange}
              errorText={cornerError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="apartment"
              label="Apartment / Unit"
              placeholder="Apt, suite, floor, etc."
              onBlur={handleBlur}
              value={values.apartment ?? ""}
              onChange={handleChange}
              errorText={apartmentError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <CountrySelect
              label="Country"
              value={{ name: values.country, code: values.countryCode ?? undefined }}
              errorText={countryError}
              onChange={(selection) => {
                const nextName = selection.name ?? "";
                const nextCode = selection.code ?? (nextName ? deriveCountryCode(nextName) : "");
                setFieldValue("country", nextName);
                setFieldValue("countryCode", nextCode);
                if (nextName) {
                  const nextCity = getFirstCityForCountry(nextName);
                  setFieldValue("city", nextCity || "");
                } else {
                  setFieldValue("city", "");
                }
              }}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <CitySelect
              label="City"
              countryCode={values.countryCode ?? undefined}
              countryName={values.country}
              value={values.city}
              errorText={cityError}
              onChange={(city) => setFieldValue("city", city ?? "")}
            />
          </Grid>

          <Grid item xs={12}>
            <TextArea
              fullWidth
              rows={4}
              name="comments"
              placeholder="Delivery notes, reference points, etc."
              value={values.comments ?? ""}
              onBlur={handleBlur}
              onChange={(event) => setFieldValue("comments", event.target.value)}
              errorText={commentsError}
              label="Additional notes"
            />
          </Grid>
        </Grid>
      </Box>

      {status && (status as FormStatus)?.error && (
        <Typography color="error.main" mb="1rem" fontSize="0.875rem">
          {(status as FormStatus).error}
        </Typography>
      )}

      <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
        Save Changes
      </Button>
    </form>
  );
}

export default function AddressForm({ address }: AddressFormProps) {
  const initialValues = useMemo(() => buildInitialValues(address), [address]);

  const { token, updateLocalProfile } = useAccountProfile();
  const router = useRouter();
  const isEditing = Boolean(address?.id);
  const toast = useToast();

  const handleFormSubmit = async (values: AddressFormValues, helpers: FormikHelpers<AddressFormValues>) => {
    if (!token) {
      const message = "You must be signed in to manage addresses.";
      helpers.setStatus({ error: message });
      toast.error({
        title: "Inicia sesión para continuar",
        description: "Debes iniciar sesión para administrar tus direcciones."
      });
      helpers.setSubmitting(false);
      return;
    }

    const normalizeOptional = (value?: string | null) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const payload: StorefrontAddressInput = {
      street: values.street.trim(),
      number: values.number.trim(),
      city: values.city.trim(),
      country: values.country.trim(),
      label: normalizeOptional(values.label ?? null) ?? null,
      corner: normalizeOptional(values.corner ?? null) ?? null,
      apartment: normalizeOptional(values.apartment ?? null) ?? null,
      comments: normalizeOptional(values.comments ?? null) ?? null,
      isPrimary: Boolean(values.isPrimary)
    };

    const addressId = address ? Number(address.id) : null;
    if (isEditing && (!addressId || Number.isNaN(addressId))) {
      const message = "Unable to determine address to update.";
      helpers.setStatus({ error: message });
      toast.error({
        title: "No pudimos actualizar la dirección",
        description: message
      });
      helpers.setSubmitting(false);
      return;
    }

    try {
      helpers.setStatus(null);
      const profile = isEditing && addressId
        ? await StorefrontApi.updateAddress(token, addressId, payload)
        : await StorefrontApi.createAddress(token, payload);

      updateLocalProfile(profile);
      helpers.setSubmitting(false);
      toast.success({
        title: isEditing ? "Dirección actualizada" : "Dirección guardada",
        description: isEditing
          ? "Actualizamos la dirección en tu cuenta."
          : "Agregamos la nueva dirección a tu cuenta."
      });
      router.push("/address");
    } catch (error) {
      let message = "Unable to save address. Please try again.";
      if (isApiError(error)) {
        message = error.payload?.message ?? error.message ?? message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      helpers.setStatus({ error: message });
      helpers.setSubmitting(false);
      toast.error({
        title: "No pudimos guardar la dirección",
        description: message
      });
    }
  };

  return (
    <Formik<AddressFormValues>
      enableReinitialize
      onSubmit={handleFormSubmit}
      initialValues={initialValues}
      validationSchema={VALIDATION_SCHEMA}>
      <AddressFormFields address={address} />
    </Formik>
  );
}
