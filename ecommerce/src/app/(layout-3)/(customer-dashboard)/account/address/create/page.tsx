"use client";

import Link from "next/link";
import { Fragment, Suspense } from "react";
import { IconMapPin } from "@tabler/icons-react";

// GLOBAL CUSTOM COMPONENTS
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";

// PAGE SECTION COMPONENTS
import { AddressForm } from "@sections/customer-dashboard/address";

import { useTranslation } from "@/state/i18n-context";

function AccountCreateAddressPageContent() {
  const t = useTranslation();

  const headerLink = (
    <Link href="/account/address">
      <Button color="primary">{t("Back")}</Button>
    </Link>
  );

  return (
    <Fragment>
      <DashboardPageHeader
        button={headerLink}
        title={t("Add New Address")}
        Icon={<IconMapPin size={27} />}
      />

      <Card1 borderRadius={12}>
        <AddressForm />
      </Card1>
    </Fragment>
  );
}

export default function AccountCreateAddressPage() {
  return (
    <Suspense fallback={null}>
      <AccountCreateAddressPageContent />
    </Suspense>
  );
}
