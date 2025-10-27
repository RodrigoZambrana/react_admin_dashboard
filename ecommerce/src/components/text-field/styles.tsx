import { InputHTMLAttributes } from "react";
import styled from "styled-components";
import { color, compose, space, SpaceProps } from "styled-system";
import { convertHexToRGB, isValidProp } from "@utils/utils";
import { TextFieldProps } from "./index";

export const StyledTextField = styled.input.withConfig({
  shouldForwardProp: isValidProp
})<InputHTMLAttributes<HTMLInputElement> & TextFieldProps>(
  ({ fullWidth, errorText, theme }) => ({
    height: "40px",
    borderRadius: 8,
    fontSize: "inherit",
    padding: "8px 12px",
    color: "body.text",
    border: "1px solid",
    outline: "none",
    fontFamily: "inherit",
    width: fullWidth ? "100%" : "inherit",
    borderColor: Boolean(errorText) ? theme.colors.primary.main : theme.colors.text.disabled,
    "&:hover": { borderColor: theme.colors.gray[500] },
    "&:focus": {
      borderColor: theme.colors.primary.main,
      outlineColor: theme.colors.primary.main,
      boxShadow: `1px 1px 8px 4px rgba(${convertHexToRGB(theme.colors.primary.light)}, 0.1)`
    }
  }),
  compose(color)
);

export const TextFieldWrapper = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<TextFieldProps & SpaceProps>(
  ({ fullWidth, theme }) => ({
    position: "relative",
    width: fullWidth ? "100%" : "inherit",
    label: {
      fontWeight: 500,
      display: "block",
      marginBottom: "6px",
      fontSize: "0.875rem"
    },
    small: {
      display: "block",
      marginTop: "0.25rem",
      marginLeft: "0.75rem",
      color: theme.colors.error.main
    },
    ".end-adornment": {
      top: "50%",
      right: "0.25rem",
      position: "absolute",
      transform: "translateY(-50%)"
    },
    ".relative": {
      position: "relative",
      width: fullWidth ? "100%" : "inherit"
    }
  }),
  compose(color, space)
);
