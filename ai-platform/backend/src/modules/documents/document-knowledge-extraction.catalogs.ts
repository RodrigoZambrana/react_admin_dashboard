export const documentKnowledgeExtractionCatalog = {
  operationModeTerms: [
    'manual',
    'manuales',
    'motorizado',
    'motorizada',
    'motorizados',
    'motorizadas',
    'automatizado',
    'automatizada',
    'automatizados',
    'automatizadas',
  ],
  patterns: {
    productTypes:
      /(?:tipos?(?:\s+principales)?|modelos?|lineas?|líneas?|opciones)\s*[:\-]?\s*(.+)$/iu,
    materialListLeads: [
      /(?:disponibles?|disponible|fabricad[oa]s?|hech[oa]s?|realizad[oa]s?)\s+en\s+(.+?)(?:,?\s+(?:con|para)\b|[.;]|$)/iu,
      /trabajamos\s+con\s+(.+?)(?:,?\s+(?:con|para)\b|[.;]|$)/iu,
      /material(?:es)?\s*[:\-]?\s*(.+)$/iu,
    ],
    page: /^(?:page|p[aá]gina)\s+(\d+)$/iu,
    sheet: /^(?:sheet|hoja)\s*:\s*(.+)$/iu,
    headingSuffix: /^[^:]{1,80}:$/u,
    headingUppercase: /^[A-ZÁÉÍÓÚÜÑ0-9\s\-\/]+$/u,
    suitability: /(?:ideal|recomendad[oa]s?|adecuad[oa]s?)\s+para\s+(.+)$/iu,
    colorList: /colores?\s*[:\-]?\s*(.+)$/iu,
    colorVariety: [
      'variedad de colores',
      'varios colores',
      'diferentes colores',
    ],
    oversizedClaimTail:
      /\b(?:pueden ser|puede ser|con opciones|opciones manuales?|opciones motorizadas?)\b.*$/iu,
  },
} as const;

export function normalizeOperationModeTerm(value: string) {
  const normalized = normalizeCatalogText(value);

  if (normalized.startsWith('manual')) {
    return 'manuales';
  }

  if (normalized.startsWith('motoriz')) {
    return 'motorizadas';
  }

  return 'automatizadas';
}

function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
