import { color, space, border, layout, shadow, compose, variant } from "styled-system";
import styled from "styled-components";
import { isValidProp } from "@utils/utils";
import { StyledButtonProps } from "./Button";

export const StyledButton = styled.button.withConfig({
  shouldForwardProp: isValidProp
})<StyledButtonProps>(
  ({ color, fullWidth, size, theme }) => ({
    display: "flex",
    width: fullWidth ? "100%" : "unset",
    justifyContent: "center",
    alignItems: "center",
    outline: "none",
    border: "none",
    cursor: "pointer",
    padding: "11px 1.5rem",
    fontSize: "1rem",
    fontWeight: 600,
    fontFamily: "inherit",
    color: color ? theme.colors[color].main : theme.colors.body.text,
    backgroundColor: "transparent",
    transition: "all 150ms ease-in-out",
    lineHeight: 1,
    "&:disabled": {
      cursor: "unset",
      color: theme.colors.text.hint,
      borderColor: theme.colors.text.disabled,
      backgroundColor: theme.colors.text.disabled,
      "svg path": { fill: theme.colors.text.hint },
      "svg polyline, svg polygon": { color: theme.colors.text.hint }
    },
    ...(size === "large" && { height: "56px", px: 30, borderRadius: "1rem" }),
    ...(size === "medium" && { height: "48px", px: 30, borderRadius: "0.75rem" }),
    ...(size === "small" && { height: "40px", fontSize: 14, borderRadius: "0.5rem" }),
    ...(size === "none" && { height: "unset", px: 0, borderRadius: "0.3rem" })
  }),
  ({ theme, color }) =>
    variant({
      prop: "variant",
      variants: {
        text: {
          border: "none",
          color: `${color}.main`,
          "&:hover": { bg: color ? `${color}.light` : "gray.100" }
        },
        outlined: {
          padding: "10px 16px",
          color: `${color}.main`,
          border: "1px solid",
          borderColor: color ? `${color}.main` : "text.disabled",
          "&:enabled svg path": {
            fill: color ? `${theme.colors[color]?.main} !important` : "text.primary"
          },
          "&:enabled svg polyline, svg polygon": {
            color: color ? `${theme.colors[color]?.main} !important` : "text.primary"
          },
          "&:focus": {
            boxShadow: `0px 1px 4px 0px ${theme.colors[color ? color : ""]?.light}`
          },
          "&:hover:enabled": {
            bg: color && `${color}.main`,
            borderColor: color && `${color}.main`,
            color: color && `${color}.text`,
            "svg path": {
              fill: color ? `${theme.colors[color]?.text} !important` : "text.primary"
            },
            "svg polyline, svg polygon": {
              color: color ? `${theme.colors[color]?.text} !important` : "text.primary"
            },
            ...(color === "dark" && { color: "white" })
          }
        },
        contained: {
          border: "none",
          color: `${color}.text`,
          bg: `${color}.main`,
          "&:focus": {
            boxShadow: `0px 1px 4px 0px ${theme.colors[color ? color : ""]?.light}`
          },
          "&:enabled svg path": {
            fill: color ? `${theme.colors[color]?.text} !important` : "text.primary"
          },
          "&:enabled svg polyline, svg polygon": {
            color: color ? `${theme.colors[color]?.text} !important` : "text.primary"
          }
        }
      }
    }),
  compose(color, layout, space, border, shadow)
);
