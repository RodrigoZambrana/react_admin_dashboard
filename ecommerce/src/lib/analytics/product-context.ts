"use client";

import type { CanonicalConfiguration } from "@/types/storefront";

type CanonicalConfigurationLike = CanonicalConfiguration | null | undefined;

type ConfigurationLike = Record<string, unknown> | null | undefined;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readMatrixRowId = (configuration?: ConfigurationLike): number | null => {
  if (!isPlainObject(configuration)) {
    return null;
  }

  const candidate = configuration.matrixRowId ?? configuration.matrix_row_id ?? configuration.matrix_rowid;
  return coerceNumber(candidate);
};

export const buildCanonicalAnalyticsContext = (input: {
  canonicalConfiguration?: CanonicalConfigurationLike;
  configuration?: ConfigurationLike;
}) => {
  const canonicalConfiguration = input.canonicalConfiguration ?? null;
  const configuration = input.configuration ?? null;

  return {
    base_product_id: canonicalConfiguration?.baseProductId ?? null,
    canonical_config_id: canonicalConfiguration?.id ?? null,
    matrix_row_id: readMatrixRowId(configuration),
    configuration_state: configuration ?? null,
  };
};

