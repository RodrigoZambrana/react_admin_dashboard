import { Fragment } from "react";
import { IconShoppingBagCheck } from "@tabler/icons-react";
// UTILS
import axios from "@lib/axios";
// GLOBAL CUSTOM COMPONENTS
import Hidden from "@component/hidden";
import TableRow from "@component/TableRow";
import { H5 } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
import OrderList from "@sections/vendor-dashboard/orders/OrderList";

const ORDER_HEADERS = ["Order #", "Status", "Date purchased", "Total"];

export default async function Orders() {
  const { data } = await axios.get("/api/admin/orders");

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

      <OrderList orders={data} />
    </Fragment>
  );
}
