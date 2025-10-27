import Link from "next/link";
import { Fragment } from "react";
import { IconMapPin } from "@tabler/icons-react";
// API FUNCTIONS
import api from "@utils/__api__/address";
// GLOBAL CUSTOM COMPONENTS
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { AddressForm } from "@sections/customer-dashboard/address";
// CUSTOM DATA MODEL
import { IDParams } from "interfaces";

const HEADER_LINK = (
  <Link href="/address">
    <Button color="primary">Back</Button>
  </Link>
);

const AddressDetails = async ({ params }: IDParams) => {
  const { id } = await params;
  const address = await api.getAddress(id);

  return (
    <Fragment>
      <DashboardPageHeader
        title="Edit Address"
        button={HEADER_LINK}
        Icon={<IconMapPin size={27} />}
      />

      <Card1 borderRadius={12}>
        <AddressForm address={address} />
      </Card1>
    </Fragment>
  );
};

export default AddressDetails;
