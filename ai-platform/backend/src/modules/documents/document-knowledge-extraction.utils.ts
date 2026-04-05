export function splitDocumentSemanticSentences(value: string) {
  return value
    .split(/\n{2,}|(?<=[.!?])\s+/u)
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
