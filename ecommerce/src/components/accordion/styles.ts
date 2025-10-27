import styled from "styled-components";
import { layout, LayoutProps } from "styled-system";
import FlexBox from "@component/FlexBox";
import { isValidProp } from "@utils/utils";

// STYLED COMPONENT
export const AccordionWrapper = styled.div<LayoutProps>`
  cursor: pointer;
  overflow: hidden;
  transition: height 250ms ease-in-out;
  ${layout}
`;

export const AccordionHeaderWrapper = styled(FlexBox).withConfig({
  shouldForwardProp: isValidProp
})<{ open: boolean }>`
  align-items: center;
  justify-content: space-between;
  .caret-icon {
    transition: transform 250ms ease-in-out;
    transform: ${({ open }) => (open ? "rotate(90deg)" : "rotate(0deg)")};
  }
`;
