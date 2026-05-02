"use client";

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import CategoryDropdown from "./CategoryDropdown";
import { StyledCategory } from "./styles";
import type { CategorySummary } from "@/types/storefront";

// =====================================================================
interface CategoriesProps {
  open?: boolean;
  handler: (handleOpen: () => void) => ReactNode;
  categories?: CategorySummary[];
  icons?: string[];
}
// =====================================================================

export default function Categories({
  open: controlledOpen,
  handler,
  categories,
  icons,
}: CategoriesProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
    },
    [isControlled]
  );

  useEffect(() => {
    if (!open || isControlled) {
      return undefined;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const container = containerRef.current;
      const target = event.target as Node | null;
      if (!container || !target) {
        handleOpen(false);
        return;
      }

      if (!container.contains(target)) {
        handleOpen(false);
      }
    };

    const handleScroll = () => {
      handleOpen(false);
    };

    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("scroll", handleScroll);
    };
  }, [open, isControlled, handleOpen]);

  return (
    <StyledCategory ref={containerRef} open={open}>
      {handler(() => handleOpen(!open))}

      <CategoryDropdown open={open} categories={categories} icons={icons} />
    </StyledCategory>
  );
}
