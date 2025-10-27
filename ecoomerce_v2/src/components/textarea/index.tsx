"use client";

import { memo, TextareaHTMLAttributes } from "react";
import { BorderProps, SpaceProps } from "styled-system";
import { colorOptions } from "interfaces";
import { StyledTextArea, TextAreaWrapper } from "./styles";

// ==============================================================
type SpacingKeys = keyof SpaceProps;
type OtherProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, SpacingKeys>;

interface TextAreaProps extends SpaceProps, BorderProps, OtherProps {
  id?: string;
  label?: string;
  errorText?: string;
  fullWidth?: boolean;
  labelColor?: colorOptions;
}
// ==============================================================

const extractSpacingProps = (props: Record<string, unknown>) => {
  const spacingProps: Partial<SpaceProps> = {};
  const otherProps: Record<string, unknown> = {};

  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith("m") || key.startsWith("p")) {
      spacingProps[key] = value;
    } else {
      otherProps[key] = value;
    }
  });

  return { spacingProps, otherProps };
};

const TextArea = memo(
  ({
    label,
    errorText,
    fullWidth,
    labelColor,
    placeholder,
    id = "textArea",
    color = "default",
    ...props
  }: TextAreaProps) => {
    const { spacingProps, otherProps } = extractSpacingProps(props);

    const textColor = color || (labelColor && `${labelColor}.main`);

    return (
      <TextAreaWrapper color={textColor} fullWidth={fullWidth} {...spacingProps}>
        {label && <label htmlFor={id}>{label}</label>}

        <StyledTextArea placeholder={placeholder} id={id} errorText={errorText} {...otherProps} />

        {errorText && <small role="alert">{errorText}</small>}
      </TextAreaWrapper>
    );
  }
);

export default TextArea;
