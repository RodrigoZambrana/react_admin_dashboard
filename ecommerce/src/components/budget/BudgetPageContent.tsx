"use client";

import Box from "@component/Box";

import BudgetCalculatorPanel from "@/components/budget/BudgetCalculatorPanel";

type Props = {
  title: string;
  description: string;
  initialProductId?: number | null;
  initialProductSlug?: string | null;
  initialWidth?: number;
  initialHeight?: number;
};

export default function BudgetPageContent({
  title,
  description,
  initialProductId,
  initialProductSlug,
  initialWidth = 1,
  initialHeight = 1,
}: Props) {
  return (
    <Box>
      <BudgetCalculatorPanel
        title={title}
        description={description}
        initialProductId={initialProductId}
        initialProductSlug={initialProductSlug}
        initialWidth={initialWidth}
        initialHeight={initialHeight}
      />
    </Box>
  );
}
