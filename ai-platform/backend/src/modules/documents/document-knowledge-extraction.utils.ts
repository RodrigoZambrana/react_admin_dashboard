export function splitDocumentSemanticSentences(value: string) {
  return value
    .split(/\n{2,}|\n(?=\s*[-•]\s+)|(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function normalizeDocumentKnowledgeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function cleanDocumentKnowledgeRecord<T extends Record<string, unknown>>(
  value: T | null | undefined,
) {
  if (!value) {
    return null;
  }

  const entries = Object.entries(value).filter(([, current]) => {
    if (current === undefined || current === null) {
      return false;
    }

    if (typeof current === 'string') {
      return current.trim().length > 0;
    }

    if (Array.isArray(current)) {
      return current.length > 0;
    }

    return true;
  });

  return entries.length > 0 ? (Object.fromEntries(entries) as T) : null;
}

export type DocumentKnowledgeValueSplitOptions = {
  conjunctionTerms?: readonly string[];
  oversizedTailPattern?: RegExp | null;
  maxValues?: number;
  pairedLeadTerms?: readonly string[];
};

export function normalizeDocumentKnowledgeHeading(value?: string) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/^\d+(?:\.\d+)*\.?\s*/u, '')
    .replace(/:$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function stripDocumentKnowledgeBulletLead(value: string) {
  return value.replace(/^\s*[-•]\s*/u, '').trim();
}

export function isStructuredDocumentKnowledgeListEntry(value: string) {
  return /^\s*[-•]\s+/u.test(value) || /^[^:]{1,80}:\s+/u.test(value);
}

export function matchesDocumentKnowledgeHeadingTerms(
  normalizedHeading: string,
  headingTerms: readonly string[],
) {
  if (!normalizedHeading) {
    return false;
  }

  return headingTerms
    .map((term) => normalizeDocumentKnowledgeText(term))
    .filter(Boolean)
    .some(
      (term) =>
        normalizedHeading === term ||
        normalizedHeading.startsWith(`${term} `) ||
        normalizedHeading.includes(` ${term} `) ||
        normalizedHeading.endsWith(` ${term}`),
    );
}

export function sectionMatchesDocumentKnowledgeHeading(
  sectionHeading: string | undefined,
  headingTerms: readonly string[],
) {
  return matchesDocumentKnowledgeHeadingTerms(
    normalizeDocumentKnowledgeText(sectionHeading ?? ''),
    headingTerms,
  );
}

export function captureDocumentKnowledgeLabeledValue(
  value: string,
  headingTerms: readonly string[],
) {
  const separatorIndex = value.indexOf(':');

  if (separatorIndex === -1) {
    return '';
  }

  const heading = normalizeDocumentKnowledgeText(value.slice(0, separatorIndex));

  if (!matchesDocumentKnowledgeHeadingTerms(heading, headingTerms)) {
    return '';
  }

  return value.slice(separatorIndex + 1).trim();
}

export function resolveDocumentKnowledgeSectionListEntry(input: {
  sentence: string;
  sectionHeading?: string;
  headingTerms: readonly string[];
  maxInlineWords?: number;
}) {
  if (
    !sectionMatchesDocumentKnowledgeHeading(input.sectionHeading, input.headingTerms)
  ) {
    return '';
  }

  const stripped = stripDocumentKnowledgeBulletLead(input.sentence);

  if (!stripped) {
    return '';
  }

  if (isStructuredDocumentKnowledgeListEntry(input.sentence)) {
    return stripped;
  }

  const maxInlineWords = input.maxInlineWords ?? 8;
  return stripped.split(/\s+/u).length <= maxInlineWords ? stripped : '';
}

export function dedupeDocumentKnowledgeValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function splitStructuredDocumentKnowledgeValues(
  value: string,
  options: DocumentKnowledgeValueSplitOptions = {},
) {
  const conjunctionPattern = buildDocumentKnowledgeConjunctionPattern(
    options.conjunctionTerms ?? [],
  );
  const truncated = value
    .replace(/\n+/gu, ' | ')
    .replace(/(^|\|)\s*[-•]\s*/gu, '$1 ')
    .replace(options.oversizedTailPattern ?? /$^/u, '')
    .replace(/[.;]+$/u, '')
    .trim();
  const normalized =
    conjunctionPattern === null
      ? truncated
      : truncated.replace(conjunctionPattern, ', ');

  return normalized
    .split(/\s*[|,/]\s*|\s+-\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, options.maxValues ?? 8);
}

export function extractInlineDocumentKnowledgeAxisValues(input: {
  sentence: string;
  axisTerms: readonly string[];
  options?: DocumentKnowledgeValueSplitOptions;
}) {
  for (const axisTerm of input.axisTerms) {
    const match = input.sentence.match(
      new RegExp(
        `${escapeDocumentKnowledgeRegExp(axisTerm)}(?:\\s+[^:()\\-.,;]{0,40})?\\s*(?:\\(([^)]+)\\)|[:\\-]\\s*([^.;]+))`,
        'iu',
      ),
    );
    const source = match?.[1]?.trim() || match?.[2]?.trim() || '';

    if (!source) {
      continue;
    }

    const values = splitLooseDocumentKnowledgeValues(
      source,
      input.options ?? {},
    );

    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function splitLooseDocumentKnowledgeValues(
  value: string,
  options: DocumentKnowledgeValueSplitOptions,
) {
  const directValues = splitStructuredDocumentKnowledgeValues(value, options);

  if (directValues.length > 1) {
    return dedupeDocumentKnowledgeValues(directValues);
  }

  const tokens = value
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  const values: string[] = [];
  const pairedLeadTerms = new Set(
    (options.pairedLeadTerms ?? []).map((term) =>
      normalizeDocumentKnowledgeText(term),
    ),
  );

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];

    if (!current) {
      continue;
    }

    if (
      pairedLeadTerms.has(normalizeDocumentKnowledgeText(current)) &&
      tokens[index + 1]
    ) {
      values.push(`${current} ${tokens[index + 1]}`.trim());
      index += 1;
      continue;
    }

    values.push(current);
  }

  return dedupeDocumentKnowledgeValues(
    values
      .map((entry) => entry.replace(/[().,;]+$/u, '').trim())
      .filter((entry) => entry.length > 1)
      .slice(0, options.maxValues ?? 8),
  );
}

function buildDocumentKnowledgeConjunctionPattern(terms: readonly string[]) {
  const filtered = terms.map((term) => term.trim()).filter(Boolean);

  if (filtered.length === 0) {
    return null;
  }

  const alternation = filtered.map(escapeDocumentKnowledgeRegExp).join('|');
  return new RegExp(`\\s+(?:${alternation})\\s+`, 'giu');
}

function escapeDocumentKnowledgeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
