"use client";

import { useCallback, useEffect, useMemo } from "react";
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

import { useCheckout } from "@/state/checkout-context";
import { useStorefrontCart } from "@/state/cart-context";
import { useCountryCityData } from "@/lib/country-city";

type CheckoutDetailsFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  department: string;
  country: string;
};

const checkoutSchema = yup.object({
  firstName: yup.string().trim().required("Please enter your first name"),
  lastName: yup.string().trim().required("Please enter your last name"),
  email: yup.string().trim().email("Enter a valid email").required("An email address is required"),
  phone: yup.string().trim().optional(),
  addressLine1: yup.string().trim().required("Address line 1 is required"),
  addressLine2: yup.string().trim().optional(),
  department: yup.string().trim().required("Department is required"),
  country: yup.string().trim().required("Country is required")
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

const DEFAULT_POSTAL_CODE_BY_COUNTRY: Record<string, string> = {
  UY: "11000"
};

const POSTAL_CODE_FALLBACK = "00000";

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
  const { contact, shippingAddress, setDetails } = useCheckout();
  const { getCitiesForCountry, loading: locationLoading, error: locationError } = useCountryCityData();

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

  const buildDepartmentOptions = useCallback(
    (countryCode: string) => {
      const countryName = COUNTRY_BY_CODE[countryCode];
      if (!countryName) {
        const fallback =
          DEFAULT_DEPARTMENT_BY_COUNTRY[countryCode] ?? DEFAULT_DEPARTMENT_BY_COUNTRY.UY;
        return [{ value: fallback, label: fallback }];
      }
      const cities = getCitiesForCountry(countryName);
      if (!cities || cities.length === 0) {
        const fallback =
          DEFAULT_DEPARTMENT_BY_COUNTRY[countryCode] ?? DEFAULT_DEPARTMENT_BY_COUNTRY.UY;
        return [{ value: fallback, label: fallback }];
      }
      return cities.map((city) => ({
        value: city,
        label: city
      }));
    },
    [getCitiesForCountry]
  );

  useEffect(() => {
    if (cartState.items.length === 0) {
      router.replace("/cart");
    }
  }, [cartState.items.length, router]);

  const initialValues = useMemo<CheckoutDetailsFormValues>(() => {
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
      addressLine1: shippingAddress.line1 ?? "",
      addressLine2: shippingAddress.line2 ?? "",
      department: initialDepartment,
      country: initialCountryCode
    };
  }, [contact, shippingAddress, getDefaultDepartment]);

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
      trimmed.department ||
      DEFAULT_DEPARTMENT_BY_COUNTRY[normalizedCountry] ||
      getDefaultDepartment(normalizedCountry) ||
      DEFAULT_DEPARTMENT_BY_COUNTRY.UY;
    const postalCode =
      DEFAULT_POSTAL_CODE_BY_COUNTRY[normalizedCountry] ??
      DEFAULT_POSTAL_CODE_BY_COUNTRY.UY ??
      POSTAL_CODE_FALLBACK;

    setDetails(
      {
        firstName,
        lastName,
        email,
        phone: phone || undefined
      },
      {
        line1: trimmed.addressLine1,
        line2: trimmed.addressLine2,
        city: department,
        state: department,
        zip: postalCode,
        country: normalizedCountry
      }
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

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={checkoutSchema}
      enableReinitialize
      onSubmit={handleFormSubmit}>
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => {
        const currentCountry = normalizeCountryCode(values.country);
        const selectedCountry = countryOptions.find((option) => option.value === currentCountry);
        const departmentOptions = buildDepartmentOptions(currentCountry);

        const selectedDepartment =
          departmentOptions.find((option) => option.value === values.department) ?? null;

        const handleCountryChange = (option: any) => {
          const choice = Array.isArray(option) ? option[0] : option;
          const nextCode = normalizeCountryCode(choice?.value ?? "");
          const effectiveCode = nextCode || "UY";
          const defaultDepartment =
            getDefaultDepartment(effectiveCode) ?? DEFAULT_DEPARTMENT_BY_COUNTRY.UY;
          setFieldValue("country", effectiveCode);
          setFieldValue("department", defaultDepartment);
          // No explicit postal code field in the form; shipping zip is derived during submit.
        };

        const handleDepartmentChange = (option: any) => {
          const choice = Array.isArray(option) ? option[0] : option;
          const nextValue = choice?.value ?? "";
          setFieldValue("department", nextValue);
        };

        return (
          <form onSubmit={handleSubmit}>
            <Card1 mb="2rem">
              <Typography fontWeight="600" mb="1rem">
                Contact information
              </Typography>

              <Grid container spacing={7}>
                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    label="First name"
                    name="firstName"
                    placeholder="First name"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.firstName}
                    errorText={touched.firstName && errors.firstName}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    label="Last name"
                    name="lastName"
                    placeholder="Last name"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.lastName}
                    errorText={touched.lastName && errors.lastName}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    type="email"
                    label="Email address"
                    name="email"
                    placeholder="you@example.com"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.email}
                    errorText={touched.email && errors.email}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    label="Phone number"
                    name="phone"
                    placeholder="Optional"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.phone}
                    errorText={touched.phone && errors.phone}
                  />
                </Grid>
              </Grid>

              <Typography fontWeight="600" mt="1.5rem" mb="1rem">
                Shipping address
              </Typography>

              <Grid container spacing={7}>
                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    label="Address line 1"
                    name="addressLine1"
                    placeholder="Street and number"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.addressLine1}
                    errorText={touched.addressLine1 && errors.addressLine1}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    mb="1rem"
                    label="Address line 2"
                    name="addressLine2"
                    placeholder="Apartment, suite, etc."
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.addressLine2}
                    errorText={touched.addressLine2 && errors.addressLine2}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <Select
                    label="Country"
                    options={countryOptions}
                    placeholder="Select a country"
                    value={selectedCountry ?? null}
                    isDisabled={countryOptions.length <= 1}
                    errorText={touched.country && errors.country}
                    onChange={handleCountryChange}
                  />
                </Grid>

                <Grid item sm={6} xs={12}>
                  <Select
                    label="Department"
                    options={departmentOptions}
                    placeholder={
                      locationLoading
                        ? "Loading departments..."
                        : locationError
                          ? "Failed to load departments"
                          : "Select a department"
                    }
                    value={selectedDepartment}
                    errorText={touched.department && errors.department}
                    onChange={handleDepartmentChange}
                  />
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
