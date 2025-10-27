"use client";

import FlexBox from "@component/FlexBox";
import Pagination from "@component/pagination";
import Address from "@models/address.model";

// ==============================================================
interface Props {
  addressList: Address[];
}
// ==============================================================

export default function AddressPagination({ addressList }: Props) {
  if (!addressList || addressList.length <= 5) {
    return null;
  }

  return (
    <FlexBox justifyContent="center" mt="2.5rem">
      <Pagination onChange={() => undefined} pageCount={Math.ceil(addressList.length / 5)} />
    </FlexBox>
  );
}
