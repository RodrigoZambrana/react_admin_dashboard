"use client";

import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MotionModal } from "./styles";

// ==============================================================
interface ModalProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
}
// ==============================================================

export default function Modal({ onClose, children, open = false, closeOnEsc = true }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape" && onClose) {
        onClose();
      }
    },
    [onClose, closeOnEsc]
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);

      if (modalRef.current) {
        modalRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  const modalContent = (
    <AnimatePresence>
      {open && (
        <MotionModal
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={modalRef}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}>
          <motion.div
            className="container"
            exit={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            initial={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </MotionModal>
      )}
    </AnimatePresence>
  );

  if (!isMounted) return null;

  return createPortal(modalContent, document.body);
}
