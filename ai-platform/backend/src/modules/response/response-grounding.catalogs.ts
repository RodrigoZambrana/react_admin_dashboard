import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ResponseGroundingDetailType } from './response.types';

type DetailCatalogEntry = {
  requestTerms: string[];
  generalEvidenceTerms?: string[];
  supportedAxes?: string[];
  unspecifiedAxes?: string[];
  unspecifiedLabel: string;
};

type DetailCatalog = Record<ResponseGroundingDetailType, DetailCatalogEntry>;

type GroundingQuestionSignals = {
  broadOverviewIntentTerms: string[];
  availabilityIntentTerms: string[];
  detailCueTerms: string[];
};

type RawGroundingLocaleCatalog = {
  locale: string;
  detailTypes: DetailCatalog;
  unspecifiedCues: string[];
  exactnessCues: string[];
  closeTurnReopenCues: string[];
  questionSignals: GroundingQuestionSignals;
  unspecifiedDetailPrefix: string;
  labelJoiner: string;
  guardrail: {
    minimumTokenLength: number;
    minimumSentenceTokenCount: number;
    minimumOverlapCount: number;
    maximumNovelRatio: number;
  };
};

type GroundingLocaleCatalog = {
  locale: string;
  detailTypes: DetailCatalog;
  unspecifiedCues: string[];
  exactnessCues: string[];
  closeTurnReopenCues: string[];
  questionSignals: GroundingQuestionSignals;
  unspecifiedDetailPrefix: string;
  labelJoiner: string;
  guardrail: {
    minimumTokenLength: number;
    minimumSentenceTokenCount: number;
    minimumOverlapCount: number;
    maximumNovelRatio: number;
  };
};

type ResponseGroundingLocaleFamily = 'default' | 'en' | 'es';

const defaultGuardrailConfig = {
  minimumTokenLength: 4,
  minimumSentenceTokenCount: 4,
  minimumOverlapCount: 2,
  maximumNovelRatio: 0.7,
};

const localeCatalogCache = new Map<ResponseGroundingLocaleFamily, GroundingLocaleCatalog>();

export function resolveResponseGroundingLocaleFamily(locale?: string | null) {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  if (family === 'es' || family === 'en') {
    return family;
  }

  return 'default';
}

export function resolveResponseGroundingCatalog(locale?: string | null) {
  const family = resolveResponseGroundingLocaleFamily(locale);
  const cached = localeCatalogCache.get(family);

  if (cached) {
    return cached;
  }

  const catalog = compileGroundingCatalog(loadGroundingCatalogResource(family));
  localeCatalogCache.set(family, catalog);
  return catalog;
}

export function normalizeGroundingText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function hasGroundingCatalogSignal(
  normalizedText: string,
  terms: readonly string[],
) {
  return terms.some((term) => {
    if (!term) {
      return false;
    }

    return normalizedText.includes(term);
  });
}

export function extractGroundingTokens(
  value: string,
  minimumTokenLength = defaultGuardrailConfig.minimumTokenLength,
) {
  return normalizeGroundingText(value)
    .split(/\s+/u)
    .filter((token) => token.length >= minimumTokenLength && !/^\d+$/u.test(token));
}

export function splitGroundingSentences(value: string) {
  return value
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function renderUnspecifiedDetailClause(input: {
  locale?: string | null;
  labels: string[];
}) {
  const catalog = resolveResponseGroundingCatalog(input.locale);

  if (input.labels.length === 0) {
    return null;
  }

  return `${catalog.unspecifiedDetailPrefix} ${joinLabels(
    input.labels,
    catalog.labelJoiner,
  )}.`;
}

function loadGroundingCatalogResource(
  family: ResponseGroundingLocaleFamily,
): RawGroundingLocaleCatalog {
  const candidatePath = join(
    __dirname,
    '../../resources/response-grounding/locales',
    `${family}.json`,
  );
  const fallbackPath = join(
    __dirname,
    '../../resources/response-grounding/locales',
    'default.json',
  );
  const resolvedPath = existsSync(candidatePath) ? candidatePath : fallbackPath;

  return JSON.parse(readFileSync(resolvedPath, 'utf8')) as RawGroundingLocaleCatalog;
}

function compileGroundingCatalog(
  raw: RawGroundingLocaleCatalog,
): GroundingLocaleCatalog {
  return {
    locale: raw.locale,
    detailTypes: Object.fromEntries(
      Object.entries(raw.detailTypes).map(([detailType, config]) => [
        detailType,
        {
          ...config,
          requestTerms: normalizeTerms(config.requestTerms),
          generalEvidenceTerms: normalizeTerms(config.generalEvidenceTerms ?? []),
        },
      ]),
    ) as DetailCatalog,
    unspecifiedCues: normalizeTerms(raw.unspecifiedCues),
    exactnessCues: normalizeTerms(raw.exactnessCues),
    closeTurnReopenCues: normalizeTerms(raw.closeTurnReopenCues),
    questionSignals: {
      broadOverviewIntentTerms: normalizeTerms(
        raw.questionSignals?.broadOverviewIntentTerms ?? [],
      ),
      availabilityIntentTerms: normalizeTerms(
        raw.questionSignals?.availabilityIntentTerms ?? [],
      ),
      detailCueTerms: normalizeTerms(raw.questionSignals?.detailCueTerms ?? []),
    },
    unspecifiedDetailPrefix: raw.unspecifiedDetailPrefix,
    labelJoiner: raw.labelJoiner,
    guardrail: {
      minimumTokenLength:
        raw.guardrail?.minimumTokenLength ??
        defaultGuardrailConfig.minimumTokenLength,
      minimumSentenceTokenCount:
        raw.guardrail?.minimumSentenceTokenCount ??
        defaultGuardrailConfig.minimumSentenceTokenCount,
      minimumOverlapCount:
        raw.guardrail?.minimumOverlapCount ??
        defaultGuardrailConfig.minimumOverlapCount,
      maximumNovelRatio:
        raw.guardrail?.maximumNovelRatio ??
        defaultGuardrailConfig.maximumNovelRatio,
    },
  };
}

function normalizeTerms(terms: readonly string[]) {
  return Array.from(
    new Set(
      terms
        .map((term) => normalizeGroundingText(term))
        .filter((term) => term.length > 0),
    ),
  );
}

function joinLabels(values: string[], joinWord: string) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} ${joinWord} ${values[1]}`;
  }

  const last = values.at(-1);
  const leading = values.slice(0, -1).join(', ');

  return `${leading}, ${joinWord} ${last}`;
}
