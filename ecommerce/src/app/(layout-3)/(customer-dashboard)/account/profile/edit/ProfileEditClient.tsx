"use client";

import Link from "next/link";
import { IconUserFilled } from "@tabler/icons-react";

import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";

import { useAccountProfile } from "@/hooks/useAccountProfile";

import { ProfileEditForm } from "@sections/customer-dashboard/profile";

const HEADER_LINK = (
  <Link href="/account/profile">
    <Button color="primary">Back</Button>
  </Link>
);

export default function ProfileEditClient() {
  const { profile, loading, error, refresh, updateLocalProfile } = useAccountProfile();

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

  if (!profile) {
    return null;
  }

  return (
    <>
      <DashboardPageHeader Icon={<IconUserFilled size={27} />} title="Edit Profile" button={HEADER_LINK} />

      <Card1 borderRadius={12}>
        <ProfileEditForm profile={profile} onUpdated={updateLocalProfile} />
      </Card1>
    </>
  );
}
