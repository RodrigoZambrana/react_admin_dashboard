"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import Box from "@component/Box";
import Stepper from "@component/Stepper";

import { useCheckout } from "@/state/checkout-context";
import { useTranslation } from "@/state/i18n-context";

type StepDefinition = {
  titleKey: string;
  path: string;
  key: "cart" | "details" | "payment" | "review";
};

const STEPS: StepDefinition[] = [
  { titleKey: "Cart", path: "/cart", key: "cart" },
  { titleKey: "Details", path: "/checkout", key: "details" },
  { titleKey: "Payment", path: "/payment", key: "payment" },
  { titleKey: "Review", path: "/review", key: "review" }
];

const PATH_TO_STEP_INDEX = new Map<string, number>(
  STEPS.map((step, index) => [step.path, index + 1])
);

export default function CheckoutStepper() {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const { hasDetails, hasPayment } = useCheckout();
  const t = useTranslation();

  const selectedStep = useMemo(() => PATH_TO_STEP_INDEX.get(currentPath) ?? 1, [currentPath]);

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
      if (target.path !== currentPath) {
        router.push(target.path);
      }
    },
    [router, currentPath, disabledLookup]
  );

  return (
    <Box mb="2rem">
      <Stepper
        selectedStep={selectedStep}
        stepperList={STEPS.map((step) => ({
          title: t(step.titleKey),
          disabled: disabledLookup[step.key]
        }))}
        onChange={handleStepChange}
      />
    </Box>
  );
}
