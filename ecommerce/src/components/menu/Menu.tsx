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
  closeOnContentClick?: boolean;
  closeOnMouseLeave?: boolean;
  children: ReactElement | ReactElement[];
  handler: (handleOpen: (e: React.MouseEvent<HTMLElement>) => void) => ReactNode;
}
// ============================================

export default function Menu({
  handler,
  style,
  children,
  className,
  direction = "left",
  closeOnContentClick = false,
  closeOnMouseLeave = false,
}: MenuProps) {
  const [show, setShow] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (closeOnContentClick) {
        setShow(false);
      }
    },
    [closeOnContentClick]
  );

  useEffect(() => {
    window.addEventListener("click", handleDocumentClick);
    return () => window.removeEventListener("click", handleDocumentClick);
  }, [handleDocumentClick]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    if (!closeOnMouseLeave) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setShow(false);
      closeTimerRef.current = null;
    }, 120);
  }, [clearCloseTimer, closeOnMouseLeave]);

  return (
    <StyledMenu
      ref={rootRef}
      direction={direction}
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}>
      {handler(togglePopover)}

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={handleContentClick}
            className="menu-item-holder">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </StyledMenu>
  );
}
