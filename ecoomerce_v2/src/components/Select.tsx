import { useMemo, memo } from "react";
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

const Select = memo(({ options, isMulti = false, id, label, errorText, ...props }: SelectProps) => {
  const { colors } = useTheme();

  const selectTheme = (theme: Theme) => ({
    ...theme,
    colors: {
      ...theme.colors,
      primary50: colors.gray[100],
      primary: colors.primary.main,
      neutral20: colors.text.disabled
    }
  });
  const spacingProps = useMemo(() => {
    const spacing = {};

    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith("m") || key.startsWith("p")) {
        spacing[key] = value;
      }
    });

    return spacing;
  }, [props]);

  return (
    <Box {...spacingProps}>
      {label && (
        <Typography fontSize="0.875rem" mb="6px" fontWeight={500}>
          {label}
        </Typography>
      )}

      <ReactSelect
        isMulti={isMulti}
        options={options}
        theme={selectTheme}
        styles={styles(errorText)}
        {...props}
      />

      {errorText && (
        <Typography as="small" color="error.main" ml="0.75rem" mt="0.25rem">
          {errorText}
        </Typography>
      )}
    </Box>
  );
});

export default Select;
