import { createHash } from 'node:crypto'

import {
  serializeCanonicalDimensions,
  type CanonicalDimensionKey,
  CANONICAL_DIMENSION_KEYS,
  normalizeCanonicalDimensions,
} from './analytics-dimension-normalizer'

export type AnalyticsDimensionHashInput = Record<string, unknown>

export const buildAnalyticsDimensionHash = (dimensions: AnalyticsDimensionHashInput) =>
  createHash('sha256').update(serializeCanonicalDimensions(dimensions)).digest('hex')

export const buildAnalyticsCanonicalDimensionPayload = (dimensions: AnalyticsDimensionHashInput) =>
  normalizeCanonicalDimensions(dimensions)

export const canonicalDimensionKeys = CANONICAL_DIMENSION_KEYS satisfies readonly CanonicalDimensionKey[]

