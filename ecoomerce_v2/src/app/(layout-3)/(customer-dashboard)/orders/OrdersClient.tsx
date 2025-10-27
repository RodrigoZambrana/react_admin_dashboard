"use client";

import { Fragment } from "react";
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

const ORDER_HEADERS = ["Order #", "Status", "Date purchased", "Total"];

export default function OrdersClient() {
  const { orders, loading, error, refresh } = useAccountOrders();

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
        <Typography color="error.main" fontWeight={600}>
          {error}
        </Typography>
        <Button color="primary" variant="contained" onClick={() => refresh()}>
          Try again
        </Button>
      </FlexBox>
    );
  }

  if (!loading && orders.length === 0) {
    return (
      <FlexBox minHeight="40vh" alignItems="center" justifyContent="center">
        <Typography color="text.muted">You have not placed any orders yet.</Typography>
      </FlexBox>
    );
  }

  return (
    <Fragment>
      <DashboardPageHeader title="My Orders" Icon={<IconShoppingBagCheck size={27} />} />

      <Hidden down={769}>
        <TableRow boxShadow="none" padding="0px 18px" backgroundColor="transparent">
          {ORDER_HEADERS.map((item) => (
            <H5 key={item} fontWeight={500} color="text.muted" my="0px" mx="6px" textAlign="left">
              {item}
            </H5>
          ))}

          <H5 flex="0 0 0 !important" fontWeight={500} color="text.muted" px="22px" my="0px" />
        </TableRow>
      </Hidden>

      {orders.map((order) => (
        <OrderRow order={order} key={order.reference ?? order.orderNumber ?? order.id} />
      ))}

      {orders.length > 0 && <OrdersPagination orderList={orders} />}
    </Fragment>
  );
}
