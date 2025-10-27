"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns/format";
import { IconArrowRight } from "@tabler/icons-react";

import Box from "@component/Box";
import Chip from "@component/Chip";
import Hidden from "@component/hidden";
import TableRow from "@component/TableRow";
import { IconButton } from "@component/buttons";
import Typography, { H5, Small } from "@component/Typography";
import { currency } from "@utils/utils";
import Order from "@models/order.model";

const STATUS_COLORS = {
  Cancelled: "error",
  Pending: "secondary",
  Delivered: "success",
  Processing: "secondary"
} as const;

// =================================================
type OrderRowProps = { order: Order };
// =================================================

export default function OrderRow({ order }: OrderRowProps) {
  const getColor = useMemo(() => STATUS_COLORS[order.status], [order.status]);

  return (
    <Link href={`/vendor/orders/${order.id}`}>
      <TableRow
        my="1rem"
        padding="6px 18px"
        boxShadow="none"
        border="1px solid"
        borderColor="gray.200">
        <H5 m="6px" textAlign="left">
          #{order.id.substring(0, 8)}
        </H5>

        <Box m="6px">
          <Chip p="0.25rem 1rem" bg={`${getColor}.light`}>
            <Small color={`${getColor}.main`}>{order.status}</Small>
          </Chip>
        </Box>

        <Typography className="flex-grow pre" m="6px" textAlign="left">
          {format(new Date(order.createdAt), "MMM dd, yyyy")}
        </Typography>

        <Typography m="6px" textAlign="left">
          {currency(order.totalPrice)}
        </Typography>

        <Hidden flex="0 0 0 !important" down={769}>
          <Typography textAlign="center" color="text.muted">
            <IconButton>
              <IconArrowRight size={18} />
            </IconButton>
          </Typography>
        </Hidden>
      </TableRow>
    </Link>
  );
}
