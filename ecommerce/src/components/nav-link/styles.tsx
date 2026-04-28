import styled from "styled-components";
import { color, ColorProps, compose, space, SpaceProps } from "styled-system";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface StyledNavLinkProps {
  className?: string;
  isCurrentRoute?: boolean;
  [key: string]: unknown;
}
// ==============================================================

const StyledNavLink = styled.span.withConfig({
  shouldForwardProp: isValidProp
})<StyledNavLinkProps & SpaceProps & ColorProps>(
  ({ isCurrentRoute, theme }) => ({
    position: "relative",
    transition: "all 150ms ease-in-out",
    color: isCurrentRoute ? theme.colors.text.primary ?? theme.colors.gray[900] : "auto",
    "&:hover": {
      color: `${theme.colors.text.primary ?? theme.colors.gray[900]} !important`
    },
    "& svg path": {
      fill: isCurrentRoute ? theme.colors.text.primary ?? theme.colors.gray[900] : "auto"
    },
    "& svg polyline, svg polygon": {
      color: isCurrentRoute ? theme.colors.text.primary ?? theme.colors.gray[900] : "auto"
    }
  }),
  compose(space, color)
);

export default StyledNavLink;
