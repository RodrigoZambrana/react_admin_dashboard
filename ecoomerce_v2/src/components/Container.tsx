"use client";

import {
  color,
  space,
  layout,
  flexbox,
  compose,
  position,
  ColorProps,
  SpaceProps,
  LayoutProps,
  FlexboxProps,
  PositionProps
} from "styled-system";
import styled from "styled-components";

import { isValidProp } from "@utils/utils";
import { layoutConstant } from "@utils/constants";

// ==============================================================
interface Props extends LayoutProps, ColorProps, PositionProps, SpaceProps, FlexboxProps {
  fluid?: boolean;
}
// ==============================================================

const styleProps = compose(color, position, flexbox, layout, space);

const Container = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<Props>`
  margin-left: auto;
  margin-right: auto;
  max-width: ${({ fluid }) => (fluid ? "100%" : layoutConstant.containerWidth)};
  padding-left: ${({ fluid }) => fluid && "1rem"};
  padding-right: ${({ fluid }) => fluid && "1rem"};
  @media only screen and (max-width: 1199px) {
    margin-left: 1rem;
    margin-right: 1rem;
  }
  ${styleProps}
`;

export default Container;
