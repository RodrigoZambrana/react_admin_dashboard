"use client";

import styled from "styled-components";
import {
  compose,
  border,
  space,
  layout,
  SpaceProps,
  LayoutProps,
  BorderProps
} from "styled-system";
import { isValidProp } from "@utils/utils";

type ImageProps = SpaceProps & BorderProps & LayoutProps;

const styles = compose(space, border, layout);

const Image = styled.img.withConfig({
  shouldForwardProp: isValidProp
})<ImageProps>(styles);

export default Image;
