"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as yup from "yup";
import { Formik } from "formik";

import Select from "@component/Select";
import Grid from "@component/grid/Grid";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";
import Typography from "@component/Typography";
import CitySelect from "@/components/country-city/CitySelect";

import { StorefrontApi } from "@/lib/api/storefront";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import { useCountryCityData } from "@/lib/country-city";
import { useI18n, useTranslation } from "@/state/i18n-context";
import type { StorefrontShippingOption } from "@/types/storefront";

type CheckoutDetailsFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  corner: string;
  apartment: string;
  city: string;
  country: string;
  shippingOptionId: string;
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
      .required(t("account.address.form.errors.numberRequired", { defaultMessage: "Debes ingresar el número." })),
    corner: yup.string().trim().optional(),
    apartment: yup.string().trim().optional(),
    city: yup
      .string()
      .trim()
      .required(t("account.address.form.errors.cityRequired", {
        defaultMessage: "Debes seleccionar una ciudad o departamento."
      })),
    country: yup.string().trim().required(),
    shippingOptionId: yup
      .string()
      .trim()
      .required(t("checkout.review.errors.shippingOptionIncompleteMessage", {
        defaultMessage: "Selecciona una opción de entrega antes de continuar."
      }))
  });

const COUNTRY_BY_CODE: Record<string, string> = {
  UY: "Uruguay"
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = Object.entries(COUNTRY_BY_CODE).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>
);

const DEFAULT_DEPARTMENT_BY_COUNTRY: Record<string, string> = {
  UY: "Montevideo"
};
const DEFAULT_COUNTRY_CODE = "UY";
const DEFAULT_CITY = "Montevideo";

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

const normalizeCountryCode = (value?: string | null) => {
  if (!value) return "UY";
  const trimmed = value.trim();
  if (!trimmed) return "UY";
  const upper = trimmed.toUpperCase();
  if (COUNTRY_BY_CODE[upper]) {
    return upper;
  }
  const byName = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  if (byName) {
    return byName;
  }
  return "UY";
};

export default function CheckoutForm() {
  const router = useRouter();
  const { state: cartState } = useStorefrontCart();
  const { contact, shippingAddress, shippingOption, setDetails } = useCheckout();
  const { getCitiesForCountry, loading: locationLoading, error: locationError } = useCountryCityData();
  const t = useTranslation();
  const { locale } = useI18n();
  const checkoutSchema = useMemo(() => buildCheckoutSchema(t), [t]);
  const [shippingOptions, setShippingOptions] = useState<StorefrontShippingOption[]>([]);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(true);
  const [shippingOptionsError, setShippingOptionsError] = useState<string | null>(null);

  const getDefaultDepartment = useCallback(
    (countryCode: string) => {
      if (!countryCode) return "";
      const explicit = DEFAULT_DEPARTMENT_BY_COUNTRY[countryCode];
      if (explicit) return explicit;
      const countryName = COUNTRY_BY_CODE[countryCode];
      if (!countryName) return "";
      const cities = getCitiesForCountry(countryName);
      return cities && cities.length > 0 ? cities[0] : "";
    },
    [getCitiesForCountry]
  );

  useEffect(() => {
    if (cartState.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartState.items.length, router]);

  useEffect(() => {
    let cancelled = false;

    setShippingOptionsLoading(true);
    setShippingOptionsError(null);

    (async () => {
      try {
        const options = await StorefrontApi.listShippingOptions();
        if (cancelled) return;
        setShippingOptions(options);
      } catch (error) {
        if (cancelled) return;
        setShippingOptions([]);
        setShippingOptionsError("Failed to load shipping options");
      } finally {
        if (!cancelled) {
          setShippingOptionsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const initialValues = useMemo<CheckoutDetailsFormValues>(() => {
    const { street, number } = parseLine1(shippingAddress.line1);
    const { apartment, corner } = parseLine2(shippingAddress.line2);
    const initialCountryCode = normalizeCountryCode(shippingAddress.country ?? "UY");
    const initialDepartment =
      shippingAddress.state?.trim() ||
      shippingAddress.city?.trim() ||
      DEFAULT_DEPARTMENT_BY_COUNTRY[initialCountryCode] ||
      getDefaultDepartment(initialCountryCode) ||
      DEFAULT_DEPARTMENT_BY_COUNTRY.UY;

    return {
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      street,
      number,
      corner,
      apartment,
      city: initialDepartment,
      country: initialCountryCode,
      shippingOptionId:
        shippingOption?.id !== undefined && shippingOption?.id !== null
          ? String(shippingOption.id)
          : shippingOptions.length === 1
            ? String(shippingOptions[0].id)
            : ""
    };
  }, [contact, shippingAddress, shippingOption, shippingOptions, getDefaultDepartment]);

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
    const department =
      trimmed.city ||
      DEFAULT_DEPARTMENT_BY_COUNTRY[normalizedCountry] ||
      getDefaultDepartment(normalizedCountry) ||
      DEFAULT_DEPARTMENT_BY_COUNTRY.UY;
    const postalCode =
      DEFAULT_POSTAL_CODE_BY_COUNTRY[normalizedCountry] ??
      DEFAULT_POSTAL_CODE_BY_COUNTRY.UY ??
      POSTAL_CODE_FALLBACK;
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
        line2: [trimmed.apartment, trimmed.corner].filter(Boolean).join(", ") || "",
        city: department,
        state: department,
        zip: postalCode,
        country: normalizedCountry
      },
      "home_delivery",
      selectedShippingOption
    );

    router.push("/payment");
  };

  const countryOptions = useMemo(
    () =>
      Object.entries(COUNTRY_BY_CODE).map(([code, name]) => ({
        value: code,
        label: name
      })),
    []
  );
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
      initialValues={initialValues}
      validationSchema={checkoutSchema}
      enableReinitialize
      onSubmit={handleFormSubmit}>
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => {
        const currentCountry = normalizeCountryCode(values.country);
        const selectedCountry = countryOptions.find((option) => option.value === currentCountry);
        return (
          <form onSubmit={handleSubmit}>
            <Card1 mb="2rem">
              <Typography fontWeight="600" mb="1rem">
                {t("Contact information")}
              </Typography>

              <Grid container spacing={7}>
                <Grid item sm={6} xs={12}>
                  <TextField
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
                    fullWidth
                    mb="1rem"
                    label={t("account.address.form.country", { defaultMessage: "País" })}
                    name="country"
                    value={selectedCountry?.label ?? COUNTRY_BY_CODE.UY}
                    disabled
                    errorText={touched.country ? errors.country : undefined}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <CitySelect
                    label={t("account.address.form.city", { defaultMessage: "Ciudad / Departamento" })}
                    countryCode={DEFAULT_COUNTRY_CODE}
                    countryName={COUNTRY_BY_CODE.UY}
                    value={values.city}
                    placeholder={
                      locationLoading
                        ? t("account.address.form.loadingCities", {
                            defaultMessage: "Cargando ciudades..."
                          })
                        : locationError
                          ? t("account.address.form.loadCitiesError", {
                              defaultMessage: "No pudimos cargar las ciudades"
                            })
                          : t("account.address.form.selectCity", {
                              defaultMessage: "Selecciona una ciudad"
                            })
                    }
                    errorText={touched.city ? errors.city : undefined}
                    onChange={(city) => setFieldValue("city", city ?? DEFAULT_CITY)}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <Typography mb="0.5rem" fontWeight="600">
                    {t("Delivery option")}
                  </Typography>
                  <Select
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
                    <Typography color="error.main" fontSize="12px" mt="0.5rem">
                      {t(shippingOptionsError)}
                    </Typography>
                  ) : null}
                </Grid>
              </Grid>
            </Card1>

            <Grid container spacing={7}>
              <Grid item sm={6} xs={12}>
                <Link href="/cart">
                  <Button variant="outlined" color="primary" type="button" fullWidth>
                    Back to cart
                  </Button>
                </Link>
              </Grid>

              <Grid item sm={6} xs={12}>
                <Button variant="contained" color="primary" type="submit" fullWidth>
                  Continue to payment
                </Button>
              </Grid>
            </Grid>
          </form>
        );
      }}
    </Formik>
  );
}
