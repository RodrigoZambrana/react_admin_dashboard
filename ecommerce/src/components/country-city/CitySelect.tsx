"use client";

import { useMemo } from "react";
import Select from "@component/Select";

import { deriveCountryCode, useCountryCityData } from "@/lib/country-city";

interface CitySelectProps {
  countryCode?: string;
  countryName?: string;
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
  label?: string;
  isDisabled?: boolean;
  errorText?: string;
}

export default function CitySelect({
  countryCode,
  countryName,
  value,
  onChange,
  placeholder = "Select a city",
  label,
  isDisabled,
  errorText
}: CitySelectProps) {
  const { countries, getCitiesForCountry, loading, error } = useCountryCityData();

  const resolvedCountryName = useMemo(() => {
    if (countryName && countryName.trim()) return countryName;
    if (!countryCode) return undefined;
    const match = countries.find(
      (candidate) => deriveCountryCode(candidate).toLowerCase() === countryCode.toLowerCase()
    );
    return match;
  }, [countries, countryCode, countryName]);

  const cities = useMemo(() => {
    if (!resolvedCountryName) return [];
    return getCitiesForCountry(resolvedCountryName);
  }, [getCitiesForCountry, resolvedCountryName]);

  const options = useMemo(() => {
    return cities.map((city) => ({
      value: city,
      label: city
    }));
  }, [cities]);

  const resolvedValue = useMemo(() => {
    if (!value) {
      return null;
    }
    return {
      value,
      label: value
    };
  }, [value]);

  const disabled = Boolean(isDisabled || loading || !!error || !resolvedCountryName || cities.length === 0);

  const placeholderText = (() => {
    if (loading) return "Loading cities...";
    if (error) return "Failed to load cities";
    if (!resolvedCountryName) return placeholder;
    if (cities.length === 0) return "No cities available";
    return placeholder;
  })();

  return (
    <Select
      label={label}
      options={options}
      placeholder={placeholderText}
      isDisabled={disabled}
      isSearchable
      value={resolvedValue}
      errorText={errorText}
      isClearable
      onChange={(option: any) => {
        const choice = Array.isArray(option) ? option[0] : option;
        if (!choice) {
          onChange(undefined);
          return;
        }
        const selectedCity = typeof choice.value === "string" ? choice.value : undefined;
        onChange(selectedCity);
      }}
    />
  );
}
