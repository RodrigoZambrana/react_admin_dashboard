import Link from "next/link";
import { Fragment } from "react";
import { IconPackage } from "@tabler/icons-react";
import axios from "@lib/axios";
// GLOBAL CUSTOM COMPONENTS
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { ProductForm } from "@sections/vendor-dashboard/products";
// CUSTOM DATA MODEL
import { SlugParams } from "interfaces";

const CATEGORIES = [
  { label: "Fashion", value: "fashion" },
  { label: "Gadget", value: "gadget" }
];

const BACK_BUTTON = (
  <Link href="/vendor/products">
    <Button color="primary" bg="primary.light" px="2rem">
      Back
    </Button>
  </Link>
);

export default async function ProductDetails({ params }: SlugParams) {
  const { slug } = await params;
  const { data } = await axios.get("/api/products/slug", { params: { slug } });

  return (
    <Fragment>
      <DashboardPageHeader
        title="Edit Product"
        Icon={<IconPackage size={24} />}
        button={BACK_BUTTON}
      />

      <ProductForm product={data} categories={CATEGORIES} />
    </Fragment>
  );
}
