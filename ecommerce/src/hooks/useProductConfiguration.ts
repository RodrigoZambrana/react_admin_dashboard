import { useMemo } from "react";

import type { CanonicalConfiguration } from "@/types/storefront";

type ProductConfigurationState = {
  specifications: Array<{ label: string; value: string }>;
  configuration: Record<string, unknown>;
} | null;

type UseProductConfigurationInput = {
  productTitle: string;
  canonicalConfiguration?: CanonicalConfiguration | null;
  selectedConfiguration?: ProductConfigurationState;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const matchesCanonicalRules = (rules: Record<string, unknown>, candidate: Record<string, unknown>) =>
  Object.entries(rules).every(([key, expected]) => {
    const actual = candidate[key];
    if (isPlainObject(expected) && isPlainObject(actual)) {
      return matchesCanonicalRules(expected, actual);
    }
    if (Array.isArray(expected) && Array.isArray(actual)) {
      return expected.length === actual.length && expected.every((item, index) => item === actual[index]);
    }
    return actual === expected;
  });

export const useProductConfiguration = ({
  productTitle,
  canonicalConfiguration,
  selectedConfiguration,
}: UseProductConfigurationInput) =>
  useMemo(() => {
    const canonicalRules = canonicalConfiguration?.configurationRules ?? null;
    const selectedConfigurationState = selectedConfiguration?.configuration ?? null;
    const currentConfiguration = isPlainObject(selectedConfigurationState)
      ? selectedConfigurationState
      : canonicalRules ?? null;
    const canonicalRulesObject = isPlainObject(canonicalRules) ? canonicalRules : null;
    const currentConfigurationObject = isPlainObject(currentConfiguration) ? currentConfiguration : null;
    const isCanonicalActive =
      Boolean(canonicalConfiguration && canonicalRulesObject && currentConfigurationObject) &&
      matchesCanonicalRules(
        canonicalRulesObject as Record<string, unknown>,
        currentConfigurationObject as Record<string, unknown>,
      );

    const displayTitle = productTitle;

    const configurationLabel = canonicalConfiguration
      ? isCanonicalActive
        ? `Configuración: ${productTitle}`
        : `Configuración: ${canonicalConfiguration.baseLabel?.trim() || productTitle}`
      : null;

    const configurationDescription =
      isCanonicalActive && canonicalConfiguration?.baseLabel
        ? `${productTitle} (${canonicalConfiguration.baseLabel})`
        : canonicalConfiguration?.baseLabel ?? null;

    return {
      displayTitle,
      configurationLabel,
      configurationDescription,
      isCanonicalActive,
    };
  }, [canonicalConfiguration, productTitle, selectedConfiguration]);
