"use client";

import Link from "next/link";
import { Fragment } from "react";
import { IconMapPin } from "@tabler/icons-react";

import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";

import { AddressItem, AddressPagination } from "@sections/customer-dashboard/address";

import { useAccountProfile } from "@/hooks/useAccountProfile";

const HEADER_LINK = (
  <Link href="/address/create">
    <Button color="primary">Add New Address</Button>
  </Link>
);

export default function AddressClient() {
  const { profile, loading, error, refresh } = useAccountProfile();

  const addresses = profile?.addresses ?? [];

  if (loading && !profile) {
    return (
      <FlexBox minHeight="50vh" alignItems="center" justifyContent="center">
        <Spinner />
      </FlexBox>
    );
  }

  if (error && !profile) {
    return (
      <FlexBox
        flexDirection="column"
        gridGap="0.75rem"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh">
        <Typography color="error.main" fontWeight={600}>
          {error}
        </Typography>
        <Button color="primary" variant="contained" onClick={() => refresh()}>
          Try again
        </Button>
      </FlexBox>
    );
  }

  return (
    <Fragment>
      <DashboardPageHeader
        title="My Addresses"
        button={HEADER_LINK}
        Icon={<IconMapPin size={27} />}
      />

      {error && (
        <FlexBox
          flexDirection="column"
          gridGap="0.5rem"
          borderRadius={12}
          border="1px solid"
          borderColor="error.light"
          backgroundColor="rgba(255, 86, 48, 0.08)"
          p="1rem">
          <Typography color="error.main" fontWeight={500}>
            {error}
          </Typography>
          <Button color="primary" variant="outlined" onClick={() => refresh()} size="small">
            Retry
          </Button>
        </FlexBox>
      )}

      {addresses.length === 0 ? (
        <FlexBox
          minHeight="30vh"
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          gridGap="0.75rem"
          border="1px dashed"
          borderColor="gray.300"
          borderRadius={12}
          p="2rem">
          <Typography fontWeight={600} fontSize="16px">
            You haven&apos;t saved any addresses yet.
          </Typography>
          <Typography color="text.muted" textAlign="center" maxWidth="360px">
            Add your shipping address details so your future orders are ready to go.
          </Typography>
          <Link href="/address/create">
            <Button color="primary" variant="contained">
              Add an address
            </Button>
          </Link>
        </FlexBox>
      ) : (
        <Fragment>
          {addresses.map((item) => (
            <AddressItem key={item.id} item={item} />
          ))}

          <AddressPagination addressList={addresses} />
        </Fragment>
      )}
    </Fragment>
  );
}
