"use client";

import { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { CSSProperties } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
// STYLED COMPONENT
import { StyledMenu } from "./styles";

// ============================================
interface MenuProps {
  className?: string;
  style?: CSSProperties;
  direction?: "left" | "right";
  children: ReactElement | ReactElement[];
  handler: (handleOpen: (e: React.MouseEvent<HTMLElement>) => void) => ReactNode;
}
// ============================================

export default function Menu({
  handler,
  style,
  children,
  className,
  direction = "left"
}: MenuProps) {
  const [show, setShow] = useState(false);

  const popoverRef = useRef(show);
  popoverRef.current = show;

  const handleDocumentClick = useCallback(() => {
    if (popoverRef.current) setShow(false);
  }, []);

  const togglePopover = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      setShow((state) => !state);
    },
    []
  );

  useEffect(() => {
    window.addEventListener("click", handleDocumentClick);
    return () => window.removeEventListener("click", handleDocumentClick);
  }, [handleDocumentClick]);

  return (
    <StyledMenu direction={direction} className={className} style={style}>
      {handler(togglePopover)}

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="menu-item-holder">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </StyledMenu>
  );
}
