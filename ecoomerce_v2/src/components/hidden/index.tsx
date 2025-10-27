"use client";

import { memo, ReactNode } from "react";
import styled from "styled-components";
import { compose, flex, FlexProps, space, SpaceProps } from "styled-system";
import { deviceOptions } from "interfaces";
import { deviceSize } from "@utils/constants";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface HiddenProps extends SpaceProps, FlexProps {
  down?: number | deviceOptions;
  up?: number | deviceOptions;
  children: ReactNode;
}
// ==============================================================

const generateMediaQuery = (up?: number | deviceOptions, down?: number | deviceOptions) => {
  const upDeviceSize = typeof up === "number" ? up : deviceSize[up as deviceOptions];
  const downDeviceSize = typeof down === "number" ? down : deviceSize[down as deviceOptions];

  if (up) {
    return {
      [`@media (min-width: ${upDeviceSize + 1}px)`]: { display: "none" }
    };
  }

  if (down) {
    return {
      [`@media (max-width: ${downDeviceSize}px)`]: { display: "none" }
    };
  }

  return { display: "none" };
};

const StyledHidden = styled.div.withConfig({
  shouldForwardProp: (prop: string) => isValidProp(prop) && !["up", "down"].includes(prop)
})<HiddenProps>`
  ${({ up, down }) => generateMediaQuery(up, down)}
  ${compose(space, flex)}
`;

const Hidden = memo(function ({ children, ...props }: HiddenProps) {
  return <StyledHidden {...props}>{children}</StyledHidden>;
});

export default Hidden;
