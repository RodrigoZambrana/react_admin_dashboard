"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Divider from "@component/Divider";
import TextArea from "@component/textarea";
import { Card1 } from "@component/Card1";
import TextField from "@component/text-field";
import Typography, { H6, Paragraph } from "@component/Typography";
import { Button } from "@component/buttons";

import { formatMoney } from "@/lib/utils/format";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { useStorefrontCart } from "@/state/cart-context";

interface CheckoutFormState {
  status: "idle" | "submitting" | "success" | "error";
  error?: string;
  orderId?: string;
  orderNumber?: string;
}

const normalizeString = (value: FormDataEntryValue | null | undefined) =>
  typeof value === "string" ? value.trim() : "";

export function CheckoutForm() {
  const { state, subtotal, clearCart } = useStorefrontCart();
  const [formState, setFormState] = useState<CheckoutFormState>({ status: "idle" });
  const router = useRouter();

  const lineItems = useMemo(() => state.items, [state.items]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (lineItems.length === 0) {
      return;
    }

    const data = new FormData(event.currentTarget);
    setFormState({ status: "submitting" });

    try {
      const order = await StorefrontApi.createOrder({
        customer: {
          firstName: normalizeString(data.get("firstName")),
          lastName: normalizeString(data.get("lastName")),
          email: normalizeString(data.get("email")),
          phone: normalizeString(data.get("phone"))
        },
        shippingAddress: {
          line1: normalizeString(data.get("address1")),
          line2: normalizeString(data.get("address2")),
          city: normalizeString(data.get("city")),
          state: normalizeString(data.get("state")),
          zip: normalizeString(data.get("zip")),
          country: normalizeString(data.get("country"))
        },
        billingAddress: undefined,
        items: lineItems.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        notes: normalizeString(data.get("notes"))
      });

      clearCart();
      setFormState({
        status: "success",
        orderId: String(order.id),
        orderNumber: order.orderNumber
      });
    } catch (error) {
      if (isApiError(error)) {
        setFormState({
          status: "error",
          error: error.payload?.message ?? error.message ?? "Unable to process your order."
        });
      } else if (error instanceof Error) {
        setFormState({ status: "error", error: error.message });
      } else {
        setFormState({ status: "error", error: "Unexpected error processing your order." });
      }
    }
  };

  if (formState.status === "success") {
    return (
      <Card1 borderRadius={16}>
        <H6 mb="0.5rem" color="success.main">
          Order confirmed
        </H6>
        <Typography mb="1rem" color="gray.700">
          Thank you! Your order has been registered with the backend service. You can review fulfilment updates from
          the administrative dashboard.
        </Typography>
        <Typography color="gray.600">
          Order ID: <strong>{formState.orderId}</strong>
        </Typography>
        {formState.orderNumber ? (
          <Typography mt="0.5rem" color="gray.600">
            Order number: <strong>{formState.orderNumber}</strong>
          </Typography>
        ) : null}
        <FlexBox mt="1.5rem" flexWrap="wrap" gap="0.75rem">
          <Button
            size="large"
            color="primary"
            variant="contained"
            onClick={() => router.push("/sale-page-1")}
          >
            Continue shopping
          </Button>
          <Button
            size="large"
            color="secondary"
            variant="outlined"
            onClick={() => router.push("/orders")}
          >
            View orders
          </Button>
        </FlexBox>
      </Card1>
    );
  }

  if (lineItems.length === 0) {
    return (
      <Card1 borderRadius={16}>
        <H6 mb="0.5rem">Your cart is empty</H6>
        <Typography mb="1.5rem" color="gray.700">
          Add some products before attempting to checkout. Items are sourced from the live backend catalog to ensure
          accurate pricing and availability.
        </Typography>
        <Button size="large" color="primary" onClick={() => router.push("/sale-page-1")}>
          Browse products
        </Button>
      </Card1>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={6}>
        <Grid item lg={8} md={7} xs={12}>
          <Box display="grid" gridGap="1.5rem">
            <Card1 borderRadius={16}>
              <H6 mb="1rem">Contact information</H6>
              <Grid container spacing={6}>
                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    label="First name"
                    name="firstName"
                    placeholder="Jane"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item sm={6} xs={12}>
                  <TextField
                    fullWidth
                    label="Last name"
                    name="lastName"
                    placeholder="Doe"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email address"
                    name="email"
                    placeholder="jane@example.com"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Phone"
                    name="phone"
                    placeholder="+1 555 0100"
                    mb="0.5rem"
                  />
                  <Typography fontSize="12px" color="gray.600">
                    We use your phone number for delivery coordination and support follow-ups.
                  </Typography>
                </Grid>
              </Grid>
            </Card1>

            <Card1 borderRadius={16}>
              <H6 mb="1rem">Shipping address</H6>
              <Grid container spacing={6}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address line 1"
                    name="address1"
                    placeholder="123 Market St"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address line 2"
                    name="address2"
                    placeholder="Apartment, suite, etc."
                    mb="1rem"
                  />
                </Grid>
                <Grid item sm={5} xs={12}>
                  <TextField
                    fullWidth
                    label="City"
                    name="city"
                    placeholder="San Francisco"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item sm={3} xs={12}>
                  <TextField
                    fullWidth
                    label="State / Region"
                    name="state"
                    placeholder="CA"
                    mb="1rem"
                  />
                </Grid>
                <Grid item sm={4} xs={12}>
                  <TextField
                    fullWidth
                    label="ZIP / Postal code"
                    name="zip"
                    placeholder="94107"
                    required
                    mb="1rem"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Country"
                    name="country"
                    placeholder="United States"
                    required
                  />
                </Grid>
              </Grid>
            </Card1>

            <Card1 borderRadius={16}>
              <H6 mb="1rem">Order notes</H6>
              <TextArea
                fullWidth
                minHeight="120px"
                name="notes"
                placeholder="Add delivery notes or instructions for the fulfilment team."
              />
            </Card1>
          </Box>
        </Grid>

        <Grid item lg={4} md={5} xs={12}>
          <Card1 borderRadius={16}>
            <H6 mb="1rem">Order summary</H6>

            <Box display="grid" gridGap="1rem">
              {lineItems.map(({ product, quantity }) => {
                const unit = product.salePrice ?? product.price;
                const lineTotal = formatMoney({ amount: unit.amount * quantity, currency: unit.currency });

                return (
                  <Box key={product.id} display="grid" gridTemplateColumns="1fr auto" gridGap="0.5rem">
                    <Box>
                      <Paragraph fontWeight="600" mb="0.25rem" lineHeight="1.4">
                        {product.name}
                      </Paragraph>
                      <Typography fontSize="12px" color="gray.600">
                        Qty {quantity}
                      </Typography>
                    </Box>
                    <Typography fontWeight="600">{lineTotal}</Typography>
                  </Box>
                );
              })}
            </Box>

            <Divider my="1.5rem" />

            <FlexBox justifyContent="space-between" mb="0.75rem">
              <Typography color="gray.600">Subtotal</Typography>
              <Typography fontWeight="600">{formatMoney(subtotal)}</Typography>
            </FlexBox>
            <FlexBox justifyContent="space-between" mb="0.75rem">
              <Typography color="gray.600">Shipping</Typography>
              <Typography color="gray.600">Calculated at fulfilment</Typography>
            </FlexBox>
            <FlexBox justifyContent="space-between" mb="1.5rem">
              <Typography color="gray.600">Taxes</Typography>
              <Typography color="gray.600">Calculated at fulfilment</Typography>
            </FlexBox>

            {formState.status === "error" ? (
              <Box
                mb="1.5rem"
                p="1rem"
                borderRadius={12}
                bg="error.light"
                color="error.main"
                border="1px solid"
                borderColor="error.main"
              >
                <Typography fontSize="14px">{formState.error}</Typography>
              </Box>
            ) : null}

            <Button
              type="submit"
              size="large"
              color="primary"
              fullWidth
              disabled={formState.status === "submitting"}
              mb="0.75rem"
            >
              {formState.status === "submitting" ? "Processing order..." : "Place order"}
            </Button>

            <Button
              type="button"
              size="large"
              variant="outlined"
              color="primary"
              fullWidth
              onClick={() => router.push("/cart")}
            >
              Back to cart
            </Button>

            <Typography mt="1rem" fontSize="12px" color="gray.600">
              Payments, fraud screening, and final totals are orchestrated by the backend. This checkout captures order
              intent and delegates secure processing to the server stack.
            </Typography>
          </Card1>
        </Grid>
      </Grid>
    </form>
  );
}

export default CheckoutForm;
