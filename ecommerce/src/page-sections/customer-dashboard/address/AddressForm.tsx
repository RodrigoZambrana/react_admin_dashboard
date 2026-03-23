"use client";

import { useEffect, useMemo, useRef } from "react";
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

import CitySelect from "@/components/country-city/CitySelect";
import { deriveCountryCode, useCountryCityData } from "@/lib/country-city";
import { StorefrontApi, StorefrontAddressInput, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import Address from "@models/address.model";
import { useToast } from "@/contexts/ToastContext";
import { useTranslation } from "@/state/i18n-context";

const DEFAULT_COUNTRY_NAME = "Uruguay";
const DEFAULT_COUNTRY_CODE = "UY";
const DEFAULT_CITY = "Montevideo";

const buildValidationSchema = (t: ReturnType<typeof useTranslation>) =>
  yup.object({
    label: yup.string().nullable(),
    street: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.streetRequired", { defaultMessage: "Debes ingresar la calle." })),
    number: yup
      .string()
      .matches(/^\d+$/, {
        message: t("account.address.form.errors.numberOnly", {
          defaultMessage: "Ingresa solo números."
        }),
        excludeEmptyString: true
      })
      .required(t("account.address.form.errors.numberRequired", { defaultMessage: "Debes ingresar el número." })),
    corner: yup.string().nullable(),
    apartment: yup.string().nullable(),
    city: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.cityRequired", {
        defaultMessage: "Debes seleccionar una ciudad o departamento."
      })),
    country: yup.string().trim().required(),
    countryCode: yup
      .string()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .notRequired(),
    comments: yup.string().nullable(),
    isPrimary: yup.boolean()
  });

export type AddressFormValues = {
  label: string | null;
  street: string;
  number: string;
  corner: string | null;
  apartment: string | null;
  city: string;
  country: string;
  countryCode?: string | null;
  comments: string | null;
  isPrimary: boolean;
};

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
    city: address?.city ?? DEFAULT_CITY,
    country: country || DEFAULT_COUNTRY_NAME,
    countryCode: countryCode || DEFAULT_COUNTRY_CODE,
    comments: address?.comments ?? line2Parsed.comments ?? "",
    isPrimary: address?.isPrimary ?? true
  };
};

function AddressFormFields({
  address,
  onSelectSubmitMode
}: {
  address?: Address;
  onSelectSubmitMode: (mode: "save" | "save_and_add_another") => void;
}) {
  const t = useTranslation();
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
  const { rows, getFirstCityForCountry } = useCountryCityData();

  useEffect(() => {
    if (!rows || rows.length === 0) return;
    if (values.country && values.city) return;

    const preferredCountry = (() => {
      if (values.country) return values.country;
      if (address?.state) return address.state;
      if (address?.country) return address.country;
      return DEFAULT_COUNTRY_NAME;
    })();

    if (preferredCountry) {
      const nextCity = values.city || getFirstCityForCountry(preferredCountry) || DEFAULT_CITY;
      setFieldValue("country", DEFAULT_COUNTRY_NAME, false);
      setFieldValue("countryCode", DEFAULT_COUNTRY_CODE, false);
      if (!values.city && nextCity) {
        setFieldValue("city", nextCity, false);
      }
    }
  }, [
    rows,
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
              label={t("account.address.form.label", { defaultMessage: "Etiqueta" })}
              placeholder={t("account.address.form.placeholder.label", {
                defaultMessage: "Casa, trabajo, etc."
              })}
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
              label={t("account.address.form.isPrimary", { defaultMessage: "Usar como dirección principal" })}
              mt="1.75rem"
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="street"
              label={t("account.address.form.street", { defaultMessage: "Calle" })}
              placeholder={t("account.address.form.placeholder.street", {
                defaultMessage: "Ingresa el nombre de la calle"
              })}
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
              label={t("account.address.form.number", { defaultMessage: "Número" })}
              placeholder={t("account.address.form.placeholder.number", {
                defaultMessage: "Número de puerta"
              })}
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
              label={t("account.address.form.corner", { defaultMessage: "Esquina" })}
              placeholder={t("account.address.form.placeholder.corner", {
                defaultMessage: "Esquina o calle de referencia"
              })}
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
              label={t("account.address.form.apartment", { defaultMessage: "Apartamento / Unidad" })}
              placeholder={t("account.address.form.placeholder.apartment", {
                defaultMessage: "Apto, unidad, piso, etc."
              })}
              onBlur={handleBlur}
              value={values.apartment ?? ""}
              onChange={handleChange}
              errorText={apartmentError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <TextField
              fullWidth
              name="country"
              label={t("account.address.form.country", { defaultMessage: "País" })}
              value={DEFAULT_COUNTRY_NAME}
              disabled
              errorText={countryError}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            <CitySelect
              label={t("account.address.form.city", { defaultMessage: "Ciudad / Departamento" })}
              countryCode={DEFAULT_COUNTRY_CODE}
              countryName={DEFAULT_COUNTRY_NAME}
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
              placeholder={t("account.address.form.placeholder.comments", {
                defaultMessage: "Indicaciones adicionales o referencias para la entrega"
              })}
              value={values.comments ?? ""}
              onBlur={handleBlur}
              onChange={(event) => setFieldValue("comments", event.target.value)}
              errorText={commentsError}
              label={t("account.address.form.comments", { defaultMessage: "Comentarios" })}
            />
          </Grid>
        </Grid>
      </Box>

      {status && (status as FormStatus)?.error && (
        <Typography color="error.main" mb="1rem" fontSize="0.875rem">
          {(status as FormStatus).error}
        </Typography>
      )}

      <Box display="flex" flexWrap="wrap" style={{ gap: "0.75rem" }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isSubmitting}
          onClick={() => onSelectSubmitMode("save")}
        >
          {t("account.address.form.save", { defaultMessage: "Guardar dirección" })}
        </Button>
        {!address ? (
          <Button
            type="submit"
            variant="outlined"
            color="primary"
            disabled={isSubmitting}
            onClick={() => {
              onSelectSubmitMode("save_and_add_another");
            }}
          >
            {t("account.address.form.saveAndAddAnother", {
              defaultMessage: "Guardar y agregar otra"
            })}
          </Button>
        ) : null}
      </Box>
    </form>
  );
}

export default function AddressForm({ address }: AddressFormProps) {
  const initialValues = useMemo(() => buildInitialValues(address), [address]);

  const { token, updateLocalProfile } = useAccountProfile();
  const router = useRouter();
  const isEditing = Boolean(address?.id);
  const toast = useToast();
  const t = useTranslation();
  const submitModeRef = useRef<"save" | "save_and_add_another">("save");
  const validationSchema = useMemo(() => buildValidationSchema(t), [t]);

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
      country: DEFAULT_COUNTRY_NAME,
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
        title: isEditing
          ? t("account.address.toast.updated.title", { defaultMessage: "Dirección actualizada" })
          : t("account.address.toast.created.title", { defaultMessage: "Dirección guardada" }),
        description: isEditing
          ? t("account.address.toast.updated.description", {
              defaultMessage: "Actualizamos la dirección en tu cuenta."
            })
          : submitModeRef.current === "save_and_add_another"
            ? t("account.address.toast.created.keepAdding", {
                defaultMessage: "Guardamos la dirección. Puedes agregar otra a continuación."
              })
            : t("account.address.toast.created.description", {
                defaultMessage: "Agregamos la nueva dirección a tu cuenta."
              })
      });
      if (!isEditing && submitModeRef.current === "save_and_add_another") {
        helpers.resetForm({ values: buildInitialValues() });
        helpers.setStatus(null);
        submitModeRef.current = "save";
        return;
      }
      submitModeRef.current = "save";
      router.push("/account/address");
    } catch (error) {
      let message = "Unable to save address. Please try again.";
      if (isApiError(error)) {
        const resolved = extractApiErrorMessage(error);
        message = resolved || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      helpers.setStatus({ error: message });
      helpers.setSubmitting(false);
      toast.error({
        title: t("account.address.toast.error.title", {
          defaultMessage: "No pudimos guardar la dirección"
        }),
        description: message
      });
    }
  };

  return (
    <Formik<AddressFormValues>
      enableReinitialize
      onSubmit={handleFormSubmit}
      initialValues={initialValues}
      validationSchema={validationSchema}>
      <AddressFormFields
        address={address}
        onSelectSubmitMode={(mode) => {
          submitModeRef.current = mode;
        }}
      />
    </Formik>
  );
}
