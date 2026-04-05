import type {
  ConversationSignalCatalog,
  ConversationSignalNamespaceCatalog,
} from './conversation-signal.types';

type ConversationTextSupportCatalog = ConversationSignalCatalog['textSupport'];

const sharedInformativeStopWords = [
  'a',
  'al',
  'and',
  'also',
  'con',
  'de',
  'del',
  'el',
  'en',
  'for',
  'if',
  'la',
  'las',
  'los',
  'me',
  'ademas',
  'además',
  'para',
  'por',
  'que',
  'si',
  'tambien',
  'también',
  'the',
  'un',
  'una',
  'what',
  'y',
];

const sharedRetrievalStopWords = [
  ...sharedInformativeStopWords,
  'also',
  'catalogo',
  'catalog',
  'conocer',
  'cortina',
  'cortinas',
  'detalle',
  'detalles',
  'documento',
  'document',
  'info',
  'informacion',
  'information',
  'interesa',
  'have',
  'has',
  'know',
  'manual',
  'need',
  'necesito',
  'producto',
  'productos',
  'quiero',
  'saber',
  'sobre',
  'tambien',
  'tiene',
  'tienen',
  'about',
];

const sharedBridgeTerms = ['also', 'tambien'];

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
  closure: {
    gratitude: {
      terms: ['thanks', 'thank you', 'appreciate'],
    },
    decline: {
      phrases: ['no thanks', 'no thank you', 'all set', 'that is all', 'already solved'],
    },
    farewell: {
      terms: ['bye', 'goodbye'],
    },
  },
  threading: {
    resume: {
      terms: ['resume', 'resuming', 'continue', 'continuing'],
      phrases: ['following up', 'back to this', 'still interested'],
    },
    short_follow_up: {
      terms: ['ok', 'okay', 'yes', 'yep', 'sure'],
      phrases: ['sounds good', 'i am interested'],
    },
    bridge: {
      terms: ['also'],
    },
    switch: {
      terms: ['another', 'different', 'instead'],
      phrases: ['another question', 'different topic', 'something else', 'now i need'],
    },
  },
  noise: {
    auto_reply: {
      terms: ['automatic', 'automated', 'noreply'],
      phrases: ['automatic message', 'auto reply'],
    },
  },
  textSupport: {
    informativeStopWords: sharedInformativeStopWords,
    retrievalStopWords: sharedRetrievalStopWords,
    bridgeTerms: sharedBridgeTerms,
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
  closure: {
    gratitude: {
      terms: ['gracias', 'agradezco'],
    },
    decline: {
      phrases: [
        'no gracias',
        'ya resolvi',
        'ya resolví',
        'ya esta',
        'ya está',
        'eso es todo',
        'con eso alcanza',
      ],
    },
    farewell: {
      terms: ['chau', 'adios', 'adiós', 'hasta luego'],
    },
  },
  threading: {
    resume: {
      terms: ['retomo', 'retomando', 'seguimos', 'continuamos'],
      phrases: [
        'sigo con esto',
        'retomo esto',
        'si me interesa',
        'me interesa',
        'sobre lo anterior',
      ],
    },
    short_follow_up: {
      terms: ['si', 'sí', 'dale', 'ok', 'genial', 'perfecto'],
      phrases: ['me sirve', 'esta bien', 'está bien'],
    },
    bridge: {
      terms: ['ademas', 'además', 'tambien', 'también'],
    },
    switch: {
      terms: ['otra', 'otro'],
      phrases: [
        'otro tema',
        'otra consulta',
        'otra abertura',
        'ahora te consulto',
        'aparte necesito',
      ],
    },
  },
  noise: {
    auto_reply: {
      terms: ['automatico', 'automático'],
      phrases: ['mensaje automatico', 'mensaje automático', 'respuesta automatica', 'respuesta automática'],
    },
  },
  textSupport: {
    informativeStopWords: sharedInformativeStopWords,
    retrievalStopWords: sharedRetrievalStopWords,
    bridgeTerms: sharedBridgeTerms,
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
  closure: {
    gratitude: {
      terms: ['thanks', 'thank you', 'appreciate'],
    },
    decline: {
      phrases: ['no thanks', 'no thank you', 'all set', 'that is all', 'already solved'],
    },
    farewell: {
      terms: ['bye', 'goodbye', 'see you'],
    },
  },
  threading: {
    resume: {
      terms: ['resume', 'continue', 'still'],
      phrases: ['following up', 'back to this', 'still interested'],
    },
    short_follow_up: {
      terms: ['yes', 'sure', 'okay', 'ok', 'great'],
      phrases: ['sounds good', 'i am interested', 'that works'],
    },
    bridge: {
      terms: ['also'],
    },
    switch: {
      terms: ['another', 'different', 'instead'],
      phrases: ['another question', 'different topic', 'something else', 'now i need'],
    },
  },
  noise: {
    auto_reply: {
      terms: ['automatic', 'automated', 'noreply'],
      phrases: ['automatic message', 'auto reply'],
    },
  },
  textSupport: {
    informativeStopWords: sharedInformativeStopWords,
    retrievalStopWords: sharedRetrievalStopWords,
    bridgeTerms: sharedBridgeTerms,
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

export function resolveConversationTextSupportCatalog(locale?: string | null) {
  return resolveConversationSignalCatalog(locale).textSupport;
}

export function normalizeConversationSignalText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeConversationSignalText(
  value: string,
  input?: {
    locale?: string | null;
    minimumTokenLength?: number;
    stopWordSet?: 'informative' | 'retrieval' | null;
  },
) {
  const minimumTokenLength = input?.minimumTokenLength ?? 2;
  const supportCatalog = resolveConversationTextSupportCatalog(input?.locale);
  const stopWords =
    input?.stopWordSet === 'informative'
      ? new Set(
          supportCatalog.informativeStopWords.map((entry) =>
            normalizeConversationSignalText(entry),
          ),
        )
      : input?.stopWordSet === 'retrieval'
        ? new Set(
            supportCatalog.retrievalStopWords.map((entry) =>
              normalizeConversationSignalText(entry),
            ),
          )
        : null;

  return normalizeConversationSignalText(value)
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= minimumTokenLength &&
        !(stopWords?.has(token) ?? false),
    );
}

function mergeCatalogs(
  base: ConversationSignalCatalog,
  override: ConversationSignalCatalog,
): ConversationSignalCatalog {
  return {
    document: mergeNamespace(base.document, override.document),
    advisory: mergeNamespace(base.advisory, override.advisory),
    closure: mergeNamespace(base.closure, override.closure),
    threading: mergeNamespace(base.threading, override.threading),
    noise: mergeNamespace(base.noise, override.noise),
    textSupport: mergeTextSupport(base.textSupport, override.textSupport),
  };
}

function mergeNamespace(
  base: ConversationSignalNamespaceCatalog,
  override: ConversationSignalNamespaceCatalog,
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

function mergeTextSupport(
  base: ConversationTextSupportCatalog,
  override: ConversationTextSupportCatalog,
): ConversationTextSupportCatalog {
  return {
    informativeStopWords: dedupe([
      ...base.informativeStopWords,
      ...override.informativeStopWords,
    ]),
    retrievalStopWords: dedupe([
      ...base.retrievalStopWords,
      ...override.retrievalStopWords,
    ]),
    bridgeTerms: dedupe([...(base.bridgeTerms ?? []), ...(override.bridgeTerms ?? [])]),
  };
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
