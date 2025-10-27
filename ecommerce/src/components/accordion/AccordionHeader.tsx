import { ReactNode } from "react";
import { FlexboxProps, SpaceProps } from "styled-system";
import { IconChevronRight } from "@tabler/icons-react";
// STYLED COMPONENT
import { AccordionHeaderWrapper } from "./styles";

// ==================================================================================
interface Props extends SpaceProps, FlexboxProps {
  open?: boolean;
  showIcon?: boolean;
  children: ReactNode;
  [key: string]: unknown;
}

// ==================================================================================

export default function AccordionHeader({ open, children, showIcon = true, ...props }: Props) {
  return (
    <AccordionHeaderWrapper open={open as boolean} {...props}>
      {children}
      {showIcon && <IconChevronRight size={16} stroke={1.5} className="caret-icon" />}
    </AccordionHeaderWrapper>
  );
}
