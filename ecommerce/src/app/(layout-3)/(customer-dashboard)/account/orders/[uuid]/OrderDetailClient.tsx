"use client";

import Link from "next/link";
import { IconShoppingBagCheck } from "@tabler/icons-react";
import { format } from "date-fns/format";

import Box from "@component/Box";
import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import Chip from "@component/Chip";
import { Button } from "@component/buttons";
import Typography, { H5, H6, Paragraph, Small } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
import Spinner from "@component/Spinner";

import { OrderStatus, WriteReview } from "@sections/customer-dashboard/orders";

import { useAccountOrder } from "@/hooks/useAccountOrders";
import { getBadgePalette, resolveOrderBadgeDescriptor } from "@/lib/utils/order-status";
import { useTranslation } from "@/state/i18n-context";
import { formatOrderMoney } from "@common/currency/orderMoney";

const formatAddress = (address: {
  line1: string;
  line2?: string;
  city: string;
  department?: string;
  neighborhood?: string;
  state?: string;
  zip?: string;
  country: string;
}) => [
  address.line1,
  address.line2,
  [address.city, address.neighborhood, address.department || address.state].filter(Boolean).join(", "),
  address.zip,
  address.country
]
  .filter(Boolean)
  .join(", ");

interface OrderDetailClientProps {
  identifier: string;
}

export default function OrderDetailClient({ identifier }: OrderDetailClientProps) {
  const {
    order,
    timeline,
    timelineLoading,
    timelineError,
    loading,
    error,
    refresh,
    needsReauthentication
  } = useAccountOrder(identifier);
  const translate = useTranslation();

  if (needsReauthentication) {
    return (
      <FlexBox
        flexDirection="column"
        gridGap="0.75rem"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh">
        <Typography color="error.main" fontWeight={600} textAlign="center">
          {error ?? "We could not load this order because your session has expired."}
        </Typography>
        <Typography textAlign="center" color="text.muted">
          Please log in again to continue. If the issue persists after signing in, contact support so
          we can look into it.
        </Typography>
        <Link href="/account/login">
          <Button color="primary" variant="contained">
            Go to login
          </Button>
        </Link>
      </FlexBox>
    );
  }

  if (loading && !order) {
    return (
      <FlexBox minHeight="50vh" alignItems="center" justifyContent="center">
        <Spinner />
      </FlexBox>
    );
  }

  if (error && !order) {
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

  if (!order) {
    return null;
  }

  const orderIdentifier = order.uuid || order.reference || order.orderNumber || "order";
  const displayOrderId = `#${orderIdentifier}`;
  const placedDate = format(new Date(order.placedAt), "dd MMM, yyyy");
  const subtotal = order.summary.subtotal;
  const shipping = order.summary.shipping;
  const tax = order.summary.tax;
  const discountTotal = (order.summary.discounts ?? []).reduce((sum, item) => sum + item.amount, 0);
  const currency = order.summary.grandTotal.currency;
  const badgeDescriptor = resolveOrderBadgeDescriptor(order);
  const statusLabel =
    badgeDescriptor.type === "payment"
      ? translate(`order.timeline.payment.summary.labels.${badgeDescriptor.state}`, {
          defaultMessage: badgeDescriptor.fallbackLabel
        })
      : badgeDescriptor.fallbackLabel;
  const statusPalette = getBadgePalette(badgeDescriptor.variant);
  const chipBackground =
    badgeDescriptor.variant === "danger" ? "error.light" : statusPalette.background;
  const chipColor =
    badgeDescriptor.variant === "danger" ? "error.main" : statusPalette.color;

  const backButton = (
    <Link href="/account/orders">
      <Button px="2rem" color="primary">
        {translate("account.orderDetails.back", { defaultMessage: "Order List" })}
      </Button>
    </Link>
  );

  return (
    <>
      <DashboardPageHeader
        button={backButton}
        title={translate("account.orderDetails.title", { defaultMessage: "Order Details" })}
        Icon={<IconShoppingBagCheck size={27} />}
      />

      <OrderStatus
        timeline={timeline}
        paymentInfo={order.payment ?? null}
        loading={timelineLoading}
        error={timelineError}
      />

      <Card p="0px" mb="30px" overflow="hidden" borderRadius={12}>
        <TableRow bg="gray.200" p="12px" boxShadow="none" borderRadius={0}>
          <FlexBox className="pre" m="6px" alignItems="center">
            <Typography fontSize="14px" color="text.muted" mr="4px">
              {translate("account.orderDetails.labels.orderId", { defaultMessage: "Order ID:" })}
            </Typography>

            <Typography fontSize="14px" data-testid="account-order-display-id">
              {displayOrderId}
            </Typography>
          </FlexBox>

          <FlexBox className="pre" m="6px" alignItems="center">
            <Typography fontSize="14px" color="text.muted" mr="4px">
              {translate("account.orderDetails.labels.placedOn", { defaultMessage: "Placed on:" })}
            </Typography>

            <Typography fontSize="14px">{placedDate}</Typography>
          </FlexBox>

          <FlexBox className="pre" m="6px" alignItems="center">
            <Typography fontSize="14px" color="text.muted" mr="4px">
              {translate("account.orderDetails.labels.status", { defaultMessage: "Status:" })}
            </Typography>

            <Chip p="0.25rem 1rem" bg={chipBackground}>
              <Small color={chipColor}>{statusLabel}</Small>
            </Chip>
          </FlexBox>
        </TableRow>

        <Box py="0.5rem">
          {order.items.map((item) => (
            <WriteReview item={item} orderIdentifier={order.uuid} key={`${item.productId}-${item.name}`} />
          ))}
        </Box>
      </Card>

      <Grid container spacing={6}>
        <Grid item lg={6} md={6} xs={12}>
          <Card p="20px 30px" borderRadius={12}>
            <H5 mt="0px" mb="14px">
              {translate("account.orderDetails.sections.shipping", { defaultMessage: "Shipping Address" })}
            </H5>

            <Paragraph fontSize="14px" my="0px" data-testid="account-order-shipping-address">
              {formatAddress(order.shippingAddress)}
            </Paragraph>

            {order.summary.notes ? (
              <>
                <Divider my="1rem" />
                <H6 mt="0px" mb="10px">
                  {translate("account.orderDetails.sections.notes", { defaultMessage: "Customer notes" })}
                </H6>
                <Paragraph
                  fontSize="14px"
                  my="0px"
                  color="text.muted"
                  style={{ whiteSpace: "pre-wrap" }}
                  data-testid="account-order-customer-notes"
                >
                  {order.summary.notes}
                </Paragraph>
              </>
            ) : null}
          </Card>
        </Grid>

        <Grid item lg={6} md={6} xs={12}>
          <Card p="20px 30px" borderRadius={12}>
            <H5 mt="0px" mb="14px">
              {translate("account.orderDetails.sections.summary", { defaultMessage: "Total Summary" })}
            </H5>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                {translate("account.orderDetails.summary.subtotal", { defaultMessage: "Subtotal:" })}
              </Typography>

              <H6 my="0px">{formatOrderMoney(subtotal.amount, subtotal.currency)}</H6>
            </FlexBox>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                {translate("account.orderDetails.summary.shippingFee", { defaultMessage: "Shipping fee:" })}
              </Typography>

              <H6 my="0px">{formatOrderMoney(shipping.amount, shipping.currency)}</H6>
            </FlexBox>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                {translate("account.orderDetails.summary.tax", { defaultMessage: "Tax:" })}
              </Typography>

              <H6 my="0px">{formatOrderMoney(tax.amount, tax.currency)}</H6>
            </FlexBox>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                {translate("account.orderDetails.summary.discount", { defaultMessage: "Discount:" })}
              </Typography>

              <H6 my="0px">-{formatOrderMoney(discountTotal, currency)}</H6>
            </FlexBox>

            <Divider mb="0.5rem" />

            <FlexBox justifyContent="space-between" alignItems="center" mb="1rem">
              <H6 my="0px">
                {translate("account.orderDetails.summary.total", { defaultMessage: "Total" })}
              </H6>
              <H6 my="0px">{formatOrderMoney(order.summary.grandTotal.amount, currency)}</H6>
            </FlexBox>

          </Card>
        </Grid>
      </Grid>
    </>
  );
}
