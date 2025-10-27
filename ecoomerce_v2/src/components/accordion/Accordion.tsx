"use client";

import {
  Children,
  useRef,
  useState,
  useEffect,
  cloneElement,
  ReactElement,
  useMemo,
  useCallback
} from "react";
// STYLED COMPONENT
import { AccordionWrapper } from "./styles";

// ==========================================
interface AccordionProps {
  expanded?: boolean;
  children: ReactElement[] | any;
}
// ==========================================

export default function Accordion({ expanded = false, children }: AccordionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(expanded);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [parentHeight, setParentHeight] = useState(0);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const parent = ref.current;

    if (parent) {
      const updateHeights = () => {
        setHeaderHeight(parent.children[0].scrollHeight);
        setParentHeight(parent.scrollHeight);
      };

      const resizeObserver = new ResizeObserver(updateHeights);
      resizeObserver.observe(parent);

      updateHeights();

      return () => resizeObserver.disconnect();
    }
  }, []);

  const modifiedChildren = useMemo(() => {
    return Children.map(children, (child, ind) =>
      ind === 0 ? cloneElement(child, { open, onClick: toggle }) : child
    );
  }, [children, open]);

  return (
    <AccordionWrapper ref={ref} height={open ? parentHeight : headerHeight}>
      {modifiedChildren}
    </AccordionWrapper>
  );
}
