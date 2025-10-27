"use client";

import * as yup from "yup";
import { Formik } from "formik";
import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";
import Address from "@models/address.model";

const VALIDATION_SCHEMA = yup.object({
  name: yup.string().required("Name is required"),
  street: yup.string().required("Street is required"),
  city: yup.string().required("City is required"),
  country: yup.string().required("Country is required"),
  contact: yup.string().required("Contact is required")
});

type FormValues = yup.InferType<typeof VALIDATION_SCHEMA>;

// ===========================================================
type AddressFormProps = { address?: Address };
// ===========================================================

export default function AddressForm({ address }: AddressFormProps) {
  const INITIAL_VALUES = {
    name: address?.title || "",
    contact: address?.phone || "",
    city: address?.city || "",
    street: address?.street || "",
    country: address?.country || ""
  };

  const handleFormSubmit = async (values: FormValues) => {
    console.log(values);
  };

  return (
    <Formik
      onSubmit={handleFormSubmit}
      initialValues={INITIAL_VALUES}
      validationSchema={VALIDATION_SCHEMA}>
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit }) => (
        <form onSubmit={handleSubmit}>
          <Box mb="30px">
            <Grid container horizontal_spacing={6} vertical_spacing={4}>
              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  label="Name"
                  placeholder="Enter your name"
                  onBlur={handleBlur}
                  value={values.name}
                  onChange={handleChange}
                  errorText={touched.name && errors.name}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  label="Phone"
                  placeholder="Enter your phone number"
                  name="contact"
                  onBlur={handleBlur}
                  value={values.contact}
                  onChange={handleChange}
                  errorText={touched.contact && errors.contact}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="street"
                  label="Street"
                  placeholder="Enter your street"
                  onBlur={handleBlur}
                  value={values.street}
                  onChange={handleChange}
                  errorText={touched.street && errors.street}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="city"
                  label="City"
                  placeholder="Enter your city"
                  onBlur={handleBlur}
                  value={values.city}
                  onChange={handleChange}
                  errorText={touched.city && errors.city}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="country"
                  label="Country"
                  placeholder="Enter your country"
                  onBlur={handleBlur}
                  value={values.country}
                  onChange={handleChange}
                  errorText={touched.country && errors.country}
                />
              </Grid>
            </Grid>
          </Box>

          <Button type="submit" variant="contained" color="primary">
            Save Changes
          </Button>
        </form>
      )}
    </Formik>
  );
}
