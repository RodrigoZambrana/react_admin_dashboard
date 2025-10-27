import Link from "next/link";
import { Fragment } from "react";
import { IconMapPin } from "@tabler/icons-react";
// GLOBAL CUSTOM COMPONENTS
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { AddressForm } from "@sections/customer-dashboard/address";

const HEADER_LINK = (
  <Link href="/address">
    <Button color="primary">Back</Button>
  </Link>
);

export default function CreateAddress() {
  return (
    <Fragment>
      <DashboardPageHeader
        button={HEADER_LINK}
        title="Add New Address"
        Icon={<IconMapPin size={27} />}
      />

      <Card1 borderRadius={12}>
        <AddressForm />
      </Card1>
    </Fragment>
  );
}
