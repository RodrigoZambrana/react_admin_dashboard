"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import Typography from "@component/Typography";

export default function PaymentErrorPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId") ?? "unknown";
  const status = searchParams.get("status") ?? "error";
  const detail = searchParams.get("detail");

  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <Typography variant="h3" fontWeight="700" mb="0.5rem" color="error.main">
            We could not confirm your payment
          </Typography>
          <Typography color="text.muted" mb="2rem">
            Mercado Pago reported a problem while processing your transaction. Please review the details and try again
            with a different payment method.
          </Typography>

          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="12px"
            p="1.5rem"
            textAlign="left"
            mb="2rem"
            maxWidth="100%"
          >
            <Typography fontWeight="600" mb="0.5rem">
              Status
            </Typography>
            <Typography color="error.main" mb="1rem">
              {status}
            </Typography>

            <Typography fontWeight="600" mb="0.5rem">
              Payment reference
            </Typography>
            <Typography color="text.muted" mb="1rem">
              {paymentId}
            </Typography>

            {detail ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  Mercado Pago detail
                </Typography>
                <Typography color="text.muted">{detail}</Typography>
              </>
            ) : null}
          </Box>

          <FlexBox justifyContent="center" flexWrap="wrap" gap="1rem">
            <Button as={Link} href="/payment" color="primary" variant="contained">
              Try again
            </Button>
            <Button as={Link} href="/shop" color="primary" variant="outlined">
              Continue shopping
            </Button>
          </FlexBox>
        </Card1>
      </FlexBox>
    </Box>
  );
}
