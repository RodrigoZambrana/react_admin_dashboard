import Link from "next/link";
import { Fragment } from "react";
import { IconCreditCard } from "@tabler/icons-react";
// GLOBAL CUSTOM COMPONENTS
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { PaymentMethodList } from "@sections/customer-dashboard/payment-method";

const HEADER_LINK = (
  <Link href="/payment-methods/add">
    <Button color="primary">Add New</Button>
  </Link>
);

export default function PaymentMethods() {
  return (
    <Fragment>
      <DashboardPageHeader
        button={HEADER_LINK}
        title="Payment Methods"
        Icon={<IconCreditCard size={27} />}
      />

      <PaymentMethodList methodList={methodList} />
    </Fragment>
  );
}

const methodList = [
  {
    orderNo: "1050017AS",
    exp: "08 / 2022",
    payment_method: "Amex",
    card_no: "1234 **** **** ****"
  },
  {
    orderNo: "1050017AS",
    exp: "10 / 2025",
    payment_method: "Mastercard",
    card_no: "1234 **** **** ****"
  },
  {
    orderNo: "1050017AS",
    exp: "N/A",
    payment_method: "PayPal",
    card_no: "ui-lib@email.com"
  },
  {
    orderNo: "1050017AS",
    exp: "08 / 2022",
    payment_method: "Visa",
    card_no: "1234 **** **** ****"
  }
];
