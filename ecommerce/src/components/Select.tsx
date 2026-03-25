"use client";

import { useEffect, useMemo, useState, memo, useId } from "react";
import { useTheme } from "styled-components";
import { SpaceProps } from "styled-system";
import ReactSelect, { Props, Theme } from "react-select";
import Box from "@component/Box";
import Typography from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";

interface SelectProps extends Omit<Props, "theme">, SpaceProps {
  label?: string;
  isMulti?: boolean;
  errorText?: string;
}

const styles = (errorText?: string) =>
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
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 1600
    }),
    menu: (base) => ({
      ...base,
      zIndex: 1600
    })
  } as Props["styles"]);

const SelectBase = ({
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
  const t = useTranslation();
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

  const testId = useMemo(() => {
    const value = (restProps as Record<string, unknown>)["data-testid"];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }, [restProps]);

  const baseSelectProps = useMemo(() => {
    const result = { ...(restProps as Record<string, unknown>) };
    Object.keys(result).forEach((key) => {
      if (key.startsWith("m") || key.startsWith("p")) {
        delete result[key];
      }
    });
    delete result["data-testid"];
    if (typeof result.placeholder === "string") {
      result.placeholder = t(result.placeholder);
    }

    const translateMessage = <T extends unknown>(
      message: unknown
    ): typeof message => {
      if (typeof message === "function") {
        return ((arg: T) => {
          const value = (message as (input: T) => unknown)(arg);
          return typeof value === "string" ? t(value) : value;
        }) as typeof message;
      }
      if (typeof message === "string") {
        return t(message) as typeof message;
      }
      return message;
    };

    if ("noOptionsMessage" in result && result.noOptionsMessage != null) {
      result.noOptionsMessage = translateMessage(result.noOptionsMessage);
    }
    if ("loadingMessage" in result && result.loadingMessage != null) {
      result.loadingMessage = translateMessage(result.loadingMessage);
    }
    return result;
  }, [restProps, t]);

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

  const menuPortalTarget = isMounted ? document.body : undefined;

  return (
    <Box {...(spacingProps as SpaceProps)} data-testid={testId}>
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
          menuPortalTarget={menuPortalTarget}
          menuPosition="fixed"
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
  };

SelectBase.displayName = "Select";

const Select = memo(SelectBase);
Select.displayName = "Select";

export default Select;
