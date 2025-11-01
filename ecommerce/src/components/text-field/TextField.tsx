"use client";

import { cloneElement, InputHTMLAttributes, useMemo, JSX } from "react";
import { SpaceProps } from "styled-system";
import { colorOptions } from "interfaces";
import { StyledTextField, TextFieldWrapper } from "./styles";
import { useTranslation } from "@/state/i18n-context";

// ==============================================================
type SpacingKey = `${"m" | "p"}${string}`;
type SpacingProps = Partial<Record<SpacingKey, any>>;

const isSpacingPropKey = (key: string): boolean => {
  if (key === "m" || key === "p") return true;
  if (/^(m|p)[trblxy]$/.test(key)) return true;
  if (key.startsWith("margin") || key.startsWith("padding")) return true;
  return false;
};

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
  const t = useTranslation();

  const { placeholder, ...restProps } = props;

  const spacingProps = useMemo(() => {
    return Object.entries(restProps).reduce<SpacingProps>((acc, [key, value]) => {
      if (isSpacingPropKey(key)) {
        acc[key as SpacingKey] = value;
      }
      return acc;
    }, {});
  }, [restProps]);

  const inputProps = useMemo(() => {
    return Object.entries(restProps).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (!isSpacingPropKey(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );
  }, [restProps]);

  if (placeholder !== undefined) {
    inputProps.placeholder =
      typeof placeholder === "string" ? t(placeholder) : placeholder;
  }

  const normalizedErrorText =
    typeof errorText === "string" ? errorText : errorText ? String(errorText) : undefined;
  const translatedErrorText = normalizedErrorText ? t(normalizedErrorText) : undefined;

  const translatedLabel = typeof label === "string" ? t(label) : label;

  return (
    <TextFieldWrapper
      color={color || (labelColor && `${labelColor}.main`)}
      fullWidth={fullWidth}
      {...spacingProps}>
      {translatedLabel && <label htmlFor={id}>{translatedLabel}</label>}

      <div className="relative">
        <StyledTextField
          id={id}
          errorText={normalizedErrorText}
          fullWidth={fullWidth}
          {...(inputProps as InputHTMLAttributes<HTMLInputElement>)}
        />

        {endAdornment &&
          cloneElement(endAdornment, {
            className: `end-adornment ${endAdornment.props.className || ""}`
          })}
      </div>

      {translatedErrorText && <small>{translatedErrorText}</small>}
    </TextFieldWrapper>
  );
}
