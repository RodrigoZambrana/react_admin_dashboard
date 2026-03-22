import { Fragment } from "react";
import { notFound } from "next/navigation";
import type Order from "@models/order.model";
// UTILS
import axios from "@lib/axios";
import { isDemoRouteEnabled } from "@/lib/public-route-policy";

const ORDER_HEADERS = ["Order #", "Status", "Date purchased", "Total"];

type ApiOrder = Omit<Order, "createdAt" | "deliveredAt"> & {
  createdAt?: string | Date;
  deliveredAt?: string | Date;
};

const isValidOrderArray = (value: unknown): value is ApiOrder[] => Array.isArray(value);

const normalizeOrder = (order: ApiOrder): Order => {
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : createdAt;

  return {
    ...order,
    createdAt,
    deliveredAt
  } as Order;
};

export default async function Orders() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const [
    { IconShoppingBagCheck },
    { default: Hidden },
    { default: TableRow },
    typographyModule,
    { default: DashboardPageHeader },
    { default: OrderList }
  ] = await Promise.all([
    import("@tabler/icons-react"),
    import("@component/hidden"),
    import("@component/TableRow"),
    import("@component/Typography"),
    import("@component/DashboardPageHeader"),
    import("@sections/vendor-dashboard/orders/OrderList")
  ]);
  const { H5 } = typographyModule;

  let orders: Order[] = [];

  try {
    const response = await axios.get<ApiOrder[]>("/api/admin/orders");
    if (isValidOrderArray(response.data)) {
      orders = response.data.map(normalizeOrder);
    }
  } catch (error) {
    console.warn("[vendor] Failed to load orders, falling back to empty list", error);
    orders = [];
  }

  return (
    <Fragment>
      <DashboardPageHeader title="Orders" Icon={<IconShoppingBagCheck size={27} />} />

      <Hidden down={769}>
        <TableRow padding="0px 18px" boxShadow="none" backgroundColor="transparent">
          {ORDER_HEADERS.map((text) => (
            <H5 key={text} fontWeight={500} color="text.muted" my="0px" mx="6px" textAlign="left">
              {text}
            </H5>
          ))}

          <H5 flex="0 0 0 !important" color="text.muted" px="22px" my="0px" />
        </TableRow>
      </Hidden>

      <OrderList orders={orders} />
    </Fragment>
  );
}
