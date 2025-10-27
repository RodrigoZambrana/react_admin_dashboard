"use client";

import { ComponentPropsWithRef } from "react";
import { ReactSVG } from "react-svg";
import { SpaceProps } from "styled-system";

import { StyledCircleProgress, StyledSvgWrapper } from "./styles";
import { IconProps } from "./types";

// ==============================================================
type Props = SpaceProps & ComponentPropsWithRef<"div"> & IconProps;
// ==============================================================

export default function Icon({
  ref,
  children,
  variant = "medium",
  defaultColor = "currentColor",
  ...others
}: Props) {
  if (typeof children !== "string") return null;

  return (
    <StyledSvgWrapper ref={ref} variant={variant} defaultColor={defaultColor} {...others}>
      <ReactSVG
        src={`/assets/images/icons/${children}.svg`}
        loading={() => <StyledCircleProgress />}
      />
    </StyledSvgWrapper>
  );
}
