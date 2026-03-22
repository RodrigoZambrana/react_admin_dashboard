"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { IconShoppingBagCheck } from "@tabler/icons-react";

import Hidden from "@component/hidden";
import TableRow from "@component/TableRow";
import { Button } from "@component/buttons";
import { H5 } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";

import { OrderRow, OrdersPagination } from "@sections/customer-dashboard/orders";

import { useAccountOrders } from "@/hooks/useAccountOrders";
import { useTranslation } from "@/state/i18n-context";

export default function OrdersClient() {
  const { orders, loading, error, refresh, needsReauthentication } = useAccountOrders();
  const translate = useTranslation();
  const headerLabels = useMemo(
    () => [
      translate("account.orders.headers.number", { defaultMessage: "Order #" }),
      translate("account.orders.headers.status", { defaultMessage: "Status" }),
      translate("account.orders.headers.date", { defaultMessage: "Date purchased" }),
      translate("account.orders.headers.total", { defaultMessage: "Total" })
    ],
    [translate]
  );

  if (needsReauthentication) {
    return (
      <FlexBox
        flexDirection="column"
        gridGap="0.75rem"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh">
        <Typography color="error.main" fontWeight={600} textAlign="center">
          {error ?? "We could not load your orders because your session has expired."}
        </Typography>
        <Typography textAlign="center" color="text.muted">
          {translate("account.orders.sessionExpiredDesc", {
            defaultMessage:
              "Please log in again to restore access. If the issue continues after signing in, reach out to support so we can investigate."
          })}
        </Typography>
        <Link href="/account/login">
          <Button color="primary" variant="contained">
            {translate("account.orders.sessionExpiredCta", { defaultMessage: "Go to login" })}
          </Button>
        </Link>
      </FlexBox>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <FlexBox minHeight="50vh" alignItems="center" justifyContent="center">
        <Spinner />
      </FlexBox>
    );
  }

  if (error && orders.length === 0) {
    return (
      <FlexBox
        flexDirection="column"
        gridGap="0.75rem"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh">
        <Typography color="error.main" fontWeight={600} textAlign="center">
          {error ?? translate("account.orders.error", { defaultMessage: "We could not load your orders." })}
        </Typography>
        <Button color="primary" variant="contained" onClick={() => refresh()}>
          {translate("account.orders.retry", { defaultMessage: "Try again" })}
        </Button>
      </FlexBox>
    );
  }

  if (!loading && orders.length === 0) {
    return (
      <FlexBox minHeight="40vh" alignItems="center" justifyContent="center">
        <Typography color="text.muted">
          {translate("account.orders.empty", { defaultMessage: "You have not placed any orders yet." })}
        </Typography>
      </FlexBox>
    );
  }

  return (
    <Fragment>
      <DashboardPageHeader
        title={translate("account.orders.title", { defaultMessage: "My Orders" })}
        Icon={<IconShoppingBagCheck size={27} />}
      />

      <Hidden down={769}>
        <TableRow boxShadow="none" padding="0px 18px" backgroundColor="transparent">
          {headerLabels.map((item) => (
            <H5 key={item} fontWeight={500} color="text.muted" my="0px" mx="6px" textAlign="left">
              {item}
            </H5>
          ))}

          <H5 flex="0 0 0 !important" fontWeight={500} color="text.muted" px="22px" my="0px" />
        </TableRow>
      </Hidden>

      {orders.map((order) => {
        const key =
          order.uuid || order.reference || order.orderNumber || `order-${order.id}`;
        return <OrderRow order={order} key={key} />;
      })}

      {orders.length > 0 && <OrdersPagination orderList={orders} />}
    </Fragment>
  );
}
