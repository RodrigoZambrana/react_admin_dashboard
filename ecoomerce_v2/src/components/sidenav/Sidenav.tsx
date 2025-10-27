"use client";

import {
  Fragment,
  ReactNode,
  useEffect,
  ReactElement,
  useCallback,
  MouseEvent,
  CSSProperties,
  useState
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

const styles = {
  backdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1200,
    display: "flex"
  } as CSSProperties,

  container: (width: number, position: "left" | "right", scroll: boolean): CSSProperties => ({
    position: "fixed",
    top: 0,
    bottom: 0,
    [position]: 0,
    width: `${width}px`,
    backgroundColor: "white",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.2)",
    zIndex: 1201,
    overflowY: scroll ? "auto" : "hidden"
  }),

  content: {
    height: "100%",
    padding: "1rem"
  } as CSSProperties
};

// ==============================================================
interface SidenavProps {
  width?: number;
  scroll?: boolean;
  className?: string;
  position?: "left" | "right";
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  handle: ReactElement;
}
// ==============================================================

export default function Sidenav({
  handle,
  onClose,
  children,
  className,
  open = false,
  width = 280,
  scroll = false,
  position = "right"
}: SidenavProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleModalContentClick = useCallback((e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const sidenavVariants = {
    hidden: {
      opacity: 0,
      x: position === "right" ? width : -width
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 300
      }
    },
    exit: {
      x: position === "right" ? width : -width,
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  if (!isMounted) return null;

  const sidenavContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          onClick={onClose}
          style={styles.backdrop}
          className={className}
          exit="exit"
          initial="hidden"
          animate="visible"
          variants={backdropVariants}
          transition={{ duration: 0.2 }}>
          <motion.div
            style={styles.container(width, position, scroll)}
            variants={sidenavVariants}
            role="dialog"
            aria-modal="true"
            onClick={handleModalContentClick}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Fragment>
      {createPortal(sidenavContent, document.body)}
      {handle}
    </Fragment>
  );
}
