export const documentKnowledgeExtractionCatalog = {
  patterns: {
    page: /^(?:page|p[aá]gina)\s+(\d+)$/iu,
    sheet: /^(?:sheet|hoja)\s*:\s*(.+)$/iu,
    divider: /^[-=]{6,}$/u,
    headingSuffix: /^[^:]{1,80}:$/u,
    headingUppercase: /^[A-ZÁÉÍÓÚÜÑ0-9\s\-\/]+$/u,
  },
} as const;
