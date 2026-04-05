export const documentKnowledgeExtractionCatalog = {
  patterns: {
    page: /^(?:page|p[aá]gina)\s+(\d+)$/iu,
    sheet: /^(?:sheet|hoja)\s*:\s*(.+)$/iu,
    headingSuffix: /^[^:]{1,80}:$/u,
    headingUppercase: /^[A-ZÁÉÍÓÚÜÑ0-9\s\-\/]+$/u,
  },
} as const;
