import styled from "styled-components";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface StyledStickyProps {
  fixed: boolean;
  fixedOn: number;
  componentHeight: number;
}
// ==============================================================

export const StyledSticky = styled("div").withConfig({
  shouldForwardProp: isValidProp
})<StyledStickyProps>(({ componentHeight, fixedOn, fixed }) => ({
  paddingTop: fixed ? componentHeight : 0,
  "& .hold": {
    zIndex: 5,
    boxShadow: "none",
    position: "relative"
  },
  "& .fixed": {
    left: 0,
    right: 0,
    zIndex: 1000,
    position: "fixed",
    top: `${fixedOn}px`,
    transition: "all 350ms ease-in-out",
    animation: fixed ? "slideDown 0.3s ease-in-out" : "slideUp 0.3s ease-in-out",
    boxShadow: fixed ? "0 0 10px 0 rgba(0, 0, 0, 0.1)" : "none"
  },

  "@keyframes slideDown": {
    from: {
      transform: "translateY(-100%)",
      opacity: 0
    },
    to: {
      transform: "translateY(0)",
      opacity: 1
    }
  },

  "@keyframes slideUp": {
    from: {
      transform: "translateY(0)",
      opacity: 1
    },
    to: {
      transform: "translateY(-100%)",
      opacity: 0
    }
  }
}));
