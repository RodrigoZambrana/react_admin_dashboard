"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import Box from "@component/Box";
import Stepper from "@component/Stepper";

type StepDefinition = {
  title: string;
  path: string;
  disabled?: boolean;
};

const STEPS: StepDefinition[] = [
  { title: "Cart", path: "/cart" },
  { title: "Details", path: "/checkout" },
  { title: "Payment", path: "/payment" },
  { title: "Review", path: "/review", disabled: true }
];

const PATH_TO_STEP_INDEX = new Map<string, number>(
  STEPS.map((step, index) => [step.path, index + 1])
);

export default function CheckoutStepper() {
  const router = useRouter();
  const pathname = usePathname();

  const selectedStep = useMemo(() => PATH_TO_STEP_INDEX.get(pathname) ?? 1, [pathname]);

  const handleStepChange = useCallback(
    (_step: unknown, index: number) => {
      const target = STEPS[index];
      if (!target) return;
      if (target.disabled) return;
      if (target.path !== pathname) {
        router.push(target.path);
      }
    },
    [router, pathname]
  );

  return (
    <Box mb="2rem">
      <Stepper
        selectedStep={selectedStep}
        stepperList={STEPS.map((step) => ({
          title: step.title,
          disabled: Boolean(step.disabled)
        }))}
        onChange={handleStepChange}
      />
    </Box>
  );
}
