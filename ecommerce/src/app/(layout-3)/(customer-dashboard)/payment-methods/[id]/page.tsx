import Link from "next/link";
import { Fragment } from "react";
import { IconCreditCard } from "@tabler/icons-react";
// GLOBAL CUSTOM COMPONENTS
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { MethodEditForm } from "@sections/customer-dashboard/payment-method";
// CUSTOM DATA MODEL
import { IDParams } from "interfaces";

const HEADER_LINK = (
  <Link href="/payment-methods">
    <Button color="primary">Back</Button>
  </Link>
);

export default async function PaymentMethodEditor({ params }: IDParams) {
  const { id } = await params;

  return (
    <Fragment>
      <DashboardPageHeader
        button={HEADER_LINK}
        Icon={<IconCreditCard size={27} />}
        title={`${id === "add" ? "Add New" : "Edit"} Payment Method`}
      />

      <Card1 borderRadius={8}>
        <MethodEditForm />
      </Card1>
    </Fragment>
  );
}
