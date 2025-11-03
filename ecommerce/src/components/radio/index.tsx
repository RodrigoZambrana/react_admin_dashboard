import { InputHTMLAttributes, ReactNode, Ref, useId } from "react";
import { ColorProps, SpaceProps } from "styled-system";
import { colorOptions } from "interfaces";
import { StyledRadio, Wrapper } from "./styles";

// ==============================================================
export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "color">,
    SpaceProps {
  color?: colorOptions;
  labelColor?: colorOptions;
  labelPlacement?: "start" | "end";
  label?: string | ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export interface WrapperProps extends ColorProps, SpaceProps {
  $labelPlacement?: "start" | "end";
  $disabled?: boolean;
}
// ==============================================================

const Radio = ({
  ref,
  label,
  disabled,
  labelColor,
  id: externalId,
  color = "secondary",
  labelPlacement = "start",
  ...props
}: RadioProps) => {
  const internalId = useId();
  const id = externalId || internalId;

  const spacingProps: Partial<SpaceProps> = {};
  const inputProps: Record<string, unknown> = {};

  Object.entries(props as Record<string, unknown>).forEach(([key, value]) => {
    if (/^(m|p)(t|r|b|l|x|y)?$|^(margin|padding)/i.test(key)) {
      spacingProps[key as keyof SpaceProps] = value as never;
    } else {
      inputProps[key] = value;
    }
  });

  return (
    <Wrapper
      $disabled={disabled}
      $labelPlacement={labelPlacement}
      color={labelColor ? `${labelColor}.main` : undefined}
      {...spacingProps}>
      <StyledRadio
        id={id}
        type="radio"
        ref={ref}
        disabled={disabled}
        color={color}
        {...(inputProps as Omit<RadioProps, keyof SpaceProps>)}
      />
      {label && <label htmlFor={id}>{label}</label>}
    </Wrapper>
  );
};

export default Radio;
