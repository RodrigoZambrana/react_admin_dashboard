import type { ResponseGroundingDetailType } from './response.types';

type DetailCatalogEntry = {
  requestTerms: string[];
  generalEvidenceTerms?: string[];
  supportedAxes?: string[];
  unspecifiedAxes?: string[];
  unspecifiedLabel: string;
};

type DetailCatalog = Record<ResponseGroundingDetailType, DetailCatalogEntry>;

type GroundingLocaleCatalog = {
  detailTypes: DetailCatalog;
  unspecifiedCues: string[];
  exactnessCues: string[];
  closeTurnReopenCues: string[];
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

const sharedGuardrailConfig = {
  minimumTokenLength: 4,
  minimumSentenceTokenCount: 4,
  minimumOverlapCount: 2,
  maximumNovelRatio: 0.7,
};

const defaultCatalog: GroundingLocaleCatalog = {
  detailTypes: {
    coverage_support: {
      requestTerms: ['covered', 'coverage', 'include', 'included'],
      generalEvidenceTerms: ['covered', 'coverage', 'include', 'included'],
      unspecifiedLabel: 'whether it is covered',
    },
    pricing: {
      requestTerms: ['price', 'pricing', 'cost', 'budget'],
      generalEvidenceTerms: ['price', 'pricing', 'cost', 'usd', '$'],
      unspecifiedLabel: 'pricing details',
    },
    purchase_channel: {
      requestTerms: ['buy', 'purchase', 'order', 'shop', 'store'],
      generalEvidenceTerms: ['buy', 'purchase', 'order', 'store', 'shop'],
      unspecifiedLabel: 'where to buy it',
    },
    availability: {
      requestTerms: ['availability', 'available', 'stock', 'delivery'],
      generalEvidenceTerms: ['available', 'availability', 'stock', 'delivery'],
      unspecifiedLabel: 'exact availability',
    },
    materials: {
      requestTerms: ['material', 'materials', 'fabric', 'finish'],
      generalEvidenceTerms: ['material', 'materials', 'fabric', 'finish'],
      supportedAxes: ['materials'],
      unspecifiedLabel: 'exact material details',
    },
    color_options: {
      requestTerms: ['color', 'colors', 'tone', 'tones'],
      generalEvidenceTerms: ['color', 'colors', 'tone', 'tones', 'variety'],
      supportedAxes: ['color_options'],
      unspecifiedAxes: ['exact_color_options'],
      unspecifiedLabel: 'the exact color options',
    },
    specific_variants: {
      requestTerms: ['variant', 'variants', 'model', 'models', 'option', 'options'],
      generalEvidenceTerms: [
        'variant',
        'variants',
        'model',
        'models',
        'option',
        'options',
        'variety',
      ],
      supportedAxes: ['specific_variants', 'product_types'],
      unspecifiedLabel: 'the exact variants',
    },
  },
  unspecifiedCues: [
    'not specified',
    'does not specify',
    'does not say',
    'not specified in the document',
    'not provided',
    'not detailed',
    'not listed',
  ],
  exactnessCues: ['exact', 'exactly', 'specific', 'specifically', 'which'],
  closeTurnReopenCues: [
    'if you have more questions',
    'if you need anything else',
    'feel free to ask',
    'i am here to help',
    'let me know if you need',
  ],
  unspecifiedDetailPrefix: "I don't have confirmation on",
  labelJoiner: 'or',
  guardrail: sharedGuardrailConfig,
};

const spanishCatalog: GroundingLocaleCatalog = {
  detailTypes: {
    coverage_support: {
      requestTerms: [
        'cubre',
        'cubren',
        'cobertura',
        'incluye',
        'incluyen',
        'cubierto',
        'cubierta',
        'cubiertos',
        'cubiertas',
      ],
      generalEvidenceTerms: [
        'cubre',
        'cubren',
        'cobertura',
        'incluye',
        'incluyen',
        'cubierto',
        'cubierta',
        'cubiertos',
        'cubiertas',
      ],
      unspecifiedLabel: 'si está cubierto',
    },
    pricing: {
      requestTerms: ['precio', 'precios', 'costo', 'costos', 'valor'],
      generalEvidenceTerms: ['precio', 'precios', 'costo', 'costos', 'usd', '$'],
      unspecifiedLabel: 'los precios',
    },
    purchase_channel: {
      requestTerms: ['comprar', 'compra', 'adquirir', 'pedido', 'tienda', 'local'],
      generalEvidenceTerms: ['comprar', 'compra', 'pedido', 'tienda', 'local'],
      unspecifiedLabel: 'dónde comprarlo',
    },
    availability: {
      requestTerms: ['disponibilidad', 'disponible', 'stock', 'entrega'],
      generalEvidenceTerms: ['disponibilidad', 'disponible', 'stock', 'entrega'],
      unspecifiedLabel: 'la disponibilidad exacta',
    },
    materials: {
      requestTerms: ['material', 'materiales', 'tela', 'acabado'],
      generalEvidenceTerms: ['material', 'materiales', 'tela', 'acabado'],
      supportedAxes: ['materials'],
      unspecifiedLabel: 'los materiales exactos',
    },
    color_options: {
      requestTerms: ['color', 'colores', 'tono', 'tonos'],
      generalEvidenceTerms: ['color', 'colores', 'tono', 'tonos', 'variedad'],
      supportedAxes: ['color_options'],
      unspecifiedAxes: ['exact_color_options'],
      unspecifiedLabel: 'los colores exactos',
    },
    specific_variants: {
      requestTerms: ['variante', 'variantes', 'modelo', 'modelos', 'opcion', 'opciones'],
      generalEvidenceTerms: [
        'variante',
        'variantes',
        'modelo',
        'modelos',
        'opcion',
        'opciones',
        'variedad',
      ],
      supportedAxes: ['specific_variants', 'product_types'],
      unspecifiedLabel: 'las variantes exactas',
    },
  },
  unspecifiedCues: [
    'no especifica',
    'no se especifica',
    'no se especifican',
    'no indica',
    'no se indica',
    'no detalla',
    'no se detalla',
    'no aparece',
    'no figura',
    'no tengo confirmacion sobre',
    'no tengo confirmado',
    'no tengo confirmada',
    'no tengo confirmados',
    'no tengo confirmadas',
  ],
  exactnessCues: [
    'exacto',
    'exacta',
    'exactos',
    'exactas',
    'especifico',
    'específico',
    'cuales',
    'cuáles',
  ],
  closeTurnReopenCues: [
    'si tienes mas preguntas',
    'si tienes más preguntas',
    'si necesitas algo mas',
    'si necesitas algo más',
    'quedo a tu disposicion',
    'quedo a tu disposición',
    'cualquier otra consulta',
  ],
  unspecifiedDetailPrefix: 'Por ahora no tengo confirmación sobre',
  labelJoiner: 'ni',
  guardrail: sharedGuardrailConfig,
};

const localeCatalogs: Record<ResponseGroundingLocaleFamily, GroundingLocaleCatalog> = {
  default: defaultCatalog,
  en: defaultCatalog,
  es: spanishCatalog,
};

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
  return localeCatalogs[resolveResponseGroundingLocaleFamily(locale)];
}

export function normalizeGroundingText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasGroundingCatalogSignal(normalizedText: string, terms: string[]) {
  return terms.some((term) => {
    const normalizedTerm = normalizeGroundingText(term);

    if (!normalizedTerm) {
      return false;
    }

    return normalizedText.includes(normalizedTerm);
  });
}

export function extractGroundingTokens(
  value: string,
  minimumTokenLength = sharedGuardrailConfig.minimumTokenLength,
) {
  return normalizeGroundingText(value)
    .split(/\s+/u)
    .filter(
      (token) =>
        token.length >= minimumTokenLength &&
        !/^\d+$/u.test(token),
    );
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
