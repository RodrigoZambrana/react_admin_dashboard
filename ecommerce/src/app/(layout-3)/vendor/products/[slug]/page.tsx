import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import axios from "@lib/axios";
// CUSTOM DATA MODEL
import { isDemoRouteEnabled } from "@/lib/public-route-policy";
import { SlugParams } from "interfaces";

const CATEGORIES = [
  { label: "Fashion", value: "fashion" },
  { label: "Gadget", value: "gadget" }
];

export default async function ProductDetails({ params }: SlugParams) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const [{ IconPackage }, buttonsModule, { default: DashboardPageHeader }, productsModule] =
    await Promise.all([
      import("@tabler/icons-react"),
      import("@component/buttons"),
      import("@component/DashboardPageHeader"),
      import("@sections/vendor-dashboard/products")
    ]);
  const { Button } = buttonsModule;
  const { ProductForm } = productsModule;
  const { slug } = await params;
  const { data } = await axios.get("/api/products/slug", { params: { slug } });

  const backButton = (
    <Link href="/vendor/products">
      <Button color="primary" bg="primary.light" px="2rem">
        Back
      </Button>
    </Link>
  );

  return (
    <Fragment>
      <DashboardPageHeader
        title="Edit Product"
        Icon={<IconPackage size={24} />}
        button={backButton}
      />

      <ProductForm product={data} categories={CATEGORIES} />
    </Fragment>
  );
}
