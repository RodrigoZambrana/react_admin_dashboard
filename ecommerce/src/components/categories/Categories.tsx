"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import CategoryDropdown from "./CategoryDropdown";
import { StyledCategory } from "./styles";

// =====================================================================
interface CategoriesProps {
  open?: boolean;
  handler: (handleOpen: () => void) => ReactNode;
}
// =====================================================================

export default function Categories({ open: controlledOpen, handler }: CategoriesProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

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

  const handleDocumentClick = useCallback(() => {
    if (open && !isControlled) {
      handleOpen(false);
    }
  }, [open, isControlled, handleOpen]);

  useEffect(() => {
    if (open) {
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("scroll", handleDocumentClick);

      return () => {
        document.removeEventListener("click", handleDocumentClick);
        document.removeEventListener("scroll", handleDocumentClick);
      };
    }
  }, [open, handleDocumentClick]);

  return (
    <StyledCategory open={open}>
      {handler(() => handleOpen(true))}

      <CategoryDropdown open={open} />
    </StyledCategory>
  );
}
