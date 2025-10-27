"use client";

import { cloneElement, InputHTMLAttributes, useMemo, JSX } from "react";
import { SpaceProps } from "styled-system";
import { colorOptions } from "interfaces";
import { StyledTextField, TextFieldWrapper } from "./styles";

// ==============================================================
type SpacingKey = `${"m" | "p"}${string}`;
type SpacingProps = Partial<Record<SpacingKey, any>>;

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement>, SpaceProps {
  id?: string;
  label?: string;
  color?: string;
  errorText?: string;
  fullWidth?: boolean;
  labelColor?: colorOptions;
  endAdornment?: JSX.Element;
}
// ==============================================================

export default function TextField({
  id,
  label,
  errorText,
  labelColor,
  endAdornment,
  color = "default",
  fullWidth,
  ...props
}: TextFieldProps) {
  const spacingProps = useMemo(() => {
    return Object.entries(props).reduce<SpacingProps>((acc, [key, value]) => {
      if (key.startsWith("m") || key.startsWith("p")) {
        acc[key as SpacingKey] = value;
      }
      return acc;
    }, {});
  }, [props]);

  return (
    <TextFieldWrapper
      color={color || (labelColor && `${labelColor}.main`)}
      fullWidth={fullWidth}
      {...spacingProps}>
      {label && <label htmlFor={id}>{label}</label>}

      <div className="relative">
        <StyledTextField id={id} errorText={errorText} {...props} />

        {endAdornment &&
          cloneElement(endAdornment, {
            className: `end-adornment ${endAdornment.props.className || ""}`
          })}
      </div>

      {errorText && <small>{errorText}</small>}
    </TextFieldWrapper>
  );
}
