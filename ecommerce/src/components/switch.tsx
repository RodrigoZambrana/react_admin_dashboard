"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import styled from "styled-components";
import { isValidProp } from "@utils/utils";

type SwitchSize = "small" | "medium";

export interface SwitcherProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  size?: SwitchSize;
}

const SwitchTrack = styled.span.withConfig({
  shouldForwardProp: isValidProp,
})<{
  $checked: boolean;
  $disabled?: boolean;
  $size: SwitchSize;
}>`
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: ${({ theme, $checked, $disabled }) => {
    if ($disabled) {
      return theme.colors.gray[300];
    }
    return $checked ? theme.colors.primary.main : theme.colors.gray[400];
  }};
  transition: background 0.2s ease;
  position: relative;
  display: block;
`;

const SwitchThumb = styled.span.withConfig({
  shouldForwardProp: isValidProp,
})<{
  $checked: boolean;
  $size: SwitchSize;
}>`
  position: absolute;
  top: 2px;
  left: 2px;
  width: ${({ $size }) => ($size === "small" ? 16 : 20)}px;
  height: ${({ $size }) => ($size === "small" ? 16 : 20)}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gray.white};
  box-shadow: 0 2px 4px rgba(43, 52, 69, 0.25);
  transform: ${({ $checked, $size }) =>
    $checked
      ? `translateX(${($size === "small" ? 36 : 44) - ($size === "small" ? 16 : 20) - 4}px)`
      : "translateX(0)"};
  transition: transform 0.2s ease;
`;

const SwitchControl = styled.label.withConfig({
  shouldForwardProp: isValidProp,
})<{
  $disabled?: boolean;
  $size: SwitchSize;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => ($size === "small" ? 36 : 44)}px;
  height: ${({ $size }) => ($size === "small" ? 20 : 24)}px;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  user-select: none;
  transition: opacity 0.2s ease;

  ${({ $disabled }) => ($disabled ? "opacity: 0.6;" : "")}

  &:focus-within ${SwitchTrack} {
    box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.25);
  }
`;

const SwitchInput = styled.input.attrs({ type: "checkbox" })`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  margin: 0;
  cursor: inherit;
`;

const Switcher = forwardRef<HTMLInputElement, SwitcherProps>((props, ref) => {
  const {
    className,
    checked,
    defaultChecked,
    disabled,
    onChange,
    size = "medium",
    ...rest
  } = props;

  const isControlled = useMemo(() => typeof checked === "boolean", [checked]);
  const [internalChecked, setInternalChecked] = useState<boolean>(
    Boolean(defaultChecked),
  );

  useEffect(() => {
    if (!isControlled && typeof defaultChecked === "boolean") {
      setInternalChecked(defaultChecked);
    }
  }, [defaultChecked, isControlled]);

  const currentChecked = isControlled ? Boolean(checked) : internalChecked;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      const nextChecked = event.target.checked;
      if (!isControlled) {
        setInternalChecked(nextChecked);
      }
      onChange?.(nextChecked, event);
    },
    [disabled, isControlled, onChange],
  );

  return (
    <SwitchControl
      className={className}
      $disabled={disabled}
      $size={size}
      role="switch"
      aria-checked={currentChecked}
      aria-disabled={disabled}
    >
      <SwitchInput
        ref={ref}
        checked={isControlled ? checked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        disabled={disabled}
        onChange={handleChange}
        {...rest}
      />
      <SwitchTrack $checked={currentChecked} $disabled={disabled} $size={size}>
        <SwitchThumb $checked={currentChecked} $size={size} />
      </SwitchTrack>
    </SwitchControl>
  );
});

Switcher.displayName = "Switcher";

export default Switcher;
