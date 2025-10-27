"use client";

import styled from "styled-components";
import {
  color,
  space,
  border,
  layout,
  flexbox,
  compose,
  SpaceProps,
  ColorProps,
  BorderProps,
  LayoutProps,
  FlexboxProps,
  GridGapProps,
  position,
  PositionProps,
  grid,
  GridProps,
  typography,
  TypographyProps
} from "styled-system";

import { isValidProp } from "@utils/utils";

// ==============================================================
interface Props
  extends FlexboxProps,
    GridProps,
    LayoutProps,
    SpaceProps,
    ColorProps,
    BorderProps,
    GridGapProps,
    PositionProps,
    TypographyProps {}
// ==============================================================

const styleProps = compose(color, space, layout, border, flexbox, grid, position, typography);

const FlexBox = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<Props>`
  display: flex;
  flex-direction: row;
  ${styleProps}
`;

export default FlexBox;
