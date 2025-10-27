import { colorOptions } from "interfaces";

export interface IconProps {
  size?: string;
  transform?: string;
  color?: colorOptions;
  variant?: "small" | "medium" | "large";
  defaultColor?: "currentColor" | "auto";
}
