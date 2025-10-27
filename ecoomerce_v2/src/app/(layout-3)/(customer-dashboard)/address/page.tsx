import Link from "next/link";
import { Fragment } from "react";
import { IconMapPin } from "@tabler/icons-react";
// API FUNCTIONS
import api from "@utils/__api__/address";
// GLOBAL CUSTOM COMPONENTS
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { AddressItem, AddressPagination } from "@sections/customer-dashboard/address";

const HEADER_LINK = (
  <Link href="/address/create">
    <Button color="primary">Add New Address</Button>
  </Link>
);

export default async function AddressList() {
  const addressList = await api.getAddressList();

  return (
    <Fragment>
      <DashboardPageHeader
        title="My Addresses"
        button={HEADER_LINK}
        Icon={<IconMapPin size={27} />}
      />

      {addressList.map((item) => (
        <AddressItem item={item} />
      ))}

      <AddressPagination addressList={addressList} />
    </Fragment>
  );
}
