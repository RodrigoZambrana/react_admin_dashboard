import { InputHTMLAttributes, useId } from "react";
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
  label?: string | React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export interface WrapperProps extends ColorProps, SpaceProps {
  labelPlacement?: "start" | "end";
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

  const spacingProps = Object.entries(props).reduce((acc, [key, value]) => {
    if (key.startsWith("m") || key.startsWith("p")) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);

  return (
    <Wrapper
      $disabled={disabled}
      labelPlacement={labelPlacement}
      color={labelColor ? `${labelColor}.main` : undefined}
      {...spacingProps}>
      <StyledRadio id={id} type="radio" ref={ref} disabled={disabled} color={color} {...props} />
      {label && <label htmlFor={id}>{label}</label>}
    </Wrapper>
  );
};

export default Radio;
