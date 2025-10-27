import { InputHTMLAttributes, useId } from "react";
import styled from "styled-components";
import { color, compose, space, SpaceProps } from "styled-system";
import { colorOptions } from "../interfaces";
import { isValidProp } from "@utils/utils";

// ==============================================================
interface CheckBoxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "color" | "size">,
    SpaceProps {
  size?: number;
  color?: colorOptions;
  labelColor?: colorOptions;
  label?: React.ReactNode;
  labelPlacement?: "start" | "end";
  ref?: React.Ref<HTMLInputElement>;
}

interface WrapperProps extends SpaceProps {
  labelPlacement?: "start" | "end";
  $disabled?: boolean;
}
// ==============================================================

const StyledCheckBox = styled.input.withConfig({
  shouldForwardProp: isValidProp
})<CheckBoxProps>`
  appearance: none;
  outline: none;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  margin: 0;
  width: ${({ size }) => size || 18}px;
  height: ${({ size }) => size || 18}px;
  border: 2px solid;
  border-color: ${({ disabled, theme }) =>
    disabled ? theme.colors.text.disabled : theme.colors.text.hint};
  border-radius: 2px;
  position: relative;
  &:checked {
    border-color: ${({ disabled, color, theme }) =>
      disabled ? theme.colors.text.disabled : theme.colors[color || "secondary"].main};
  }
  &:after {
    content: "";
    position: absolute;
    width: calc(100% - 5px);
    height: calc(100% - 5px);
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
    background: transparent;
    border-radius: 1px;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }
  &:checked:after {
    background: ${({ disabled, color, theme }) =>
      disabled ? theme.colors.text.disabled : theme.colors[color || "secondary"].main};
  }
  ${compose(color)}
`;

const Wrapper = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<WrapperProps>`
  display: flex;
  align-items: center;
  flex-direction: ${({ labelPlacement }) => (labelPlacement !== "end" ? "row" : "row-reverse")};
  gap: 0.5rem;
  label {
    cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
    color: ${({ $disabled, theme }) => ($disabled ? theme.colors.text.disabled : "inherit")};
  }
  ${compose(color, space)}
`;

const CheckBox = ({
  ref,
  label,
  disabled,
  id: externalId,
  size = 18,
  color = "secondary",
  labelPlacement = "start",
  labelColor = "secondary",
  ...props
}: CheckBoxProps) => {
  const id = useId();
  const checkboxId = externalId || id;

  const spacingProps = Object.entries(props).reduce((acc, [key, value]) => {
    if (key.startsWith("m") || key.startsWith("p")) {
      acc[key] = value;
    }

    return acc;
  }, {} as Record<string, unknown>);

  return (
    <Wrapper
      labelPlacement={labelPlacement}
      color={`${labelColor}.main`}
      $disabled={disabled}
      {...spacingProps}>
      <StyledCheckBox
        id={checkboxId}
        type="checkbox"
        ref={ref}
        disabled={disabled}
        color={color}
        size={size}
        {...props}
      />
      {label && <label htmlFor={checkboxId}>{label}</label>}
    </Wrapper>
  );
};

export default CheckBox;
