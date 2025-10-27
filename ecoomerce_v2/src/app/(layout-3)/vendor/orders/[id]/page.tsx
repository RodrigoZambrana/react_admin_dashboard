import Link from "next/link";
import { Fragment } from "react";
import { IconShoppingBagCheck } from "@tabler/icons-react";

import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
import OrderDetails from "@sections/vendor-dashboard/orders/OrderDetails";
import { IDParams } from "interfaces";

const BACK_BUTTON = (
  <Link href="/vendor/orders">
    <Button color="primary">Back</Button>
  </Link>
);

export default async function OrderDetailsPage({ params }: IDParams) {
  return (
    <Fragment>
      <DashboardPageHeader
        button={BACK_BUTTON}
        title="Order Details"
        Icon={<IconShoppingBagCheck size={27} />}
      />

      <OrderDetails />
    </Fragment>
  );
}
