"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import { Button } from "@component/buttons";
import Typography, { H3 } from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";

const DEFAULT_STATE = {
  status: "loading",
  paymentId: "unknown",
  detail: undefined as string | null | undefined
};

const PAYMENT_STATUS_KEYS: Record<string, string> = {
  approved: "checkout.review.paymentStatus.approved",
  authorized: "checkout.review.paymentStatus.authorized",
  in_process: "checkout.review.paymentStatus.in_process",
  pending: "checkout.review.paymentStatus.pending",
  processing: "checkout.review.paymentStatus.processing",
  rejected: "checkout.review.paymentStatus.rejected"
};

export default function PaymentErrorPage() {
  return (
    <Suspense fallback={<PaymentErrorFallback />}>
      <PaymentErrorContent />
    </Suspense>
  );
}

function PaymentErrorContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams?.get("paymentId") ?? DEFAULT_STATE.paymentId;
  const status = searchParams?.get("status") ?? "error";
  const detail = searchParams?.get("detail");

  return <PaymentErrorView paymentId={paymentId} status={status} detail={detail} />;
}

function PaymentErrorFallback() {
  return <PaymentErrorView {...DEFAULT_STATE} />;
}

interface PaymentErrorProps {
  paymentId: string;
  status: string;
  detail?: string | null;
}

function PaymentErrorView({ paymentId, status, detail }: PaymentErrorProps) {
  const t = useTranslation();
  const translateStatus = (value: string | null | undefined) => {
    const normalized = (value ?? "").toLowerCase();
    const key = PAYMENT_STATUS_KEYS[normalized];
    if (key) {
      return t(key);
    }
    return (value && value.length > 0 ? value : null) ?? t("checkout.payment.shared.status", { defaultMessage: "Status" });
  };

  return (
    <Box py="6rem">
      <FlexBox flexDirection="column" alignItems="center" justifyContent="center" px="1.5rem">
        <Card1 maxWidth="540px" width="100%" textAlign="center" p="2.5rem">
          <H3 fontWeight="700" mb="0.5rem" color="error.main">
            {t("checkout.payment.error.title", { defaultMessage: "We could not confirm your payment" })}
          </H3>
          <Typography color="text.muted" mb="2rem">
            {t("checkout.payment.error.subtitle", {
              defaultMessage:
                "Mercado Pago reported a problem while processing your transaction. Please review the details and try again with a different payment method."
            })}
          </Typography>

          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="12px"
            p="1.5rem"
            textAlign="left"
            mb="2rem"
            maxWidth="100%">
            <Typography fontWeight="600" mb="0.5rem">
              {t("checkout.payment.shared.status", { defaultMessage: "Status" })}
            </Typography>
            <Typography color="error.main" mb="1rem">
              {translateStatus(status)}
            </Typography>

            <Typography fontWeight="600" mb="0.5rem">
              {t("checkout.payment.shared.reference", { defaultMessage: "Payment reference" })}
            </Typography>
            <Typography color="text.muted" mb="1rem">
              {paymentId}
            </Typography>

            {detail ? (
              <>
                <Typography fontWeight="600" mb="0.5rem">
                  {t("checkout.payment.shared.mercadoPagoDetail", { defaultMessage: "Mercado Pago detail" })}
                </Typography>
                <Typography color="text.muted">{t(detail, { defaultMessage: detail })}</Typography>
              </>
            ) : null}
          </Box>

          <FlexBox justifyContent="center" flexWrap="wrap" style={{ gap: "1rem" }}>
            <Link href="/payment" style={{ textDecoration: "none" }}>
              <Button color="primary" variant="contained">
                {t("Try again")}
              </Button>
            </Link>
            <Link href="/shop" style={{ textDecoration: "none" }}>
              <Button color="primary" variant="outlined">
                {t("checkout.payment.success.actions.continue", { defaultMessage: "Continue shopping" })}
              </Button>
            </Link>
          </FlexBox>
        </Card1>
      </FlexBox>
    </Box>
  );
}
