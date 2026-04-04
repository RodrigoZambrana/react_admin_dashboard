import {
  ResponseFallbackBootstrapTemplateKey,
  ResponseFallbackLocaleFamily,
  ResponseFallbackTemplateKey,
} from './response-fallback.types';

type BootstrapTemplateCatalog = Record<
  ResponseFallbackBootstrapTemplateKey,
  Record<ResponseFallbackLocaleFamily, string>
>;

const bootstrapTemplateCatalog: BootstrapTemplateCatalog = {
  document_not_found: {
    default: 'I could not find relevant information in the active documents.',
    en: 'I could not find relevant information in the active documents.',
    es: 'No encontré información relevante sobre eso en los documentos activos.',
  },
  execution_failure_not_found: {
    default: 'I could not find a valid match with the available information.',
    en: 'I could not find a valid match with the available information.',
    es: 'No encontré un resultado válido con la información disponible.',
  },
  close_turn_acknowledgement: {
    default: 'Thanks for the message. I will leave it here for now.',
    en: 'Thanks for the message. I will leave it here for now.',
    es: 'Gracias por el mensaje. Lo dejamos por acá.',
  },
  close_turn_resolved: {
    default: 'Understood, thanks for letting me know. I will leave it here.',
    en: 'Understood, thanks for letting me know. I will leave it here.',
    es: 'Perfecto, gracias por avisar. Lo dejamos por acá.',
  },
};

export function resolveResponseFallbackLocaleFamily(
  locale?: string | null,
): ResponseFallbackLocaleFamily {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  if (family === 'es' || family === 'en') {
    return family;
  }

  return 'default';
}

export function resolveBootstrapTemplateFallback(input: {
  templateKey: ResponseFallbackTemplateKey;
  requestedLocale?: string | null;
  resolvedLocale?: string | null;
  configuredValue?: string | null;
}) {
  const bootstrapTemplate = isBootstrapTemplateKey(input.templateKey)
    ? bootstrapTemplateCatalog[input.templateKey]
    : null;
  const requestedFamily = resolveResponseFallbackLocaleFamily(input.requestedLocale);
  const resolvedFamily = resolveResponseFallbackLocaleFamily(input.resolvedLocale);
  const localeFallback = bootstrapTemplate
    ? bootstrapTemplate[requestedFamily] ?? bootstrapTemplate.default
    : null;

  if (
    localeFallback &&
    requestedFamily !== 'default' &&
    requestedFamily !== resolvedFamily
  ) {
    return localeFallback;
  }

  if (typeof input.configuredValue === 'string' && input.configuredValue.trim().length > 0) {
    return input.configuredValue;
  }

  return localeFallback;
}

function isBootstrapTemplateKey(
  templateKey: ResponseFallbackTemplateKey,
): templateKey is ResponseFallbackBootstrapTemplateKey {
  return templateKey in bootstrapTemplateCatalog;
}
