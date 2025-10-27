"use client";

import styled from "styled-components";
import * as yup from "yup";
import { Formik } from "formik";

import Card from "@component/Card";
import Image from "@component/Image";
import Select from "@component/Select";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import DropZone from "@component/DropZone";
import TextArea from "@component/textarea";
import { Button } from "@component/buttons";
import TextField from "@component/text-field";

import Product from "@models/product.model";

// STYLED COMPONENT
const UploadImageBox = styled("div")(({ theme }) => ({
  width: 70,
  height: 70,
  display: "flex",
  overflow: "hidden",
  borderRadius: "8px",
  marginRight: ".5rem",
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.colors.primary[100]
}));

// ==============================================================

interface Props {
  product?: Product;
  categories: { label: string; value: string }[];
}
// ==============================================================

const validationSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  category: yup.string().required("Category is required"),
  description: yup.string().required("Description is required"),
  stock: yup.number().required("Stock is required"),
  price: yup.number().required("Price is required"),
  sale_price: yup.number().required("Sale price is required"),
  tags: yup.object().required("Tags are required")
});

export default function ProductUpdateForm({ product, categories }: Props) {
  const initialValues = {
    name: product?.title || "",
    price: product?.price || "",
    tags: "",
    stock: "",
    sale_price: "",
    description: "",
    category: ""
  };

  const handleFormSubmit = async (values: typeof initialValues) => {
    console.log(values);
  };

  return (
    <Card p="30px" borderRadius={8}>
      <Formik
        onSubmit={handleFormSubmit}
        initialValues={initialValues}
        validationSchema={validationSchema}>
        {({ values, errors, touched, handleBlur, handleChange, handleSubmit, setFieldValue }) => (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={6}>
              <Grid item sm={6} xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  label="Name"
                  placeholder="Name"
                  value={values.name}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  errorText={touched.name && errors.name}
                />
              </Grid>

              <Grid item sm={6} xs={12}>
                <Select
                  isMulti
                  label="Category"
                  value={values.category}
                  options={categories}
                  placeholder="Select category"
                  onChange={(value) => setFieldValue("category", value)}
                  errorText={touched.category && errors.category}
                />
              </Grid>

              <Grid item xs={12}>
                <DropZone onChange={(files) => console.log(files)} />

                <FlexBox flexDirection="row" mt={2} flexWrap="wrap">
                  {product?.images?.map((item, i) => (
                    <UploadImageBox key={i}>
                      <Image src={item} width="100%" />
                    </UploadImageBox>
                  ))}
                </FlexBox>
              </Grid>

              <Grid item xs={12}>
                <TextArea
                  rows={6}
                  fullWidth
                  name="description"
                  label="Description"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Description"
                  value={values.description}
                  errorText={touched.description && errors.description}
                />
              </Grid>

              <Grid item sm={6} xs={12}>
                <TextField
                  fullWidth
                  name="stock"
                  label="Stock"
                  placeholder="Stock"
                  onBlur={handleBlur}
                  value={values.stock}
                  onChange={handleChange}
                  errorText={touched.stock && errors.stock}
                />
              </Grid>

              <Grid item sm={6} xs={12}>
                <TextField
                  fullWidth
                  name="tags"
                  label="Tags"
                  placeholder="Tags"
                  value={values.tags}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  errorText={touched.tags && errors.tags}
                />
              </Grid>

              <Grid item sm={6} xs={12}>
                <TextField
                  fullWidth
                  name="price"
                  type="number"
                  onBlur={handleBlur}
                  value={values.price}
                  label="Regular Price"
                  onChange={handleChange}
                  placeholder="Regular Price"
                  errorText={touched.price && errors.price}
                />
              </Grid>

              <Grid item sm={6} xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  name="sale_price"
                  label="Sale Price"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Sale Price"
                  value={values.sale_price}
                  errorText={touched.sale_price && errors.sale_price}
                />
              </Grid>

              <Grid item xs={12}>
                <Button type="submit">Save product</Button>
              </Grid>
            </Grid>
          </form>
        )}
      </Formik>
    </Card>
  );
}
