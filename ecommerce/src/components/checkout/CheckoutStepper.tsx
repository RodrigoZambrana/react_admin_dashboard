"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import Box from "@component/Box";
import Stepper from "@component/Stepper";

import { useCheckout } from "@/state/checkout-context";

type StepDefinition = {
  title: string;
  path: string;
  key: "cart" | "details" | "payment" | "review";
};

const STEPS: StepDefinition[] = [
  { title: "Cart", path: "/cart", key: "cart" },
  { title: "Details", path: "/checkout", key: "details" },
  { title: "Payment", path: "/payment", key: "payment" },
  { title: "Review", path: "/review", key: "review" }
];

const PATH_TO_STEP_INDEX = new Map<string, number>(
  STEPS.map((step, index) => [step.path, index + 1])
);

export default function CheckoutStepper() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasDetails, hasPayment } = useCheckout();

  const selectedStep = useMemo(() => PATH_TO_STEP_INDEX.get(pathname) ?? 1, [pathname]);

  const disabledLookup = useMemo<Record<StepDefinition["key"], boolean>>(
    () => ({
      cart: false,
      details: false,
      payment: !hasDetails,
      review: !hasDetails || !hasPayment
    }),
    [hasDetails, hasPayment]
  );

  const handleStepChange = useCallback(
    (_step: unknown, index: number) => {
      const target = STEPS[index];
      if (!target) return;
      if (disabledLookup[target.key]) return;
      if (target.path !== pathname) {
        router.push(target.path);
      }
    },
    [router, pathname, disabledLookup]
  );

  return (
    <Box mb="2rem">
      <Stepper
        selectedStep={selectedStep}
        stepperList={STEPS.map((step) => ({
          title: step.title,
          disabled: disabledLookup[step.key]
        }))}
        onChange={handleStepChange}
      />
    </Box>
  );
}
