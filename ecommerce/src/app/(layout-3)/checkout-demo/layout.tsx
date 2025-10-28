"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, PropsWithChildren, useCallback, useMemo } from "react";
import Hidden from "@component/hidden";
import Stepper from "@component/Stepper";

const STEPPER_LIST = [
  { title: "Cart", disabled: false, path: "/checkout-demo/cart-demo" },
  { title: "Details", disabled: false, path: "/checkout-demo/checkout-demo" },
  { title: "Payment", disabled: false, path: "/checkout-demo/payment" },
  { title: "Review", disabled: true, path: "/checkout-demo/review" }
];

const PATH_TO_STEP_MAP: Record<string, number> = {
  "/checkout-demo/cart-demo": 1,
  "/checkout-demo/checkout-demo": 2,
  "/checkout-demo/payment": 3
};

export default function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();

  const selectedStep = useMemo(() => PATH_TO_STEP_MAP[pathname] ?? 0, [pathname]);

  const handleStepChange = useCallback(
    (_step: unknown, index: number) => {
      const targetPath = STEPPER_LIST[index]?.path;
      if (targetPath) {
        router.push(targetPath);
      }
    },
    [router]
  );

  return (
    <Fragment>
      <Hidden down="md" mb="2rem">
        <Stepper
          stepperList={STEPPER_LIST}
          selectedStep={selectedStep}
          onChange={handleStepChange}
        />
      </Hidden>

      {children}
    </Fragment>
  );
}
