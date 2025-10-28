"use client";

import { useEffect, useMemo, useState, memo, useId } from "react";
import { useTheme } from "styled-components";
import { SpaceProps } from "styled-system";
import ReactSelect, { Props, Theme } from "react-select";
import Box from "@component/Box";
import Typography from "@component/Typography";

interface SelectProps extends Omit<Props, "theme">, SpaceProps {
  label?: string;
  isMulti?: boolean;
  errorText?: string;
}

const styles = (errorText: string) =>
  ({
    control: (base, state) => ({
      ...base,
      borderRadius: 8,
      cursor: "pointer",
      ...(errorText && {
        borderColor: state.theme.colors.primary
      })
    }),
    option: (styles, state) => ({
      ...styles,
      color: "inherit",
      cursor: "pointer",
      backgroundColor: state.isFocused ? "rgba(0,0,0, 0.015)" : "inherit"
    })
  } as Props["styles"]);

const Select = memo(
  ({
    options,
    isMulti = false,
    id,
    label,
    errorText,
    inputId: providedInputId,
    instanceId: providedInstanceId,
    ...restProps
  }: SelectProps) => {
  const { colors } = useTheme();
  const autoId = useId();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const selectTheme = (theme: Theme) => ({
    ...theme,
    colors: {
      ...theme.colors,
      primary50: colors.gray[100],
      primary: colors.primary.main,
      neutral20: colors.text.disabled
    }
  });
  const computedIds = useMemo(() => {
    const resolvedInstance = providedInstanceId ?? id ?? `select-${autoId}`;
    return {
      instance: resolvedInstance,
      input: providedInputId ?? `${resolvedInstance}-input`,
      label: label ? `${resolvedInstance}-label` : undefined
    };
  }, [autoId, id, label, providedInputId, providedInstanceId]);

  const spacingProps = useMemo(() => {
    const spacing: Record<string, unknown> = {};
    Object.entries(restProps as Record<string, unknown>).forEach(([key, value]) => {
      if (key.startsWith("m") || key.startsWith("p")) {
        spacing[key] = value;
      }
    });
    return spacing;
  }, [restProps]);

  const baseSelectProps = useMemo(() => {
    const result = { ...(restProps as Record<string, unknown>) };
    Object.keys(result).forEach((key) => {
      if (key.startsWith("m") || key.startsWith("p")) {
        delete result[key];
      }
    });
    return result;
  }, [restProps]);

  const selectProps = useMemo(() => {
    if (!computedIds.label) {
      return baseSelectProps;
    }
    const existing = baseSelectProps["aria-labelledby"] as string | undefined;
    if (existing === computedIds.label) {
      return baseSelectProps;
    }
    return {
      ...baseSelectProps,
      "aria-labelledby": existing ?? computedIds.label
    };
  }, [baseSelectProps, computedIds.label]);

  const fallbackPlaceholder =
    typeof (baseSelectProps as Props).placeholder === "string"
      ? (baseSelectProps as Props).placeholder
      : "";

  return (
    <Box {...(spacingProps as SpaceProps)}>
      {label && (
        <Typography id={computedIds.label} fontSize="0.875rem" mb="6px" fontWeight={500}>
          {label}
        </Typography>
      )}

      {isMounted ? (
        <ReactSelect
          isMulti={isMulti}
          options={options}
          theme={selectTheme}
          styles={styles(errorText)}
          instanceId={computedIds.instance}
          inputId={computedIds.input}
          {...(selectProps as Props)}
        />
      ) : (
        <Box
          aria-hidden="true"
          border="1px solid"
          borderColor={errorText ? "primary.main" : "gray.300"}
          borderRadius="8px"
          color="text.disabled"
          display="flex"
          alignItems="center"
          minHeight="40px"
          px="0.75rem"
        >
          {fallbackPlaceholder}
        </Box>
      )}

      {errorText && (
        <Typography as="small" color="error.main" ml="0.75rem" mt="0.25rem">
          {errorText}
        </Typography>
      )}
    </Box>
  );
  }
);

export default Select;
