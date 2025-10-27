"use client";

import * as yup from "yup";
import { Formik } from "formik";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";

const VALIDATION_SCHEMA = yup.object().shape({
  name: yup.string().required("Name is required"),
  card_no: yup.string().required("Card number is required"),
  exp: yup.string().required("Expiry date is required"),
  cvc: yup.string().required("CVC is required")
});

type FormValues = yup.InferType<typeof VALIDATION_SCHEMA>;

const INITIAL_VALUES = {
  exp: "",
  cvc: "",
  name: "",
  card_no: ""
};

export default function MethodEditForm() {
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
                  name="card_no"
                  label="Card Number"
                  placeholder="1234 5678 9012 3456"
                  onBlur={handleBlur}
                  value={values.card_no}
                  onChange={handleChange}
                  errorText={touched.card_no && errors.card_no}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  placeholder="John Doe"
                  onBlur={handleBlur}
                  value={values.name}
                  label="Name on Card"
                  onChange={handleChange}
                  errorText={touched.name && errors.name}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="exp"
                  placeholder="MM/YY"
                  label="Exp. Date"
                  value={values.exp}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  errorText={touched.exp && errors.exp}
                />
              </Grid>

              <Grid item md={6} xs={12}>
                <TextField
                  fullWidth
                  name="cvc"
                  placeholder="123"
                  label="CVC"
                  value={values.cvc}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  errorText={touched.cvc && errors.cvc}
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
