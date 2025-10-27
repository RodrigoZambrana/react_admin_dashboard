"use client";

import {
  grid,
  color,
  space,
  border,
  layout,
  flexbox,
  compose,
  position,
  typography,
  GridProps,
  ColorProps,
  SpaceProps,
  BorderProps,
  LayoutProps,
  FlexboxProps,
  PositionProps,
  TypographyProps
} from "styled-system";
import styled from "styled-components";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface BoxProps
  extends LayoutProps,
    GridProps,
    ColorProps,
    SpaceProps,
    BorderProps,
    FlexboxProps,
    PositionProps,
    TypographyProps {
  cursor?: string;
  transition?: string;
  shadow?: number | null;
}
// ==============================================================

const Box = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<BoxProps>(
  ({ shadow = 0, cursor = "unset", transition, theme }) => ({
    cursor,
    transition,
    boxShadow: theme.shadows[shadow]
  }),
  compose(layout, space, color, grid, position, flexbox, border, typography)
);

export default Box;
