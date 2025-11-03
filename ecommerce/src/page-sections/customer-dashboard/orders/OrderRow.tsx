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
import { getBadgePalette, resolveOrderBadgeDescriptor, formatOrderBadgeLabel } from "@/lib/utils/order-status";
import { useTranslation } from "@/state/i18n-context";
import { formatOrderMoney } from "@common/currency/orderMoney";

// =================================================
type OrderRowProps = { order: OrderSummary };
// =================================================

export default function OrderRow({ order }: OrderRowProps) {
  const translate = useTranslation();
  const badgeDescriptor = resolveOrderBadgeDescriptor(order);
  const statusLabel = formatOrderBadgeLabel(badgeDescriptor, translate);
  const badgePalette = getBadgePalette(badgeDescriptor.variant);
  const placedDate = format(new Date(order.placedAt), "MMM dd, yyyy");
  const total = order.summary.grandTotal;
  const formattedTotal = useMemo(
    () => formatOrderMoney(total.amount, total.currency),
    [total]
  );
  const orderUuid = order.uuid || order.reference || order.orderNumber || String(order.id);
  const encodedIdentifier = encodeURIComponent(orderUuid);
  const displayIdentifier = `#${order.id}`;

  return (
    <Link href={`/orders/${encodedIdentifier}`}>
      <TableRow
        my="1rem"
        padding="6px 18px"
        boxShadow="none"
        border="1px solid"
        borderColor="gray.200">
        <H5 m="6px" textAlign="left" fontWeight={500}>
          {displayIdentifier}
        </H5>

        <Box m="6px">
          <Chip p="0.25rem 1rem" bg={badgePalette.background}>
            <Small color={badgePalette.color}>{statusLabel}</Small>
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
