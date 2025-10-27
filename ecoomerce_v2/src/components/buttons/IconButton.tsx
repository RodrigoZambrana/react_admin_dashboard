"use client";

import {
  color,
  space,
  border,
  layout,
  shadow,
  compose,
  variant,
  ColorProps,
  SpaceProps,
  BorderProps,
  BackgroundProps
} from "styled-system";
import { ComponentPropsWithRef } from "react";
import styled from "styled-components";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface IconButtonProps {
  size?: "small" | "medium" | "large" | "none";
  variant?: "text" | "outlined" | "contained";
  color?: "primary" | "secondary" | "error" | "default" | string;
}

type Props = ColorProps & BackgroundProps & BorderProps & SpaceProps & IconButtonProps;
// ==============================================================

const StyledIconButton = styled.button.withConfig({
  shouldForwardProp: isValidProp
})<Props>(
  ({ theme }) => ({
    flex: "0 0 auto",
    border: "none",
    outline: "none",
    lineHeight: 1,
    cursor: "pointer",
    textAlign: "center",
    borderRadius: "50%",
    padding: "1rem",
    fontWeight: 600,
    color: "inherit",
    backgroundColor: theme.colors.body.paper,
    "&:hover": { backgroundColor: theme.colors.gray[200] },
    transition: "all 150ms ease-in-out",
    "&:disabled": {
      color: theme.colors.text.muted,
      backgroundColor: theme.colors.text.disabled
    }
  }),
  (props) =>
    variant({
      prop: "variant",
      variants: {
        text: { border: "none", color: `${props.color}.main` },
        outlined: {
          color: `${props.color}.main`,
          border: "2px solid",
          borderColor: `${props.color}.main`,
          "&:focus": {
            boxShadow: `0px 1px 4px 0px ${props.theme.colors[props.color as any]?.main}`
          }
        },
        contained: {
          border: "none",
          bg: `${props.color}.main`,
          color: `${props.color}.text`,
          "&:hover": { bg: `${props.color}.main` },
          "&:focus": {
            boxShadow: `0px 1px 4px 0px ${props.theme.colors[props.color as any]?.main}`
          }
        }
      }
    }),
  variant({
    prop: "size",
    variants: {
      medium: { padding: "1rem" },
      large: { padding: "1.25rem" },
      small: { padding: "0.75rem" }
    }
  }),
  compose(color, layout, space, border, shadow)
);

// ==============================================================
interface BtnProps extends Props, Omit<ComponentPropsWithRef<"button">, "color"> {
  as?: string | React.ComponentType<any>;
}
// ==============================================================

export default function IconButton({ ref, children, size = "small", ...props }: BtnProps) {
  return (
    <StyledIconButton ref={ref} size={size} {...props}>
      {children}
    </StyledIconButton>
  );
}
