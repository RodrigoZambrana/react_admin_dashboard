import { InputHTMLAttributes } from "react";
import styled from "styled-components";
import { border, color, ColorProps, compose, space, SpaceProps } from "styled-system";
import { convertHexToRGB, isValidProp } from "@utils/utils";

interface Props extends SpaceProps, ColorProps {
  fullWidth?: boolean;
  errorText?: string;
}

export const StyledTextArea = styled.textarea.withConfig({
  shouldForwardProp: isValidProp
})<InputHTMLAttributes<HTMLInputElement> & Props>(
  ({ fullWidth, theme, errorText }) => ({
    display: "block",
    padding: "1rem",
    minHeight: "40px",
    fontSize: "inherit",
    color: "body.text",
    borderRadius: 8,
    border: "1px solid",
    borderColor: errorText ? theme.colors.error.main : theme.colors.text.disabled,
    width: fullWidth ? "100%" : "inherit",
    outline: "none",
    overflow: "auto",
    fontFamily: "inherit",
    appearance: "none",
    resize: "none",
    "&:hover": { borderColor: theme.colors.gray[500] },
    "&:focus": {
      borderColor: theme.colors.primary.main,
      outlineColor: theme.colors.primary.main,
      boxShadow: `1px 1px 8px 4px rgba(${convertHexToRGB(theme.colors.primary.light)}, 0.1)`
    }
  }),
  compose(color, border)
);

export const TextAreaWrapper = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<Props>(
  ({ fullWidth, theme }) => ({
    width: fullWidth ? "100%" : "inherit",
    "& label": {
      display: "block",
      marginBottom: "0.5rem",
      fontSize: "0.875rem",
      fontWeight: "500"
    },
    "& small": {
      display: "block",
      marginTop: "0.25rem",
      marginLeft: "0.75rem",
      color: theme.colors.error.main
    }
  }),
  compose(color, space)
);
