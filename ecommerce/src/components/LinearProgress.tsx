import styled, { CSSProperties } from "styled-components";
import { colorOptions } from "interfaces";
import { isValidProp } from "@utils/utils";

// STYLED COMPONENT
const StyledLinearProgress = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<LinearProgressProps>`
  display: flex;
  overflow: hidden;
  position: relative;
  height: ${({ thickness }) => thickness}px;
  border-radius: ${({ thickness }) => thickness}px;
  background-color: ${({ theme }) => theme.colors.text.hint};
  &:after {
    top: 0;
    bottom: 0;
    content: "";
    position: absolute;
    width: ${({ value }) => value}%;
    background-color: ${({ color, theme }) => theme.colors[color].main};
  }
`;

// ==============================================================
interface LinearProgressProps {
  value?: number;
  thickness?: number;
  color?: colorOptions;
  style?: CSSProperties;
  variant?: "determinate" | "indeterminate";
}
// ==============================================================

export default function LinearProgress({
  value = 75,
  thickness = 6,
  color = "primary",
  variant = "determinate",
  ...props
}: LinearProgressProps) {
  return (
    <StyledLinearProgress
      color={color}
      value={value}
      variant={variant}
      thickness={thickness}
      {...props}
    />
  );
}
