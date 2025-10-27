import { color, compose, space } from "styled-system";
import styled from "styled-components";
import { RadioProps, WrapperProps } from "./index";

export const StyledRadio = styled.input<RadioProps>`
  appearance: none;
  outline: none;
  cursor: pointer;
  margin: 0;
  width: 20px;
  height: 20px;
  border-radius: 20px;
  border: 2px solid;
  border-color: ${({ disabled, theme }) =>
    disabled ? theme.colors.text.disabled : theme.colors.text.hint};
  position: relative;

  &:checked {
    border-color: ${({ disabled, color, theme }) =>
      disabled ? theme.colors.text.disabled : theme.colors[color || "secondary"].main};
  }

  &:after {
    content: "";
    position: absolute;
    width: calc(100% - 6px);
    height: calc(100% - 6px);
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
    border-radius: 50%;
    background: transparent;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  }

  &:checked:after {
    background: ${({ disabled, color, theme }) =>
      disabled ? theme.colors.text.disabled : theme.colors[color || "secondary"].main};
  }

  ${compose(color)}
`;

export const Wrapper = styled.div<WrapperProps>`
  display: flex;
  align-items: center;
  flex-direction: ${({ labelPlacement }) => (labelPlacement !== "end" ? "row" : "row-reverse")};
  gap: 0.5rem;

  label {
    cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
    color: ${({ $disabled, theme }) => ($disabled ? theme.colors.text.disabled : "inherit")};
  }

  ${color}
  ${space}
`;
