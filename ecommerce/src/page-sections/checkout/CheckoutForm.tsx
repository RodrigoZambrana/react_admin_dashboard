"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as yup from "yup";
import { Formik, useFormikContext } from "formik";

import Select from "@component/Select";
import Grid from "@component/grid/Grid";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";
import Typography from "@component/Typography";

import { StorefrontApi } from "@/lib/api/storefront";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import { useI18n, useTranslation } from "@/state/i18n-context";
import type { StorefrontShippingOption } from "@/types/storefront";
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

type CheckoutDetailsFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  corner: string;
  apartment: string;
  department: string;
  city: string;
  neighborhood: string;
  country: string;
  shippingOptionId: string;
};

const CheckoutFormPrefillSync = ({
  valuesToSync
}: {
  valuesToSync: CheckoutDetailsFormValues;
}) => {
  const { dirty, values, setValues } = useFormikContext<CheckoutDetailsFormValues>();
  const lastAppliedSignatureRef = useRef<string>("");
  const signature = useMemo(() => JSON.stringify(valuesToSync), [valuesToSync]);

  useEffect(() => {
    if (dirty || lastAppliedSignatureRef.current === signature) {
      return;
    }
    const mergedValues = Object.entries(valuesToSync).reduce(
      (accum, [key, incomingValue]) => {
        const currentValue = values[key as keyof CheckoutDetailsFormValues];
        accum[key as keyof CheckoutDetailsFormValues] =
          typeof currentValue === "string" && currentValue.trim().length > 0
            ? currentValue
            : incomingValue;
        return accum;
      },
      { ...valuesToSync }
    );
    setValues(mergedValues, false);
    lastAppliedSignatureRef.current = signature;
  }, [dirty, setValues, signature, values, valuesToSync]);

  return null;
};

const buildCheckoutSchema = (t: ReturnType<typeof useTranslation>) =>
  yup.object({
    firstName: yup
      .string()
      .trim()
      .required(t("auth.register.errors.firstNameRequired", { defaultMessage: "Debes ingresar el nombre." })),
    lastName: yup
      .string()
      .trim()
      .required(t("auth.register.errors.lastNameRequired", { defaultMessage: "Debes ingresar el apellido." })),
    email: yup
      .string()
      .trim()
      .email(t("auth.register.errors.invalidEmail", { defaultMessage: "Ingresa un correo válido." }))
      .optional(),
    phone: yup
      .string()
      .trim()
      .required(t("auth.register.errors.phoneRequired", { defaultMessage: "Debes ingresar un teléfono." })),
    street: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.streetRequired", { defaultMessage: "Debes ingresar la calle." })),
    number: yup
      .string()
      .trim()
      .matches(/^\d+$/, {
        message: t("account.address.form.errors.numberOnly", {
          defaultMessage: "Ingresa solo números."
        }),
        excludeEmptyString: true
      })
      .required(t("account.address.form.errors.numberRequired", { defaultMessage: "Debes ingresar el número." })),
    corner: yup.string().trim().optional(),
    apartment: yup.string().trim().optional(),
    department: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.departmentRequired", { defaultMessage: "Debes seleccionar el departamento." })),
    city: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.cityRequired", {
        defaultMessage: "Debes seleccionar una ciudad o departamento."
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
      otherwise: (schema) => schema.trim().optional()
    }),
    country: yup.string().trim().required(),
    shippingOptionId: yup
      .string()
      .trim()
      .required(t("checkout.review.errors.shippingOptionIncompleteMessage", {
        defaultMessage: "Selecciona una opción de entrega antes de continuar."
      }))
  });

const DEFAULT_COUNTRY_CODE = URUGUAY_COUNTRY_CODE;
const DEFAULT_CITY = DEFAULT_URUGUAY_CITY;
const DEFAULT_DEPARTMENT = DEFAULT_URUGUAY_DEPARTMENT;

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};

const POSTAL_CODE_FALLBACK = "00000";
const MIN_DELIVERY_DAYS = 3;

const parseLine1 = (line1?: string | null) => {
  if (!line1) return { street: "", number: "" };
  const trimmed = line1.trim();
  if (!trimmed) return { street: "", number: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { street: trimmed, number: "" };
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
  if (!line2) return { apartment: "", corner: "" };
  const tokens = line2.split(",").map((token) => token.trim()).filter(Boolean);
  return {
    apartment: tokens[0] ?? "",
    corner: tokens[1] ?? ""
  };
};

const normalizeCountryCode = (_value?: string | null) => DEFAULT_COUNTRY_CODE;

export default function CheckoutForm({
  initialShippingOptions = []
}: {
  initialShippingOptions?: StorefrontShippingOption[];
}) {
  const router = useRouter();
  const { state: cartState, isHydrated: isCartHydrated } = useStorefrontCart();
  const { contact, shippingAddress, shippingOption, setDetails } = useCheckout();
  const t = useTranslation();
  const { locale } = useI18n();
  const checkoutSchema = useMemo(() => buildCheckoutSchema(t), [t]);
  const [shippingOptions, setShippingOptions] = useState<StorefrontShippingOption[]>(initialShippingOptions);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(initialShippingOptions.length === 0);
  const [shippingOptionsError, setShippingOptionsError] = useState<string | null>(null);

  const loadShippingOptions = useCallback(async () => {
    setShippingOptionsLoading(true);
    setShippingOptionsError(null);

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const options = await StorefrontApi.listShippingOptions();
        setShippingOptions(options);
        setShippingOptionsError(null);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    setShippingOptions([]);
    setShippingOptionsError("Failed to load shipping options");
    if (lastError) {
      console.warn("[checkout] failed to load shipping options", lastError);
    }
  }, []);

  useEffect(() => {
    if (!isCartHydrated) return;
    if (cartState.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartState.items.length, isCartHydrated, router]);

  useEffect(() => {
    let cancelled = false;

    if (initialShippingOptions.length > 0) {
      setShippingOptions(initialShippingOptions);
      setShippingOptionsLoading(false);
      setShippingOptionsError(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        await loadShippingOptions();
      } catch (error) {
        if (cancelled) return;
      } finally {
        if (cancelled) return;
        setShippingOptionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialShippingOptions, loadShippingOptions]);

  const initialValues = useMemo<CheckoutDetailsFormValues>(() => {
    const { street, number } = parseLine1(shippingAddress.line1);
    const { apartment, corner } = parseLine2(shippingAddress.line2);
    const initialCountryCode = normalizeCountryCode(shippingAddress.country ?? DEFAULT_COUNTRY_CODE);
    const initialDepartment =
      shippingAddress.department?.trim() ||
      shippingAddress.state?.trim() ||
      DEFAULT_DEPARTMENT;
    const initialCity =
      shippingAddress.city?.trim() ||
      getDefaultCityForDepartment(initialDepartment) ||
      DEFAULT_CITY;

    return {
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      street,
      number,
      corner,
      apartment,
      department: initialDepartment,
      city: initialCity,
      neighborhood: shippingAddress.neighborhood?.trim() || "",
      country: initialCountryCode,
      shippingOptionId:
        shippingOption?.id !== undefined && shippingOption?.id !== null
          ? String(shippingOption.id)
          : shippingOptions.length === 1
            ? String(shippingOptions[0].id)
            : ""
    };
  }, [contact, shippingAddress, shippingOption, shippingOptions]);

  const handleFormSubmit = (values: CheckoutDetailsFormValues) => {
    const trimmed: CheckoutDetailsFormValues = Object.entries(values).reduce(
      (accum, [key, value]) => {
        accum[key as keyof CheckoutDetailsFormValues] = value.trim();
        return accum;
      },
      { ...values }
    );

    const [firstName, lastName, email] = [trimmed.firstName, trimmed.lastName, trimmed.email];
    const phone = trimmed.phone ? trimmed.phone : "";
    const normalizedCountry = normalizeCountryCode(trimmed.country || "UY");
    const department = trimmed.department || DEFAULT_DEPARTMENT;
    const city =
      trimmed.city ||
      getDefaultCityForDepartment(department) ||
      DEFAULT_CITY;
    const postalCode =
      DEFAULT_POSTAL_CODE_BY_COUNTRY[normalizedCountry] ??
      DEFAULT_POSTAL_CODE_BY_COUNTRY.UY ??
      POSTAL_CODE_FALLBACK;
    const addressLine2 = [trimmed.apartment, trimmed.corner].filter(Boolean).join(", ");
    const selectedShippingOption = shippingOptions.find(
      (option) => String(option.id) === trimmed.shippingOptionId
    );

    if (!selectedShippingOption) {
      return;
    }

    setDetails(
      {
        firstName,
        lastName,
        email: email || "",
        phone
      },
      {
        line1: `${trimmed.street} ${trimmed.number}`.trim(),
        line2: addressLine2 || "",
        street: trimmed.street,
        number: trimmed.number,
        corner: trimmed.corner || "",
        apartment: trimmed.apartment || "",
        city,
        department,
        neighborhood: trimmed.neighborhood || "",
        state: department,
        zip: postalCode,
        country: normalizedCountry
      },
      "home_delivery",
      selectedShippingOption
    );

    router.push("/payment");
  };

  const shippingOptionChoices = useMemo(
    () => {
      const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-UY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      return shippingOptions.map((option) => {
        const estimateDaysRaw = option.estimatedMax ?? option.estimatedMin ?? MIN_DELIVERY_DAYS;
        const estimateDays = Math.max(MIN_DELIVERY_DAYS, estimateDaysRaw ?? MIN_DELIVERY_DAYS);
        const estimateDate = new Date();
        estimateDate.setDate(estimateDate.getDate() + estimateDays);
        const estimateLabel = formatter.format(estimateDate);
        return {
        value: String(option.id),
        label: `${option.name} · ${t("checkout.delivery.estimateDate", {
          defaultMessage: "Entrega estimada {date}",
          values: { date: estimateLabel }
        })}`
      };
      });
    },
    [locale, shippingOptions, t]
  );

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
      validationSchema={checkoutSchema}
      onSubmit={handleFormSubmit}>
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => {
        const cityOptions = getCitiesForDepartment(values.department || DEFAULT_DEPARTMENT).map((city) => ({
          value: city,
          label: city
        }));
        const selectedCity = cityOptions.find((option) => option.value === values.city) ?? null;
        const neighborhoodOptions = MONTEVIDEO_NEIGHBORHOODS.map((neighborhood) => ({
          value: neighborhood,
          label: neighborhood
        }));
        const requiresNeighborhood = usesMontevideoNeighborhoods(values.department, values.city);
        return (
          <form onSubmit={handleSubmit}>
            <CheckoutFormPrefillSync valuesToSync={initialValues} />
            <Card1 mb="2rem">
              <Typography fontWeight="600" mb="1rem">
                {t("Contact information")}
              </Typography>

              <Grid container spacing={7}>
                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-first-name"
                    fullWidth
                    mb="1rem"
                    label={t("First name")}
                    name="firstName"
                    placeholder={t("First name")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.firstName}
                    errorText={touched.firstName ? errors.firstName : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-last-name"
                    fullWidth
                    mb="1rem"
                    label={t("Last name")}
                    name="lastName"
                    placeholder={t("Last name")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.lastName}
                    errorText={touched.lastName ? errors.lastName : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-email"
                    fullWidth
                    mb="1rem"
                    type="email"
                    label={t("Email address")}
                    name="email"
                    placeholder={t("you@example.com")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.email}
                    errorText={touched.email ? errors.email : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-phone"
                    fullWidth
                    mb="1rem"
                    label={t("Phone number")}
                    name="phone"
                    placeholder={t("Phone number")}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.phone}
                    errorText={touched.phone ? errors.phone : undefined}
                  />
                </Grid>
              </Grid>

              <Typography fontWeight="600" mt="1.5rem" mb="1rem">
                {t("Shipping address")}
              </Typography>

              <Grid container spacing={7}>
                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-street"
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.street", { defaultMessage: "Calle" })}
                    name="street"
                    placeholder={t("account.address.form.placeholder.street", {
                      defaultMessage: "Ingresa el nombre de la calle"
                    })}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.street}
                    errorText={touched.street ? errors.street : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-number"
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.number", { defaultMessage: "Número" })}
                    name="number"
                    placeholder={t("account.address.form.placeholder.number", {
                      defaultMessage: "Número de puerta"
                    })}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.number}
                    errorText={touched.number ? errors.number : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-corner"
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.corner", { defaultMessage: "Esquina" })}
                    name="corner"
                    placeholder={t("account.address.form.placeholder.corner", {
                      defaultMessage: "Esquina o calle de referencia"
                    })}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.corner}
                    errorText={touched.corner ? errors.corner : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-apartment"
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.apartment", { defaultMessage: "Apartamento / Unidad" })}
                    name="apartment"
                    placeholder={t("account.address.form.placeholder.apartment", {
                      defaultMessage: "Apto, unidad, piso, etc."
                    })}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.apartment}
                    errorText={touched.apartment ? errors.apartment : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    data-testid="checkout-country"
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.country", { defaultMessage: "País" })}
                    name="country"
                    value={URUGUAY_COUNTRY_NAME}
                    disabled
                    errorText={touched.country ? errors.country : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <Select
                    data-testid="checkout-department-select"
                    options={URUGUAY_DEPARTMENTS.map((department) => ({
                      value: department,
                      label: department
                    }))}
                    label={t("account.address.form.department", { defaultMessage: "Departamento" })}
                    placeholder={t("Select a department", { defaultMessage: "Selecciona un departamento" })}
                    value={{ value: values.department, label: values.department || DEFAULT_DEPARTMENT }}
                    errorText={touched.department ? errors.department : undefined}
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

                <Grid item sm={6} xs={12}>
                  <Select
                    data-testid="checkout-city-select"
                    options={cityOptions}
                    label={t("account.address.form.city", { defaultMessage: "Ciudad" })}
                    placeholder={t("account.address.form.selectCity", {
                      defaultMessage: "Selecciona una ciudad"
                    })}
                    value={selectedCity}
                    errorText={touched.city ? errors.city : undefined}
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

                <Grid item sm={6} xs={12}>
                  {requiresNeighborhood ? (
                    <Select
                      data-testid="checkout-neighborhood-select"
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
                      errorText={touched.neighborhood ? errors.neighborhood : undefined}
                      onChange={(option: any) => {
                        const choice = Array.isArray(option) ? option[0] : option;
                        setFieldValue("neighborhood", choice?.value ?? "");
                      }}
                    />
                  ) : (
                    <TextField
                      data-testid="checkout-neighborhood-select"
                      fullWidth
                      mb="1rem"
                      label={t("account.address.form.neighborhood", { defaultMessage: "Barrio" })}
                      name="neighborhood"
                      placeholder={t("account.address.form.placeholder.neighborhood", {
                        defaultMessage: "Barrio o zona"
                      })}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.neighborhood}
                      errorText={touched.neighborhood ? errors.neighborhood : undefined}
                    />
                  )}
                </Grid>

                <Grid item sm={6} xs={12}>
                  <Typography mb="0.5rem" fontWeight="600">
                    {t("Delivery option")}
                  </Typography>
                  <Select
                    data-testid="checkout-shipping-option"
                    options={shippingOptionChoices}
                    placeholder={t("Select a delivery option")}
                    value={
                      shippingOptionChoices.find(
                        (option) => option.value === values.shippingOptionId
                      ) ?? null
                    }
                    isDisabled={shippingOptionsLoading || shippingOptionChoices.length === 0}
                    errorText={
                      touched.shippingOptionId ? errors.shippingOptionId : undefined
                    }
                    onChange={(option: any) => {
                      const choice = Array.isArray(option) ? option[0] : option;
                      setFieldValue("shippingOptionId", choice?.value ?? "");
                    }}
                  />
                  {shippingOptionsError ? (
                    <Grid container spacing={2} alignItems="center" mt="0.25rem">
                      <Grid item xs={12} sm={8}>
                        <Typography color="error.main" fontSize="12px">
                          {t(shippingOptionsError)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          variant="text"
                          color="primary"
                          type="button"
                          size="small"
                          onClick={() => {
                            void loadShippingOptions().finally(() => setShippingOptionsLoading(false));
                          }}>
                          {t("Refresh")}
                        </Button>
                      </Grid>
                    </Grid>
                  ) : null}
                </Grid>
              </Grid>
            </Card1>

            <Grid container spacing={7}>
              <Grid item sm={6} xs={12}>
                <Link href="/cart">
                  <Button
                    variant="outlined"
                    color="primary"
                    type="button"
                    fullWidth
                    data-track="checkout_back_to_cart"
                    data-label="Checkout back to cart"
                  >
                    Back to cart
                  </Button>
                </Link>
              </Grid>

              <Grid item sm={6} xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  fullWidth
                  data-testid="checkout-continue-to-payment"
                  data-track="checkout_continue_to_payment"
                  data-label="Checkout continue to payment"
                >
                  Continue to payment
                </Button>
              </Grid>
            </Grid>

            <Typography color="text.muted" fontSize="12px" mt="1rem" textAlign="center">
              {t("checkout.terms.notice", {
                defaultMessage: "Al continuar aceptas nuestros términos y condiciones."
              })}{" "}
              <Link href="/terms-and-conditions">
                {t("Terms & Conditions")}
              </Link>
            </Typography>
          </form>
        );
      }}
    </Formik>
  );
}
