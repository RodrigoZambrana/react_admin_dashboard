import Link from "next/link";

import Box from "@component/Box";
import Container from "@component/Container";
import Typography, { H2 } from "@component/Typography";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata = {
  title: "Checkout · Storefront"
};

export default function CheckoutPage() {
  return (
    <Container mt="2rem" mb="4rem">
      <Box maxWidth="720px" mb="2rem">
        <H2 mb="0.75rem">Checkout</H2>
        <Typography color="gray.600" mb="0.75rem">
          Secure checkout is orchestrated through the backend REST API. Customer verification, payment intents, and
          fulfilment coordination run server-side to keep sensitive flows off the client.
        </Typography>
        <Typography fontSize="14px" color="gray.600">
          Already have an account?{" "}
          <Link href="/account/login" style={{ color: "inherit", fontWeight: 600 }}>
            Sign in for a faster experience.
          </Link>
        </Typography>
      </Box>

      <CheckoutForm />
    </Container>
  );
}
