"use client";

import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
// GLOBAL CUSTOM COMPONENTS
import { isDemoRouteEnabled } from "@/lib/public-route-policy";

const CATEGORIES = [
  { label: "Fashion", value: "fashion" },
  { label: "Gadget", value: "gadget" }
];

export default function AddProduct() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const { IconPackage } = require("@tabler/icons-react");
  const { Button } = require("@component/buttons");
  const DashboardPageHeader = require("@component/DashboardPageHeader").default;
  const { ProductForm } = require("@sections/vendor-dashboard/products");
  const headerLink = (
    <Link href="/vendor/products">
      <Button color="primary">Back</Button>
    </Link>
  );

  return (
    <Fragment>
      <DashboardPageHeader
        title="Add Product"
        button={headerLink}
        Icon={<IconPackage size={24} />}
      />

      <ProductForm categories={CATEGORIES} />
    </Fragment>
  );
}
