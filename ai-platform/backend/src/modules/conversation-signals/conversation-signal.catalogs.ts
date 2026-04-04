import type { ConversationSignalCatalog } from './conversation-signal.types';

const defaultCatalog: ConversationSignalCatalog = {
  document: {
    source_reference: {
      terms: ['document', 'catalog', 'manual'],
      phrases: ['according to', 'what does the document say'],
    },
    grounding_inquiry: {
      terms: ['covered', 'coverage', 'policy'],
      phrases: ['what does the catalog say', 'is it covered'],
    },
  },
  advisory: {
    recommendation: {
      terms: ['recommend', 'recommended', 'better', 'best', 'ideal', 'suitable'],
    },
    comparison: {
      terms: ['compare', 'comparison', 'difference', 'versus', 'vs'],
    },
    preference: {
      terms: ['prefer', 'preference', 'option', 'options', 'alternative'],
    },
  },
};

const spanishCatalog: ConversationSignalCatalog = {
  document: {
    source_reference: {
      terms: ['documento', 'catalogo', 'catálogo', 'manual'],
      phrases: ['segun el documento', 'según el documento', 'segun el catalogo'],
    },
    grounding_inquiry: {
      terms: ['cubre', 'cubren', 'cobertura'],
      phrases: ['que dice el documento', 'qué dice el documento', 'que dice el catalogo'],
    },
  },
  advisory: {
    recommendation: {
      terms: ['recomendar', 'recomendas', 'conviene', 'mejor', 'ideal'],
    },
    comparison: {
      terms: ['comparar', 'comparacion', 'comparación', 'diferencia', 'versus'],
    },
    preference: {
      terms: [
        'prefiero',
        'preferis',
        'preferís',
        'opcion',
        'opción',
        'opciones',
        'alternativa',
        'alternativas',
      ],
    },
  },
};

const englishCatalog: ConversationSignalCatalog = {
  document: {
    source_reference: {
      terms: ['document', 'catalog', 'manual'],
      phrases: ['according to the document', 'according to the catalog'],
    },
    grounding_inquiry: {
      terms: ['covered', 'coverage', 'policy'],
      phrases: ['what does the document say', 'what does the catalog say'],
    },
  },
  advisory: {
    recommendation: {
      terms: ['recommend', 'recommended', 'better', 'best', 'ideal', 'suitable'],
    },
    comparison: {
      terms: ['compare', 'comparison', 'difference', 'versus', 'vs'],
    },
    preference: {
      terms: ['prefer', 'preference', 'option', 'options', 'alternative', 'alternatives'],
    },
  },
};

export function resolveConversationSignalCatalog(locale?: string | null) {
  const normalizedLocale = String(locale ?? '').toLowerCase();

  if (normalizedLocale.startsWith('es')) {
    return mergeCatalogs(defaultCatalog, spanishCatalog);
  }

  if (normalizedLocale.startsWith('en')) {
    return mergeCatalogs(defaultCatalog, englishCatalog);
  }

  return defaultCatalog;
}

function mergeCatalogs(
  base: ConversationSignalCatalog,
  override: ConversationSignalCatalog,
): ConversationSignalCatalog {
  return {
    document: mergeNamespace(base.document, override.document),
    advisory: mergeNamespace(base.advisory, override.advisory),
  };
}

function mergeNamespace(
  base: ConversationSignalCatalog['document'],
  override: ConversationSignalCatalog['document'],
) {
  const keys = new Set([...Object.keys(base), ...Object.keys(override)]);

  return Object.fromEntries(
    Array.from(keys.values()).map((key) => [
      key,
      {
        terms: dedupe([...(base[key]?.terms ?? []), ...(override[key]?.terms ?? [])]),
        phrases: dedupe([
          ...(base[key]?.phrases ?? []),
          ...(override[key]?.phrases ?? []),
        ]),
      },
    ]),
  );
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
