"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { IconMapPin } from "@tabler/icons-react";

import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";

import { AddressForm } from "@sections/customer-dashboard/address";

import { useAccountProfile } from "@/hooks/useAccountProfile";

interface AddressDetailsClientProps {
  addressId: string;
}

const HEADER_LINK = (
  <Link href="/account/address">
    <Button color="primary">Back</Button>
  </Link>
);

export default function AddressDetailsClient({ addressId }: AddressDetailsClientProps) {
  const { profile, loading, error, refresh } = useAccountProfile();

  const address = useMemo(() => {
    if (!profile?.addresses) {
      return null;
    }
    return profile.addresses.find((item) => String(item.id) === addressId) ?? null;
  }, [profile?.addresses, addressId]);

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

  if (!address) {
    return (
      <FlexBox
        minHeight="40vh"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gridGap="0.75rem">
        <Typography fontWeight={600} fontSize="16px">
          We couldn&apos;t find that address.
        </Typography>
        <Typography color="text.muted" maxWidth="360px" textAlign="center">
          It may have been removed or you might not have permission to view it.
        </Typography>
        {HEADER_LINK}
      </FlexBox>
    );
  }

  return (
    <Fragment>
      <DashboardPageHeader
        title={address.label ? `Edit ${address.label}` : "Edit Address"}
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
          p="1rem"
          mb="1.5rem">
          <Typography color="error.main" fontWeight={500}>
            {error}
          </Typography>
          <Button color="primary" variant="outlined" onClick={() => refresh()} size="small">
            Retry
          </Button>
        </FlexBox>
      )}

      <Card1 borderRadius={12}>
        <AddressForm address={address} />
      </Card1>
    </Fragment>
  );
}
