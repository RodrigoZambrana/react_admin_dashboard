"use client";

import { Fragment, useCallback } from "react";
import { notFound } from "next/navigation";
import { Formik } from "formik";
import * as yup from "yup";
// GLOBAL CUSTOM COMPONENTS
// CUSTOM DATA
import { isDemoRouteEnabled } from "@/lib/public-route-policy";
import countryList from "@data/countryList";

interface FormValues {
  first_name: string;
  last_name: string;
  country: string;
  city: string;
  email: string;
  contact: string;
}

const accountSchema = yup.object().shape({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  country: yup.mixed().required("Country is required"),
  city: yup.string().required("City is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  contact: yup.string().required("Contact is required")
});

export default function AccountSettings() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const { IconCamera, IconSettings } = require("@tabler/icons-react");
  const Box = require("@component/Box").default;
  const Hidden = require("@component/hidden").default;
  const Select = require("@component/Select").default;
  const Avatar = require("@component/avatar").default;
  const Grid = require("@component/grid/Grid").default;
  const { Card1 } = require("@component/Card1");
  const { Button } = require("@component/buttons");
  const TextField = require("@component/text-field").default;
  const DashboardPageHeader = require("@component/DashboardPageHeader").default;

  const initialValues: FormValues = {
    first_name: "",
    last_name: "",
    country: "",
    city: "",
    email: "",
    contact: ""
  };

  const handleFormSubmit = useCallback(async (values: FormValues) => {
    console.log(values);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.files);
  }, []);

  return (
    <Fragment>
      <DashboardPageHeader title="Account" Icon={<IconSettings size={24} />} />

      <Card1 borderRadius={12}>
        <Box
          mb="1.5rem"
          height="173px"
          overflow="hidden"
          borderRadius="10px"
          position="relative"
          style={{ background: "url(/assets/images/banners/banner-10.png) center/cover" }}>
          <Box display="flex" alignItems="flex-end" position="absolute" bottom="20px" left="24px">
            <Avatar
              size={80}
              border="4px solid"
              borderColor="gray.100"
              src="/assets/images/faces/propic(9).png"
            />

            <Box ml="-32px" zIndex={1}>
              <label htmlFor="profile-image">
                <Button
                  p="6px"
                  as="span"
                  size="small"
                  height="auto"
                  color="secondary"
                  borderRadius="50%">
                  <IconCamera size={18} />
                </Button>
              </label>
            </Box>

            <Hidden>
              <input
                type="file"
                accept="image/*"
                id="profile-image"
                className="hidden"
                onChange={handleFileChange}
              />
            </Hidden>
          </Box>

          <Box display="flex" alignItems="flex-end" position="absolute" top="20px" right="24px">
            <label htmlFor="cover-image">
              <Button
                p="6px"
                as="span"
                size="small"
                color="primary"
                height="auto"
                borderRadius="50%">
                <IconCamera size={18} />
              </Button>
            </label>

            <Hidden>
              <input
                className="hidden"
                onChange={(e) => console.log(e.target.files)}
                id="cover-image"
                accept="image/*"
                type="file"
              />
            </Hidden>
          </Box>
        </Box>

        <Formik
          onSubmit={handleFormSubmit}
          initialValues={initialValues}
          validationSchema={accountSchema}>
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => (
            <form onSubmit={handleSubmit}>
              <Box mb="30px">
                <Grid container horizontal_spacing={6} vertical_spacing={4}>
                  <Grid item md={6} xs={12}>
                    <TextField
                      fullWidth
                      name="first_name"
                      label="First Name"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.first_name}
                      placeholder="Enter your first name"
                      errorText={touched.first_name ? errors.first_name : undefined}
                    />
                  </Grid>

                  <Grid item md={6} xs={12}>
                    <TextField
                      fullWidth
                      name="last_name"
                      label="Last Name"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.last_name}
                      placeholder="Enter your last name"
                      errorText={touched.last_name ? errors.last_name : undefined}
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
                      placeholder="Enter your email"
                      errorText={touched.email ? errors.email : undefined}
                    />
                  </Grid>

                  <Grid item md={6} xs={12}>
                    <TextField
                      fullWidth
                      type="tel"
                      label="Phone"
                      name="contact"
                      onBlur={handleBlur}
                      value={values.contact}
                      onChange={handleChange}
                      placeholder="Enter your phone number"
                      errorText={touched.contact ? errors.contact : undefined}
                    />
                  </Grid>

                  <Grid item md={6} xs={12}>
                    <Select
                      label="Country"
                      options={countryList}
                      value={values.country}
                      placeholder="Select your country"
                      errorText={touched.country ? errors.country : undefined}
                      onChange={(country) => setFieldValue("country", country)}
                    />
                  </Grid>

                  <Grid item md={6} xs={12}>
                    <TextField
                      fullWidth
                      name="city"
                      label="City"
                      value={values.city}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Enter your city"
                      errorText={touched.city ? errors.city : undefined}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Button type="submit">Save Changes</Button>
            </form>
          )}
        </Formik>
      </Card1>
    </Fragment>
  );
}
