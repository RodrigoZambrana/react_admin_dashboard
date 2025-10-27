"use client";

import { useMemo } from "react";
import Select from "@component/Select";

import { deriveCountryCode, useCountryCityData } from "@/lib/country-city";

export interface CountrySelectValue {
  code?: string;
  name?: string;
}

interface CountrySelectProps {
  value?: CountrySelectValue;
  onChange: (value: CountrySelectValue) => void;
  placeholder?: string;
  label?: string;
  isDisabled?: boolean;
  errorText?: string;
}

export default function CountrySelect({
  value,
  onChange,
  placeholder = "Select a country",
  label,
  isDisabled,
  errorText
}: CountrySelectProps) {
  const { countries, loading, error } = useCountryCityData();

  const options = useMemo(() => {
    return countries.map((country) => ({
      value: country,
      label: country
    }));
  }, [countries]);

  const resolvedValue = useMemo(() => {
    const currentName = value?.name || "";
    if (!currentName) {
      return null;
    }
    return {
      value: currentName,
      label: currentName
    };
  }, [value?.name]);

  const disabled = Boolean(isDisabled || loading || !!error);

  return (
    <Select
      label={label}
      options={options}
      placeholder={loading ? "Loading countries..." : placeholder}
      isDisabled={disabled}
      isSearchable
      isClearable
      value={resolvedValue}
      errorText={errorText}
      onChange={(option: any) => {
        const choice = Array.isArray(option) ? option[0] : option;
        if (!choice) {
          onChange({});
          return;
        }
        const nextName = typeof choice.value === "string" ? choice.value : undefined;
        const next = {
          name: nextName,
          code: nextName ? deriveCountryCode(nextName) : undefined
        };
        onChange(next);
      }}
    />
  );
}
