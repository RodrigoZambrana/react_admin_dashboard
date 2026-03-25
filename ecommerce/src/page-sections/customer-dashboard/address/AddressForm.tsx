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
import Select from "@component/Select";

import { StorefrontApi, StorefrontAddressInput, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import Address from "@models/address.model";
import { useToast } from "@/contexts/ToastContext";
import { useTranslation } from "@/state/i18n-context";
import {
  DEFAULT_URUGUAY_CITY,
  DEFAULT_URUGUAY_DEPARTMENT,
  MONTEVIDEO_NEIGHBORHOODS,
  URUGUAY_COUNTRY_CODE,
  URUGUAY_COUNTRY_NAME,
  URUGUAY_DEPARTMENTS,
  getCitiesForDepartment,
  getDefaultCityForDepartment,
  usesMontevideoNeighborhoods
} from "@/lib/uruguay-address-catalog";

const DEFAULT_COUNTRY_NAME = URUGUAY_COUNTRY_NAME;
const DEFAULT_COUNTRY_CODE = URUGUAY_COUNTRY_CODE;
const DEFAULT_CITY = DEFAULT_URUGUAY_CITY;
const DEFAULT_DEPARTMENT = DEFAULT_URUGUAY_DEPARTMENT;

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
    department: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.departmentRequired", {
        defaultMessage: "Debes seleccionar el departamento."
      })),
    city: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.cityRequired", {
        defaultMessage: "Debes seleccionar la ciudad."
      })),
    neighborhood: yup.string().when(["department", "city"], {
      is: (department: string, city: string) => usesMontevideoNeighborhoods(department, city),
      then: (schema) =>
        schema
          .trim()
          .required(
            t("account.address.form.errors.neighborhoodRequired", {
              defaultMessage: "Debes seleccionar el barrio."
            })
          ),
      otherwise: (schema) => schema.trim().nullable()
    }),
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
  department: string;
  city: string;
  neighborhood: string | null;
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

  const country = address?.country || DEFAULT_COUNTRY_NAME;
  const countryCode = address?.countryCode || DEFAULT_COUNTRY_CODE;
  const department = address?.department || address?.state || DEFAULT_DEPARTMENT;
  const city = address?.city || getDefaultCityForDepartment(department) || DEFAULT_CITY;

  return {
    label: address?.label ?? "",
    street: address?.street ?? street ?? "",
    number: address?.number ?? number ?? "",
    corner: address?.corner ?? line2Parsed.corner ?? "",
    apartment: address?.apartment ?? line2Parsed.apartment ?? "",
    department,
    city,
    neighborhood: address?.neighborhood ?? "",
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

  useEffect(() => {
    const currentDepartment = values.department || address?.department || address?.state || DEFAULT_DEPARTMENT;
    const availableCities = getCitiesForDepartment(currentDepartment);
    const nextCity = values.city || address?.city || getDefaultCityForDepartment(currentDepartment) || DEFAULT_CITY;
    setFieldValue("country", DEFAULT_COUNTRY_NAME, false);
    setFieldValue("countryCode", DEFAULT_COUNTRY_CODE, false);
    if (!values.department) {
      setFieldValue("department", currentDepartment, false);
    }
    if (!availableCities.includes(nextCity)) {
      setFieldValue("city", getDefaultCityForDepartment(currentDepartment) || DEFAULT_CITY, false);
    } else if (!values.city) {
      setFieldValue("city", nextCity, false);
    }
    if (!usesMontevideoNeighborhoods(currentDepartment, values.city || nextCity) && values.neighborhood) {
      setFieldValue("neighborhood", "", false);
    }
  }, [address?.city, address?.department, address?.state, setFieldValue, values.city, values.department, values.neighborhood]);

  const labelError = touched.label && typeof errors.label === "string" ? errors.label : undefined;
  const streetError = touched.street && typeof errors.street === "string" ? errors.street : undefined;
  const numberError = touched.number && typeof errors.number === "string" ? errors.number : undefined;
  const departmentError =
    touched.department && typeof errors.department === "string" ? errors.department : undefined;
  const cityError = touched.city && typeof errors.city === "string" ? errors.city : undefined;
  const neighborhoodError =
    touched.neighborhood && typeof errors.neighborhood === "string" ? errors.neighborhood : undefined;
  const countryError =
    touched.country && typeof errors.country === "string" ? errors.country : undefined;
  const cornerError = touched.corner && typeof errors.corner === "string" ? errors.corner : undefined;
  const apartmentError =
    touched.apartment && typeof errors.apartment === "string" ? errors.apartment : undefined;
  const commentsError =
    touched.comments && typeof errors.comments === "string" ? errors.comments : undefined;

  const cityOptions = getCitiesForDepartment(values.department || DEFAULT_DEPARTMENT).map((city) => ({
    value: city,
    label: city
  }));
  const neighborhoodOptions = MONTEVIDEO_NEIGHBORHOODS.map((neighborhood) => ({
    value: neighborhood,
    label: neighborhood
  }));
  const requiresNeighborhood = usesMontevideoNeighborhoods(values.department, values.city);

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
            <Select
              options={URUGUAY_DEPARTMENTS.map((department) => ({
                value: department,
                label: department
              }))}
              label={t("account.address.form.department", { defaultMessage: "Departamento" })}
              placeholder={t("account.address.form.selectDepartment", {
                defaultMessage: "Selecciona un departamento"
              })}
              value={{ value: values.department, label: values.department || DEFAULT_DEPARTMENT }}
              errorText={departmentError}
              onChange={(option: any) => {
                const choice = Array.isArray(option) ? option[0] : option;
                const nextDepartment = choice?.value ?? DEFAULT_DEPARTMENT;
                const nextCity = getDefaultCityForDepartment(nextDepartment) || DEFAULT_CITY;
                setFieldValue("department", nextDepartment);
                setFieldValue("city", nextCity, false);
                if (!usesMontevideoNeighborhoods(nextDepartment, nextCity)) {
                  setFieldValue("neighborhood", "", false);
                }
              }}
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
            <Select
              options={cityOptions}
              label={t("account.address.form.city", { defaultMessage: "Ciudad" })}
              placeholder={t("account.address.form.selectCity", {
                defaultMessage: "Selecciona una ciudad"
              })}
              value={cityOptions.find((option) => option.value === values.city) ?? null}
              errorText={cityError}
              onChange={(option: any) => {
                const choice = Array.isArray(option) ? option[0] : option;
                const nextCity = choice?.value ?? getDefaultCityForDepartment(values.department);
                setFieldValue("city", nextCity);
                if (!usesMontevideoNeighborhoods(values.department, nextCity)) {
                  setFieldValue("neighborhood", "", false);
                }
              }}
            />
          </Grid>

          <Grid item md={6} xs={12}>
            {requiresNeighborhood ? (
              <Select
                options={neighborhoodOptions}
                label={t("account.address.form.neighborhood", { defaultMessage: "Barrio" })}
                placeholder={t("account.address.form.selectNeighborhood", {
                  defaultMessage: "Selecciona un barrio"
                })}
                value={
                  values.neighborhood
                    ? { value: values.neighborhood, label: values.neighborhood }
                    : null
                }
                errorText={neighborhoodError}
                onChange={(option: any) => {
                  const choice = Array.isArray(option) ? option[0] : option;
                  setFieldValue("neighborhood", choice?.value ?? "");
                }}
              />
            ) : (
              <TextField
                fullWidth
                name="neighborhood"
                label={t("account.address.form.neighborhood", { defaultMessage: "Barrio" })}
                placeholder={t("account.address.form.placeholder.neighborhood", {
                  defaultMessage: "Barrio o zona"
                })}
                onBlur={handleBlur}
                value={values.neighborhood ?? ""}
                onChange={handleChange}
                errorText={neighborhoodError}
              />
            )}
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
      department: values.department.trim(),
      city: values.city.trim(),
      neighborhood: normalizeOptional(values.neighborhood ?? null) ?? null,
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
