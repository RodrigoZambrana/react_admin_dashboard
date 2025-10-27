"use client";

import { ComponentPropsWithRef } from "react";
import { SpaceProps, ColorProps, LayoutProps, BorderProps, BackgroundProps } from "styled-system";
import { colorOptions } from "interfaces";
import { StyledButton } from "./styles";

// ==============================================================
type ButtonSize = "small" | "medium" | "large" | "none";
type ButtonVariant = "text" | "outlined" | "contained";

interface ButtonBaseProps {
  size?: ButtonSize;
  fullWidth?: boolean;
  color?: colorOptions;
  variant?: ButtonVariant;
}

export type StyledButtonProps = ColorProps &
  BackgroundProps &
  BorderProps &
  SpaceProps &
  LayoutProps &
  ButtonBaseProps;

export type ButtonProps = StyledButtonProps &
  Omit<ComponentPropsWithRef<"button">, "color"> & {
    as?: string | React.ComponentType<any>;
  };

// ==============================================================

export default function Button({
  ref,
  children,
  size = "small",
  fullWidth = false,
  color = "primary",
  variant = "contained",
  ...props
}: ButtonProps) {
  return (
    <StyledButton
      ref={ref}
      size={size}
      color={color}
      variant={variant}
      fullWidth={fullWidth}
      {...props}>
      {children}
    </StyledButton>
  );
}
