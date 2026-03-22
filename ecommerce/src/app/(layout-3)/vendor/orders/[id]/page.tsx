import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";
import { IDParams } from "interfaces";

export default async function OrderDetailsPage({ params }: IDParams) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const [{ IconShoppingBagCheck }, buttonsModule, { default: DashboardPageHeader }, { default: OrderDetails }] =
    await Promise.all([
      import("@tabler/icons-react"),
      import("@component/buttons"),
      import("@component/DashboardPageHeader"),
      import("@sections/vendor-dashboard/orders/OrderDetails")
    ]);
  const { Button } = buttonsModule;
  const backButton = (
    <Link href="/vendor/orders">
      <Button color="primary">Back</Button>
    </Link>
  );

  return (
    <Fragment>
      <DashboardPageHeader
        button={backButton}
        title="Order Details"
        Icon={<IconShoppingBagCheck size={27} />}
      />

      <OrderDetails />
    </Fragment>
  );
}
