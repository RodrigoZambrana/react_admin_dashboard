"use client";

import Link from "next/link";
import { Fragment } from "react";
import { IconPackage } from "@tabler/icons-react";
// GLOBAL CUSTOM COMPONENTS
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { ProductForm } from "@sections/vendor-dashboard/products";

const CATEGORIES = [
  { label: "Fashion", value: "fashion" },
  { label: "Gadget", value: "gadget" }
];

const HEADER_LINK = (
  <Link href="/vendor/products">
    <Button color="primary">Back</Button>
  </Link>
);

export default function AddProduct() {
  return (
    <Fragment>
      <DashboardPageHeader
        title="Add Product"
        button={HEADER_LINK}
        Icon={<IconPackage size={24} />}
      />

      <ProductForm categories={CATEGORIES} />
    </Fragment>
  );
}
