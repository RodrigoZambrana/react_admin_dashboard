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

import type { OrderSummary } from "@/types/storefront";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";

type StatusColor = "error" | "secondary" | "success" | "warning" | "primary";

const STATUS_COLORS: Record<string, StatusColor> = {
  cancelled: "error",
  canceled: "error",
  pending: "warning",
  processing: "warning",
  confirmed: "primary",
  shipped: "primary",
  fulfilled: "success",
  completed: "success",
  delivered: "success"
};

// =================================================
type OrderRowProps = { order: OrderSummary };
// =================================================

export default function OrderRow({ order }: OrderRowProps) {
  const statusKey = (order.status ?? "pending").toLowerCase();
  const colorKey = STATUS_COLORS[statusKey] ?? "secondary";
  const statusLabel = order.status
    ? order.status.replace(/[-_]+/g, " ")
    : "Unknown";
  const placedDate = format(new Date(order.placedAt), "MMM dd, yyyy");
  const total = order.summary.grandTotal;
  const { formatMoney } = useMoneyFormatter();
  const formattedTotal = useMemo(() => formatMoney(total), [formatMoney, total]);
  const orderIdentifierRaw = order.uuid || order.reference || order.orderNumber || String(order.id);
  const orderIdentifier = String(orderIdentifierRaw);
  const encodedIdentifier = encodeURIComponent(orderIdentifier);

  return (
    <Link href={`/orders/${encodedIdentifier}`}>
      <TableRow
        my="1rem"
        padding="6px 18px"
        boxShadow="none"
        border="1px solid"
        borderColor="gray.200">
        <H5 m="6px" textAlign="left" fontWeight={500}>
          #{orderIdentifier}
        </H5>

        <Box m="6px">
          <Chip p="0.25rem 1rem" bg={`${colorKey}.light`}>
            <Small color={`${colorKey}.main`}>{statusLabel}</Small>
          </Chip>
        </Box>

        <Typography className="flex-grow pre" m="6px" textAlign="left">
          {placedDate}
        </Typography>

        <Typography m="6px" textAlign="left">
          {formattedTotal}
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
